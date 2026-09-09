import { adminDb, FieldValue } from '../_lib/firebaseAdmin.js';
import { applyCors, requireAdmin } from '../_lib/verifyAuth.js';
import { sendChannelMessage } from '../_lib/twitchChat.js';

// Substitute template tokens in announcement text. Unknown tokens are
// left intact so the admin sees something is off.
function fillTemplate(tmpl, vars) {
  if (!tmpl) return '';
  return String(tmpl).replace(/\{(\w+)\}/g, (m, k) =>
    Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k] ?? '') : m
  );
}

async function tryAnnounce(text) {
  if (!text || !text.trim()) return { posted: false, reason: 'empty' };
  try {
    await sendChannelMessage(text);
    return { posted: true };
  } catch (err) {
    console.error('chat announce failed', err);
    return { posted: false, reason: err.message };
  }
}

// Admin giveaway lifecycle endpoint. POST { action, ...payload }.
//
// Actions:
//   create   { title, prize, keyword, weights: { base, registered, discord, sub, vip } }
//   close    { id }                       -> stop accepting entries
//   roll     { id }                       -> pick weighted winner, status='rolling'
//   reroll   { id }                       -> pick again silently from remaining
//   skip     { id }                       -> mark current pick skipped, then re-pick
//   confirm  { id, prizeNote? }           -> create redemption, append to winners[];
//                                            giveaway stays 'rolling' so the
//                                            operator can roll another, go back,
//                                            or end
//   back     { id }                       -> leave the winner window without
//                                            ending: status returns to open/closed,
//                                            an unconfirmed pick is dropped
//   end      { id }                       -> status='rolled' (terminal)
//
// A giveaway can name several winners. Every confirmed winner is appended to
// `winners[]` and excluded from later draws, alongside `skippedIds`. `winner`
// / `winnerTwitchId` always describe the CURRENT pick on screen; after `end`
// they settle on the last confirmed winner so past lists keep working.

function sanitizeWeights(w = {}) {
  const num = (v, dflt) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : dflt;
  };
  return {
    base: num(w.base, 1),
    registered: num(w.registered, 0),
    discord: num(w.discord, 0),
    sub: num(w.sub, 0),
    vip: num(w.vip, 0),
  };
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

// Every entry id that a fresh draw must not return: skipped picks and anyone
// already confirmed as a winner of this giveaway.
function excludedIds(giveaway, extra = []) {
  const won = (giveaway.winners || []).map((w) => w.twitchId);
  return [...new Set([...(giveaway.skippedIds || []), ...won, ...extra].filter(Boolean))];
}

function currentPickConfirmed(giveaway) {
  if (!giveaway.winnerTwitchId) return false;
  return (giveaway.winners || []).some((w) => w.twitchId === giveaway.winnerTwitchId);
}

function lastConfirmedWinner(giveaway) {
  const winners = giveaway.winners || [];
  return winners.length > 0 ? winners[winners.length - 1] : null;
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
    registered: entry.registered === true,
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
      const announceStart = payload.announceStart !== false; // default true
      const announceWinner = payload.announceWinner !== false; // default true
      const requireFollow = payload.requireFollow !== false; // default true
      const startMessage = String(payload.startMessage || '').trim();
      const winnerMessage = String(payload.winnerMessage || '').trim();
      const now = FieldValue.serverTimestamp();
      const ref = await adminDb.collection('giveaways').add({
        title,
        prize,
        keyword,
        weights,
        announceStart,
        announceWinner,
        requireFollow,
        startMessage: startMessage || null,
        winnerMessage: winnerMessage || null,
        status: 'open',
        entryCount: 0,
        totalWeight: 0,
        winner: null,
        winnerTwitchId: null,
        skippedIds: [],
        winners: [],
        startedAt: now,
        closedAt: null,
        rolledAt: null,
        confirmedAt: null,
        endedAt: null,
        createdAt: now,
        createdBy: admin.email,
      });

      let announce = { posted: false, reason: 'disabled' };
      if (announceStart && startMessage) {
        const text = fillTemplate(startMessage, { keyword, prize, title });
        announce = await tryAnnounce(text);
      }
      return res.status(200).json({ ok: true, id: ref.id, announce });
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

    // Helper: fire winner announce in chat for a freshly picked entry.
    const fireWinnerAnnounce = async (winner) => {
      if (giveaway.announceWinner === false || !giveaway.winnerMessage) {
        return { posted: false, reason: 'disabled' };
      }
      const text = fillTemplate(giveaway.winnerMessage, {
        keyword: giveaway.keyword,
        prize: giveaway.prize,
        title: giveaway.title,
        winner: winner.displayName || winner.twitchName,
      });
      return tryAnnounce(text);
    };

    if (action === 'roll') {
      // Rollable from open/closed, or from the winner window once the pick on
      // screen has been confirmed. That is "roll another" for a second prize.
      const rollable =
        ['open', 'closed'].includes(giveaway.status) ||
        (giveaway.status === 'rolling' && currentPickConfirmed(giveaway));
      if (!rollable) {
        return res.status(400).json({ error: 'NOT_ROLLABLE' });
      }
      const winner = await pickWeightedWinner(ref, excludedIds(giveaway));
      if (!winner) return res.status(400).json({ error: 'NO_ENTRIES' });
      await clearWinnerStream(ref); // reset chat stream for the modal
      await ref.update({
        status: 'rolling',
        winner: trimEntry(winner),
        winnerTwitchId: winner.id,
        rolledAt: FieldValue.serverTimestamp(),
      });
      const announce = await fireWinnerAnnounce(winner);
      return res.status(200).json({ ok: true, winner: trimEntry(winner), announce });
    }

    if (action === 'reroll') {
      if (giveaway.status !== 'rolling') {
        return res.status(400).json({ error: 'NOT_ROLLING' });
      }
      if (currentPickConfirmed(giveaway)) {
        return res.status(400).json({ error: 'ALREADY_CONFIRMED' });
      }
      const winner = await pickWeightedWinner(ref, excludedIds(giveaway, [giveaway.winnerTwitchId]));
      if (!winner) return res.status(400).json({ error: 'NO_MORE_ENTRIES' });
      await clearWinnerStream(ref);
      await ref.update({
        winner: trimEntry(winner),
        winnerTwitchId: winner.id,
        rolledAt: FieldValue.serverTimestamp(),
      });
      const announce = await fireWinnerAnnounce(winner);
      return res.status(200).json({ ok: true, winner: trimEntry(winner), announce });
    }

    if (action === 'skip') {
      if (giveaway.status !== 'rolling') {
        return res.status(400).json({ error: 'NOT_ROLLING' });
      }
      if (currentPickConfirmed(giveaway)) {
        return res.status(400).json({ error: 'ALREADY_CONFIRMED' });
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
      const winner = await pickWeightedWinner(ref, excludedIds({ ...giveaway, skippedIds }));
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
      const announce = await fireWinnerAnnounce(winner);
      return res.status(200).json({ ok: true, winner: trimEntry(winner), announce });
    }

    if (action === 'confirm') {
      if (giveaway.status !== 'rolling') {
        return res.status(400).json({ error: 'NOT_ROLLING' });
      }
      if (!giveaway.winner || !giveaway.winnerTwitchId) {
        return res.status(400).json({ error: 'NO_WINNER' });
      }
      if (currentPickConfirmed(giveaway)) {
        return res.status(400).json({ error: 'ALREADY_CONFIRMED' });
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
      // Confirming does not end the giveaway. The pick is written down, the
      // window stays up, and the operator decides what comes next: roll
      // another for a second prize, go back to entries, or end it.
      const record = {
        ...trimEntry(winner),
        twitchId: giveaway.winnerTwitchId,
        redemptionId: redemptionRef.id,
        prizeNote: payload.prizeNote || null,
        confirmedAt: new Date().toISOString(),
      };
      await ref.update({
        winners: FieldValue.arrayUnion(record),
        confirmedAt: now,
        confirmedBy: admin.email,
        redemptionId: redemptionRef.id,
      });
      // No chat announce here. The winner is already announced at pick time.
      return res.status(200).json({ ok: true, redemptionId: redemptionRef.id });
    }

    if (action === 'back') {
      // Leave the winner window without ending anything. Entries resume if
      // they were open before the roll. An unconfirmed pick is simply dropped;
      // Skip is the explicit way to exclude someone who went silent.
      if (giveaway.status !== 'rolling') {
        return res.status(400).json({ error: 'NOT_ROLLING' });
      }
      await clearWinnerStream(ref);
      await ref.update({
        status: giveaway.closedAt ? 'closed' : 'open',
        winner: null,
        winnerTwitchId: null,
        rolledAt: null,
      });
      return res.status(200).json({ ok: true });
    }

    if (action === 'end') {
      if (!['open', 'closed', 'rolling'].includes(giveaway.status)) {
        return res.status(400).json({ error: 'NOT_LIVE' });
      }
      const now = FieldValue.serverTimestamp();
      // Settle `winner` on the last confirmed winner so past lists and the
      // users API keep a single "the winner" to point at. An unconfirmed pick
      // on screen is dropped, never recorded.
      const settled = currentPickConfirmed(giveaway)
        ? giveaway.winner
        : lastConfirmedWinner(giveaway);
      const update = {
        status: 'rolled',
        endedAt: now,
        endedBy: admin.email,
        winner: settled ? trimEntry(settled) : null,
        winnerTwitchId: settled
          ? settled.twitchId || giveaway.winnerTwitchId
          : null,
      };
      if (!giveaway.confirmedAt) update.confirmedAt = now;
      if (giveaway.status === 'rolling') await clearWinnerStream(ref);
      await ref.update(update);
      return res.status(200).json({ ok: true, winners: (giveaway.winners || []).length });
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
