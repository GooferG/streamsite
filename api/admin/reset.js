import { adminDb, FieldValue } from '../_lib/firebaseAdmin.js';
import { applyCors, requireAdmin } from '../_lib/verifyAuth.js';

// Destructive admin endpoint to wipe selected test-data collections.
// Body: { confirm: "WIPE", scopes: { giveaways, redemptions, tickets, hunts, eventsubCache } }
// All scopes default to false. confirm must be the literal string "WIPE".
//
// Returns { ok: true, deleted: { ...counts } }.
//
// Notes:
//  - User identity (twitchName, displayName, discord links, etc.) is preserved
//    by the "tickets" scope — only ticket-economy fields are zeroed.
//  - Ledger is always wiped alongside ticket balances (they're meant to mirror).
//  - Writes an audit row to reset_log/{auto-id} on every successful run.

const BATCH = 400; // < 500 Firestore batch limit, with headroom

async function deleteCollection(ref) {
  let total = 0;
  while (true) {
    const snap = await ref.limit(BATCH).get();
    if (snap.empty) return total;
    const batch = adminDb.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += snap.size;
    if (snap.size < BATCH) return total;
  }
}

// Delete a parent collection plus a fixed list of subcollections under each
// parent doc. Subs deleted first, then parents.
async function deleteWithSubcollections(parentRef, subNames) {
  let parents = 0;
  let subs = 0;
  while (true) {
    const snap = await parentRef.limit(BATCH).get();
    if (snap.empty) return { parents, subs };
    for (const doc of snap.docs) {
      for (const subName of subNames) {
        subs += await deleteCollection(doc.ref.collection(subName));
      }
    }
    const batch = adminDb.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    parents += snap.size;
    if (snap.size < BATCH) return { parents, subs };
  }
}

async function resetUserTicketFields() {
  let users = 0;
  let cursor = null;
  while (true) {
    let q = adminDb.collection('users').orderBy('__name__').limit(BATCH);
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    if (snap.empty) return users;
    const batch = adminDb.batch();
    snap.docs.forEach((d) => {
      batch.update(d.ref, {
        tickets: 0,
        totalEarned: 0,
        totalSpent: 0,
        lastDailyClaimAt: null,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
    users += snap.size;
    cursor = snap.docs[snap.docs.length - 1];
    if (snap.size < BATCH) return users;
  }
}

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { confirm, scopes } = req.body || {};
  if (confirm !== 'WIPE') {
    return res.status(400).json({ error: 'CONFIRM_REQUIRED', detail: 'Body must include confirm: "WIPE"' });
  }
  if (!scopes || typeof scopes !== 'object') {
    return res.status(400).json({ error: 'NO_SCOPES' });
  }

  const want = {
    giveaways: scopes.giveaways === true,
    redemptions: scopes.redemptions === true,
    tickets: scopes.tickets === true,
    hunts: scopes.hunts === true,
    eventsubCache: scopes.eventsubCache === true,
  };
  if (!Object.values(want).some(Boolean)) {
    return res.status(400).json({ error: 'NOTHING_SELECTED' });
  }

  const deleted = {
    giveaways: 0,
    giveawaySubs: 0,
    redemptions: 0,
    usersReset: 0,
    ledger: 0,
    hunts: 0,
    huntSubs: 0,
    eventsubCache: 0,
  };

  try {
    if (want.giveaways) {
      const r = await deleteWithSubcollections(
        adminDb.collection('giveaways'),
        ['entries', 'winner_messages', 'history']
      );
      deleted.giveaways = r.parents;
      deleted.giveawaySubs = r.subs;
    }
    if (want.redemptions) {
      deleted.redemptions = await deleteCollection(adminDb.collection('redemptions'));
    }
    if (want.tickets) {
      deleted.usersReset = await resetUserTicketFields();
      deleted.ledger = await deleteCollection(adminDb.collection('ticket_ledger'));
    }
    if (want.hunts) {
      const r = await deleteWithSubcollections(
        adminDb.collection('hunts'),
        ['entries', 'suggestions']
      );
      deleted.hunts = r.parents;
      deleted.huntSubs = r.subs;
    }
    if (want.eventsubCache) {
      deleted.eventsubCache = await deleteCollection(adminDb.collection('eventsub_seen'));
    }

    await adminDb.collection('reset_log').add({
      adminEmail: admin.email,
      scopes: want,
      deleted,
      ranAt: FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ ok: true, deleted });
  } catch (err) {
    console.error('reset error', err);
    return res.status(500).json({ error: 'INTERNAL', detail: err.message, deleted });
  }
}
