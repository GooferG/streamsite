import { adminDb } from '../_lib/firebaseAdmin.js';
import { applyCors, requireAdmin } from '../_lib/verifyAuth.js';

// Admin user dashboard endpoint.
//
// GET ?action=list&sort=tickets|created|recent&limit=200
//   -> { users: [...] } — snapshot of all users, sorted server-side.
//      Capped at 500 docs; for a streamer dashboard this is plenty.
//
// GET ?action=detail&twitchId=<id>
//   -> { user, redemptions, ledger, giveawayEntries, huntPredictions, huntSuggestions }
//      Server fan-out across collections so the client doesn't need broad Firestore reads.

const LIST_HARD_CAP = 500;

const SORT_FIELDS = {
  tickets: { field: 'tickets', direction: 'desc' },
  created: { field: 'createdAt', direction: 'desc' },
  recent: { field: 'updatedAt', direction: 'desc' },
};

function shapeUser(doc) {
  const d = doc.data();
  return {
    twitchId: doc.id,
    twitchName: d.twitchName || null,
    displayName: d.displayName || null,
    profileImageUrl: d.profileImageUrl || null,
    tickets: d.tickets || 0,
    totalEarned: d.totalEarned || 0,
    totalSpent: d.totalSpent || 0,
    lastDailyClaimAt: d.lastDailyClaimAt || null,
    lastWatchTimeAwardAt: d.lastWatchTimeAwardAt || null,
    discordId: d.discordId || null,
    discordUsername: d.discordUsername || null,
    discordVerifiedAt: d.discordVerifiedAt || null,
    createdAt: d.createdAt || null,
    updatedAt: d.updatedAt || null,
  };
}

async function listUsers(sort, lim) {
  const sortConf = SORT_FIELDS[sort] || SORT_FIELDS.tickets;
  const cap = Math.min(Number(lim) || 200, LIST_HARD_CAP);
  const snap = await adminDb
    .collection('users')
    .orderBy(sortConf.field, sortConf.direction)
    .limit(cap)
    .get();
  return snap.docs.map(shapeUser);
}

async function getUserDetail(twitchId) {
  const userRef = adminDb.collection('users').doc(twitchId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) return null;
  const user = shapeUser(userSnap);

  // Fan out the activity queries in parallel.
  const [redemptionsSnap, ledgerSnap, huntPredictionsSnap, huntSuggestionsSnap] =
    await Promise.all([
      adminDb
        .collection('redemptions')
        .where('userId', '==', twitchId)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get(),
      adminDb
        .collection('ticket_ledger')
        .where('userId', '==', twitchId)
        .orderBy('createdAt', 'desc')
        .limit(30)
        .get(),
      adminDb
        .collectionGroup('entries')
        .where('twitchId', '==', twitchId)
        .limit(100)
        .get(),
      adminDb
        .collectionGroup('suggestions')
        .where('twitchId', '==', twitchId)
        .limit(100)
        .get(),
    ]);

  const redemptions = redemptionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const ledger = ledgerSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Separate giveaway entries from hunt prediction entries. Both live in
  // `entries` subcollections (giveaways/*/entries vs hunts/*/entries) and we
  // can't filter by parent in a collectionGroup query, so we sort here.
  const giveawayEntries = [];
  const huntPredictions = [];
  for (const doc of huntPredictionsSnap.docs) {
    const parent = doc.ref.parent.parent; // points to giveaways/{id} or hunts/{id}
    const parentCol = parent?.parent?.id; // 'giveaways' or 'hunts'
    const data = doc.data();
    if (parentCol === 'giveaways') {
      giveawayEntries.push({
        id: doc.id,
        giveawayId: parent.id,
        weight: data.weight,
        registered: data.registered,
        discordLinked: data.discordLinked,
        isTwitchSub: data.isTwitchSub,
        isVip: data.isVip,
        isMod: data.isMod,
        source: data.source,
        enteredAt: data.enteredAt,
      });
    } else if (parentCol === 'hunts') {
      huntPredictions.push({
        id: doc.id,
        huntId: parent.id,
        payoutGuess: data.payoutGuess ?? null,
        topSlotGuess: data.topSlotGuess ?? null,
        editCount: data.editCount ?? 0,
        submittedAt: data.submittedAt,
        lastEditAt: data.lastEditAt,
      });
    }
  }

  const huntSuggestions = huntSuggestionsSnap.docs.map((doc) => {
    const parent = doc.ref.parent.parent;
    const data = doc.data();
    return {
      id: doc.id,
      huntId: parent?.id || null,
      slotName: data.slotName,
      note: data.note || null,
      status: data.status,
      adminNote: data.adminNote || null,
      createdAt: data.createdAt,
    };
  });

  // Enrich giveaway entries with the giveaway title/prize (one read per
  // distinct giveaway). Small N expected.
  const giveawayIds = [...new Set(giveawayEntries.map((e) => e.giveawayId))];
  const giveawayMeta = {};
  if (giveawayIds.length > 0) {
    const snaps = await Promise.all(
      giveawayIds.map((id) => adminDb.collection('giveaways').doc(id).get())
    );
    snaps.forEach((s) => {
      if (s.exists) {
        const d = s.data();
        giveawayMeta[s.id] = {
          title: d.title,
          prize: d.prize,
          status: d.status,
          winnerTwitchId: d.winnerTwitchId || null,
        };
      }
    });
  }
  giveawayEntries.forEach((e) => {
    e.giveaway = giveawayMeta[e.giveawayId] || null;
    e.isWinner = giveawayMeta[e.giveawayId]?.winnerTwitchId === twitchId;
  });

  // Same enrichment for hunts.
  const huntIds = [
    ...new Set([
      ...huntPredictions.map((p) => p.huntId),
      ...huntSuggestions.map((s) => s.huntId).filter(Boolean),
    ]),
  ];
  const huntMeta = {};
  if (huntIds.length > 0) {
    const snaps = await Promise.all(
      huntIds.map((id) => adminDb.collection('hunts').doc(id).get())
    );
    snaps.forEach((s) => {
      if (s.exists) {
        const d = s.data();
        huntMeta[s.id] = {
          title: d.title,
          status: d.status,
        };
      }
    });
  }
  huntPredictions.forEach((p) => {
    p.hunt = huntMeta[p.huntId] || null;
  });
  huntSuggestions.forEach((s) => {
    s.hunt = huntMeta[s.huntId] || null;
  });

  return {
    user,
    redemptions,
    ledger,
    giveawayEntries,
    huntPredictions,
    huntSuggestions,
  };
}

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { action, twitchId, sort, limit: limitStr } = req.query;

  try {
    if (action === 'list' || !action) {
      const users = await listUsers(sort, limitStr);
      return res.status(200).json({ users });
    }
    if (action === 'detail') {
      if (!twitchId) return res.status(400).json({ error: 'twitchId required' });
      const detail = await getUserDetail(String(twitchId));
      if (!detail) return res.status(404).json({ error: 'NOT_FOUND' });
      return res.status(200).json(detail);
    }
    return res.status(400).json({ error: 'INVALID_ACTION' });
  } catch (err) {
    console.error('admin/users error', err);
    return res.status(500).json({ error: 'INTERNAL', detail: err.message });
  }
}
