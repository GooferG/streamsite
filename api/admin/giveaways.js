import { adminDb, FieldValue } from '../_lib/firebaseAdmin.js';
import { applyCors, requireAdmin } from '../_lib/verifyAuth.js';

// Admin giveaway lifecycle endpoint. POST { action, ...payload }.
//
// Actions:
//   create   { title, prize, keyword, weights: { base, discord, sub, vip, mod } }
//   close    { id }                       -> stop accepting entries
//   roll     { id }                       -> pick weighted winner, status='rolling'
//   reroll   { id }                       -> pick again silently from remaining
//   skip     { id }                       -> mark current pick skipped, then re-pick
//   confirm  { id, prizeNote? }           -> create redemption, status='rolled', close

function sanitizeWeights(w = {}) {
  const num = (v, dflt) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : dflt;
  };
  return {
    base: num(w.base, 1),
    discord: num(w.discord, 0),
    sub: num(w.sub, 0),
    vip: num(w.vip, 0),
    mod: num(w.mod, 0),
  };
}

function computeWeight(user, giveaway) {
  const w = giveaway.weights || {};
  let total = Number.isFinite(Number(w.base)) ? Number(w.base) : 1;
  if (w.discord && user.discordVerifiedAt) total += Number(w.discord) || 0;
  if (w.sub && user.isTwitchSub) total += Number(w.sub) || 0;
  if (w.vip && user.isVip) total += Number(w.vip) || 0;
  if (w.mod && user.isMod) total += Number(w.mod) || 0;
  return Math.max(1, Math.floor(total));
}

async function pickWeightedWinner(giveawayRef, excludeIds = []) {
  // Load all entries. Could optimize for huge giveaways with reservoir sampling
  // but for typical sizes (<10k) loading is fine.
  const snap = await giveawayRef.collection('entries').get();
  const pool = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((e) => !excludeIds.includes(e.id));
  if (pool.length === 0) return null;
  const total = pool.reduce((acc, e) => acc + (Number(e.weight) || 1), 0);
  let r = Math.random() * total;
  for (const e of pool) {
    r -= Number(e.weight) || 1;
    if (r <= 0) return e;
  }
  return pool[pool.length - 1];
}

async function clearWinnerStream(giveawayRef) {
  const snap = await giveawayRef.collection('winner_messages').get();
  if (snap.empty) return;
  const batch = adminDb.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

function trimEntry(entry) {
  if (!entry) return null;
  return {
    twitchId: entry.twitchId,
    twitchName: entry.twitchName,
    displayName: entry.displayName,
    profileImageUrl: entry.profileImageUrl || null,
    weight: entry.weight,
    source: entry.source,
  };
}

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { action, ...payload } = req.body || {};

  try {
    if (action === 'create') {
      const title = String(payload.title || '').trim();
      const prize = String(payload.prize || '').trim();
      const keyword = String(payload.keyword || '').trim().toLowerCase();
      if (!title || !prize || !keyword) {
        return res.status(400).json({ error: 'title, prize, keyword required' });
      }
      const weights = sanitizeWeights(payload.weights);
      const now = FieldValue.serverTimestamp();
      const ref = await adminDb.collection('giveaways').add({
        title,
        prize,
        keyword,
        weights,
        status: 'open',
        entryCount: 0,
        totalWeight: 0,
        winner: null,
        winnerTwitchId: null,
        skippedIds: [],
        startedAt: now,
        closedAt: null,
        rolledAt: null,
        confirmedAt: null,
        createdAt: now,
        createdBy: admin.email,
      });
      return res.status(200).json({ ok: true, id: ref.id });
    }

    // All other actions need an existing giveaway.
    const { id } = payload;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Missing id' });
    }
    const ref = adminDb.collection('giveaways').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'NOT_FOUND' });
    const giveaway = snap.data();

    if (action === 'close') {
      if (giveaway.status !== 'open') {
        return res.status(400).json({ error: 'NOT_OPEN' });
      }
      await ref.update({ status: 'closed', closedAt: FieldValue.serverTimestamp() });
      return res.status(200).json({ ok: true });
    }

    if (action === 'roll') {
      if (!['open', 'closed'].includes(giveaway.status)) {
        return res.status(400).json({ error: 'NOT_ROLLABLE' });
      }
      const winner = await pickWeightedWinner(ref, giveaway.skippedIds || []);
      if (!winner) return res.status(400).json({ error: 'NO_ENTRIES' });
      await clearWinnerStream(ref); // reset chat stream for the modal
      await ref.update({
        status: 'rolling',
        winner: trimEntry(winner),
        winnerTwitchId: winner.id,
        rolledAt: FieldValue.serverTimestamp(),
      });
      return res.status(200).json({ ok: true, winner: trimEntry(winner) });
    }

    if (action === 'reroll') {
      if (giveaway.status !== 'rolling') {
        return res.status(400).json({ error: 'NOT_ROLLING' });
      }
      const exclude = [giveaway.winnerTwitchId, ...(giveaway.skippedIds || [])].filter(Boolean);
      const winner = await pickWeightedWinner(ref, exclude);
      if (!winner) return res.status(400).json({ error: 'NO_MORE_ENTRIES' });
      await clearWinnerStream(ref);
      await ref.update({
        winner: trimEntry(winner),
        winnerTwitchId: winner.id,
        rolledAt: FieldValue.serverTimestamp(),
      });
      return res.status(200).json({ ok: true, winner: trimEntry(winner) });
    }

    if (action === 'skip') {
      if (giveaway.status !== 'rolling') {
        return res.status(400).json({ error: 'NOT_ROLLING' });
      }
      const skipped = giveaway.winner;
      const skippedIds = [...(giveaway.skippedIds || [])];
      if (giveaway.winnerTwitchId && !skippedIds.includes(giveaway.winnerTwitchId)) {
        skippedIds.push(giveaway.winnerTwitchId);
      }
      // Also append a history entry for visibility.
      const historyRef = ref.collection('history').doc();
      await historyRef.set({
        action: 'skip',
        entry: skipped,
        at: FieldValue.serverTimestamp(),
        by: admin.email,
      });
      const winner = await pickWeightedWinner(ref, skippedIds);
      if (!winner) {
        await ref.update({
          skippedIds,
          winner: null,
          winnerTwitchId: null,
          rolledAt: FieldValue.serverTimestamp(),
        });
        return res.status(400).json({ error: 'NO_MORE_ENTRIES' });
      }
      await clearWinnerStream(ref);
      await ref.update({
        skippedIds,
        winner: trimEntry(winner),
        winnerTwitchId: winner.id,
        rolledAt: FieldValue.serverTimestamp(),
      });
      return res.status(200).json({ ok: true, winner: trimEntry(winner) });
    }

    if (action === 'confirm') {
      if (giveaway.status !== 'rolling') {
        return res.status(400).json({ error: 'NOT_ROLLING' });
      }
      if (!giveaway.winner || !giveaway.winnerTwitchId) {
        return res.status(400).json({ error: 'NO_WINNER' });
      }
      const winner = giveaway.winner;
      const now = FieldValue.serverTimestamp();
      const redemptionRef = adminDb.collection('redemptions').doc();
      await redemptionRef.set({
        userId: giveaway.winnerTwitchId,
        twitchName: winner.twitchName || null,
        displayName: winner.displayName || null,
        profileImageUrl: winner.profileImageUrl || null,
        itemId: id, // giveaway id as item ref
        itemName: giveaway.prize,
        cost: 0,
        kind: 'giveaway',
        status: 'pending',
        note: payload.prizeNote || null,
        giveawayId: id,
        giveawayTitle: giveaway.title,
        createdAt: now,
        fulfilledAt: null,
      });
      await ref.update({
        status: 'rolled',
        confirmedAt: now,
        confirmedBy: admin.email,
        redemptionId: redemptionRef.id,
      });
      return res.status(200).json({ ok: true, redemptionId: redemptionRef.id });
    }

    if (action === 'delete') {
      // Hard delete giveaway and its subcollections. Useful for bad test data.
      const subcols = ['entries', 'winner_messages', 'history'];
      for (const sub of subcols) {
        const subSnap = await ref.collection(sub).get();
        if (!subSnap.empty) {
          // Batch up to 500 ops at a time.
          for (let i = 0; i < subSnap.docs.length; i += 400) {
            const batch = adminDb.batch();
            subSnap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
            await batch.commit();
          }
        }
      }
      await ref.delete();
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'UNKNOWN_ACTION' });
  } catch (err) {
    console.error('giveaways admin error', err);
    return res.status(500).json({ error: 'INTERNAL', detail: err.message });
  }
}
