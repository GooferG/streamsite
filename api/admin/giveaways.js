import { adminDb, FieldValue } from '../_lib/firebaseAdmin.js';
import { applyCors, requireAdmin } from '../_lib/verifyAuth.js';
import { sendChannelMessage } from '../_lib/twitchChat.js';
import { normalizeKeyword } from '../_lib/giveawayKeyword.js';

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
//   create   { kind, buyAmount | prize, keyword, title?, weights, durationSec?,
//              autoRoll?, targetWinners?, requireFollow?, announce* / *Message }
//            kind 'bonus': each winner gets a bonus buy worth `buyAmount`,
//            played on stream; the actual win is logged with `payout`.
//            kind 'item': a plain prize (keys, merch), no play step.
//            durationSec > 0 sets `closesAt`; EventSub ignores entries after
//            it even if nobody closes the giveaway. The control-room engine
//            (in the tab holding the driver lock) closes it, and rolls with
//            autoRoll, when the clock runs out.
//   close    { id }                       -> stop accepting entries (transactional; losers get NOT_OPEN)
//   lastCall { id }                       -> post the last-call chat message
//                                            once (the control-room engine,
//                                            in the driving tab, fires it at
//                                            T-30s)
//   roll     { id }                       -> pick weighted winner, status='rolling'.
//                                            409 ROLL_RACE when another caller
//                                            rolled first (transactional)
//   reroll   { id }                       -> pick again silently from remaining
//   skip     { id }                       -> mark current pick skipped, then re-pick
//   announce { id, winnerTwitchId, rolledAtMs }
//                                         -> post the winner chat message for
//                                            the current pick, once. The
//                                            control-room engine (the driving
//                                            tab) calls it after the on-stream
//                                            reveal has played; posting at pick
//                                            time spoiled the reveal, since chat
//                                            runs seconds ahead of the video.
//   confirm  { id, prizeNote? }           -> create redemption, append to winners[].
//                                            Bonus buys go straight to 'playing'
//                                            for that winner; plain prizes stay
//                                            'rolling' so the operator can roll
//                                            another, go back, or end
//   play     { id, twitchId? }            -> status='playing' for a confirmed
//                                            winner (default: the current pick).
//                                            The overlay drops the big reveal for
//                                            a corner card so the slot is visible
//   setSlot  { id, twitchId?, slotName, slotImage?, provider? }
//                                         -> record which slot they're playing
//   payout   { id, twitchId?, amount }    -> log what the bonus actually paid.
//                                            Works on any confirmed winner, also
//                                            after the giveaway ended (fixes)
//   back     { id }                       -> leave the winner window without
//                                            ending: status returns to open/closed,
//                                            an unconfirmed pick is dropped
//   end      { id }                       -> status='rolled' (terminal)
//
// A giveaway can name several winners. Every confirmed winner is appended to
// `winners[]` and excluded from later draws, alongside `skippedIds`. `winner`
// / `winnerTwitchId` always describe the latest pick; after `end` they settle
// on the last confirmed winner so past lists keep working. `playing` holds the
// winner whose bonus is on stream, separate from the pick, so playing an
// earlier winner never re-triggers the pick's chat announcement.

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

function clampInt(value, min, max, dflt) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return dflt;
  return Math.min(max, Math.max(min, n));
}

function parseAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 10_000_000) return null;
  return Math.round(n * 100) / 100;
}

function formatMoney(value) {
  const n = Number(value) || 0;
  const cents = Math.round(n * 100) % 100 !== 0;
  return `$${n.toLocaleString('en-US', {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatMulti(payout, buy) {
  if (!(Number(buy) > 0)) return '';
  const m = Number(payout) / Number(buy);
  return `${m.toFixed(m < 10 ? 2 : m < 100 ? 1 : 0)}x`;
}

// Only accept slot art from a plain https URL; it is rendered on the overlay.
function cleanImage(url) {
  const s = String(url || '').trim();
  return /^https:\/\/[^\s"'<>]{1,500}$/.test(s) ? s : null;
}

function cleanText(value, max) {
  const s = String(value || '').trim().slice(0, max);
  return s || null;
}

// The `playing` block for a confirmed winner. Slot/payout carry over when
// replaying someone whose bonus was already partly logged.
function playingFor(winner, { fromConfirm = false } = {}) {
  return {
    twitchId: winner.twitchId,
    displayName: winner.displayName || null,
    twitchName: winner.twitchName || null,
    profileImageUrl: winner.profileImageUrl || null,
    slotName: winner.slotName || null,
    slotImage: winner.slotImage || null,
    provider: winner.provider || null,
    payout: winner.payout ?? null,
    payoutAt: null,
    startedAt: FieldValue.serverTimestamp(),
    fromConfirm,
  };
}

// Patch one confirmed winner inside winners[] (arrays can't be updated in
// place, so read-modify-write in a transaction). `extra` lands on the doc.
async function patchWinner(ref, twitchId, patch, extra = () => ({})) {
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const g = snap.data();
    const winners = [...(g.winners || [])];
    const i = winners.findIndex((w) => w.twitchId === twitchId);
    if (i === -1) return null;
    const before = winners[i];
    winners[i] = { ...before, ...patch };
    tx.update(ref, { winners, ...extra(g) });
    return { giveaway: g, before, winner: winners[i], index: i };
  });
}

// Claim a one-shot field inside a transaction so two admin tabs cannot both
// post the same chat message. Returns false when it was already claimed.
async function claimOnce(ref, field, value) {
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.get(field);
    if (current != null && (value === undefined || current === value)) return false;
    tx.update(ref, { [field]: value === undefined ? FieldValue.serverTimestamp() : value });
    return true;
  });
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

const tsMs = (ts) => (ts && typeof ts.toMillis === 'function' ? ts.toMillis() : null);

// Rollable from open/closed, from a bonus being played, or from the winner
// window once the pick on screen has been confirmed ("roll another").
function isRollable(giveaway) {
  return (
    ['open', 'closed', 'playing'].includes(giveaway.status) ||
    (giveaway.status === 'rolling' && currentPickConfirmed(giveaway))
  );
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
      const kind = payload.kind === 'bonus' ? 'bonus' : 'item';
      const buyAmount = kind === 'bonus' ? parseAmount(payload.buyAmount) : null;
      if (kind === 'bonus' && !(buyAmount > 0)) {
        return res.status(400).json({ error: 'bonus buy value required' });
      }
      const prize =
        kind === 'bonus'
          ? `${formatMoney(buyAmount)} bonus buy`
          : String(payload.prize || '').trim();
      const keyword = normalizeKeyword(payload.keyword);
      if (!prize || !keyword) {
        return res.status(400).json({ error: 'prize and keyword required' });
      }
      // The admin form fills a dated title when left blank; this is only the
      // fallback for direct API calls.
      const title = String(payload.title || '').trim() || 'Giveaway';
      const weights = sanitizeWeights(payload.weights);
      const announceStart = payload.announceStart !== false; // default true
      const announceWinner = payload.announceWinner !== false; // default true
      const requireFollow = payload.requireFollow !== false; // default true
      const startMessage = String(payload.startMessage || '').trim();
      const winnerMessage = String(payload.winnerMessage || '').trim();
      const lastCallMessage = String(payload.lastCallMessage || '').trim();
      const durationSec = clampInt(payload.durationSec, 0, 3600, 0);
      const closesAt = durationSec > 0 ? new Date(Date.now() + durationSec * 1000) : null;
      const now = FieldValue.serverTimestamp();
      const ref = await adminDb.collection('giveaways').add({
        kind,
        buyAmount,
        title,
        prize,
        keyword,
        weights,
        announceStart,
        announceWinner,
        requireFollow,
        startMessage: startMessage || null,
        winnerMessage: winnerMessage || null,
        durationSec,
        closesAt,
        autoRoll: durationSec > 0 && payload.autoRoll === true,
        announceLastCall: durationSec > 0 && payload.announceLastCall !== false,
        lastCallMessage: lastCallMessage || null,
        lastCallAt: null,
        targetWinners: clampInt(payload.targetWinners, 1, 20, 1),
        announcedPick: null,
        announcePayout: kind === 'bonus' && payload.announcePayout !== false,
        payoutMessage: cleanText(payload.payoutMessage, 400),
        playing: null,
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
      // Two browsers can hit zero on the same second. Only the transaction
      // that still sees 'open' closes it, and only that caller auto-rolls.
      const closed = await adminDb.runTransaction(async (tx) => {
        const cur = await tx.get(ref);
        if (!cur.exists || cur.data().status !== 'open') return false;
        tx.update(ref, { status: 'closed', closedAt: FieldValue.serverTimestamp() });
        return true;
      });
      if (!closed) return res.status(400).json({ error: 'NOT_OPEN' });
      return res.status(200).json({ ok: true });
    }

    if (action === 'lastCall') {
      if (giveaway.status !== 'open') {
        return res.status(400).json({ error: 'NOT_OPEN' });
      }
      if (!giveaway.announceLastCall || !giveaway.lastCallMessage) {
        return res.status(200).json({ ok: true, announce: { posted: false, reason: 'disabled' } });
      }
      if (!(await claimOnce(ref, 'lastCallAt'))) {
        return res.status(200).json({ ok: true, announce: { posted: false, reason: 'already' } });
      }
      const text = fillTemplate(giveaway.lastCallMessage, {
        keyword: giveaway.keyword,
        prize: giveaway.prize,
        title: giveaway.title,
      });
      const announce = await tryAnnounce(text);
      return res.status(200).json({ ok: true, announce });
    }

    if (action === 'announce') {
      // 'playing' too: a bonus-buy winner confirmed before the announce timer
      // fired has already moved on to playing their bonus.
      if (
        !['rolling', 'playing'].includes(giveaway.status) ||
        !giveaway.winner ||
        !giveaway.winnerTwitchId
      ) {
        return res.status(400).json({ error: 'NOT_ROLLING' });
      }
      const rolledAtMs = giveaway.rolledAt?.toMillis ? giveaway.rolledAt.toMillis() : null;
      // The page asked about a pick that has since been rerolled or skipped.
      if (
        payload.winnerTwitchId !== giveaway.winnerTwitchId ||
        Number(payload.rolledAtMs) !== rolledAtMs
      ) {
        return res.status(409).json({ error: 'STALE_PICK' });
      }
      if (giveaway.announceWinner === false || !giveaway.winnerMessage) {
        return res.status(200).json({ ok: true, announce: { posted: false, reason: 'disabled' } });
      }
      const key = `${giveaway.winnerTwitchId}:${rolledAtMs}`;
      if (!(await claimOnce(ref, 'announcedPick', key))) {
        return res.status(200).json({ ok: true, announce: { posted: false, reason: 'already' } });
      }
      const winner = giveaway.winner;
      const text = fillTemplate(giveaway.winnerMessage, {
        keyword: giveaway.keyword,
        prize: giveaway.prize,
        title: giveaway.title,
        winner: winner.displayName || winner.twitchName,
      });
      const announce = await tryAnnounce(text);
      // Release the claim on failure so the operator can retry from the modal.
      if (!announce.posted) await ref.update({ announcedPick: null });
      return res.status(200).json({ ok: true, announce });
    }

    if (action === 'roll') {
      if (!isRollable(giveaway)) {
        return res.status(400).json({ error: 'NOT_ROLLABLE' });
      }
      // The pick reads the entries subcollection, so it runs first; the
      // transaction then checks nobody rolled or moved the giveaway since.
      const winner = await pickWeightedWinner(ref, excludedIds(giveaway));
      if (!winner) return res.status(400).json({ error: 'NO_ENTRIES' });
      const seenStatus = giveaway.status;
      const seenRolledAt = tsMs(giveaway.rolledAt);
      const won = await adminDb.runTransaction(async (tx) => {
        const snapNow = await tx.get(ref);
        const cur = snapNow.exists ? snapNow.data() : null;
        if (!cur || cur.status !== seenStatus || tsMs(cur.rolledAt) !== seenRolledAt || !isRollable(cur)) {
          return false;
        }
        tx.update(ref, {
          status: 'rolling',
          winner: trimEntry(winner),
          winnerTwitchId: winner.id,
          rolledAt: FieldValue.serverTimestamp(),
          announcedPick: null,
          playing: null,
        });
        return true;
      });
      if (!won) return res.status(409).json({ error: 'ROLL_RACE' });
      // Reset the winner chat stream only after this pick is the one that
      // stuck, so a losing caller never wipes the real winner's messages.
      // The pick has already landed, so a failed cleanup is logged, not
      // reported as a failed roll.
      try {
        await clearWinnerStream(ref);
      } catch (err) {
        console.error('clear winner stream failed', err);
      }
      // Chat hears about the winner later, from `announce`, once the reveal
      // has played on stream.
      return res.status(200).json({ ok: true, winner: trimEntry(winner) });
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
        announcedPick: null,
      });
      // Chat hears about the winner later, from `announce`, once the reveal
      // has played on stream.
      return res.status(200).json({ ok: true, winner: trimEntry(winner) });
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
        // Nobody left to draw. Drop back to the entries (as `back` does) so
        // the giveaway is not stuck in 'rolling' with no pick and no controls.
        await clearWinnerStream(ref);
        await ref.update({
          status: giveaway.closedAt ? 'closed' : 'open',
          skippedIds,
          winner: null,
          winnerTwitchId: null,
          rolledAt: null,
          announcedPick: null,
        });
        return res.status(400).json({ error: 'NO_MORE_ENTRIES' });
      }
      await clearWinnerStream(ref);
      await ref.update({
        skippedIds,
        winner: trimEntry(winner),
        winnerTwitchId: winner.id,
        rolledAt: FieldValue.serverTimestamp(),
        announcedPick: null,
      });
      // Chat hears about the winner later, from `announce`, once the reveal
      // has played on stream.
      return res.status(200).json({ ok: true, winner: trimEntry(winner) });
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
      // Confirming does not end the giveaway. The pick is written down and
      // the operator decides what comes next. A bonus buy moves straight on
      // to playing it; a plain prize keeps the winner window up to roll
      // another, go back to entries, or end.
      const record = {
        ...trimEntry(winner),
        twitchId: giveaway.winnerTwitchId,
        redemptionId: redemptionRef.id,
        prizeNote: payload.prizeNote || null,
        confirmedAt: new Date().toISOString(),
        buyAmount: giveaway.kind === 'bonus' ? giveaway.buyAmount ?? null : null,
      };
      const update = {
        winners: FieldValue.arrayUnion(record),
        confirmedAt: now,
        confirmedBy: admin.email,
        redemptionId: redemptionRef.id,
      };
      if (giveaway.kind === 'bonus') {
        update.status = 'playing';
        update.playing = playingFor(record, { fromConfirm: true });
      }
      await ref.update(update);
      // No chat announce here. The winner was announced after the reveal.
      return res.status(200).json({ ok: true, redemptionId: redemptionRef.id });
    }

    if (action === 'play') {
      if (!['open', 'closed', 'rolling', 'playing'].includes(giveaway.status)) {
        return res.status(400).json({ error: 'NOT_LIVE' });
      }
      const twitchId = payload.twitchId || giveaway.winnerTwitchId;
      const winner = (giveaway.winners || []).find((w) => w.twitchId === twitchId);
      if (!winner) return res.status(400).json({ error: 'NOT_A_WINNER' });
      await ref.update({ status: 'playing', playing: playingFor(winner) });
      return res.status(200).json({ ok: true });
    }

    if (action === 'setSlot') {
      const twitchId = payload.twitchId || giveaway.playing?.twitchId;
      const slot = {
        slotName: cleanText(payload.slotName, 120),
        slotImage: cleanImage(payload.slotImage),
        provider: cleanText(payload.provider, 80),
      };
      const result = await patchWinner(ref, twitchId, slot, (g) =>
        g.status === 'playing' && g.playing?.twitchId === twitchId
          ? {
              'playing.slotName': slot.slotName,
              'playing.slotImage': slot.slotImage,
              'playing.provider': slot.provider,
            }
          : {}
      );
      if (!result) return res.status(400).json({ error: 'NOT_A_WINNER' });
      return res.status(200).json({ ok: true });
    }

    if (action === 'payout') {
      const twitchId = payload.twitchId || giveaway.playing?.twitchId;
      const amount = parseAmount(payload.amount);
      if (amount == null) return res.status(400).json({ error: 'BAD_AMOUNT' });
      const result = await patchWinner(
        ref,
        twitchId,
        { payout: amount, payoutAt: new Date().toISOString() },
        (g) =>
          g.status === 'playing' && g.playing?.twitchId === twitchId
            ? { 'playing.payout': amount, 'playing.payoutAt': FieldValue.serverTimestamp() }
            : {}
      );
      if (!result) return res.status(400).json({ error: 'NOT_A_WINNER' });
      const { giveaway: g, before, winner } = result;
      const buy = winner.buyAmount ?? g.buyAmount ?? null;

      // The redemption is what gets paid out, so it carries the real number.
      if (winner.redemptionId) {
        const parts = [g.prize];
        if (winner.slotName) parts.push(winner.slotName);
        parts.push(`paid ${formatMoney(amount)}`);
        await adminDb
          .collection('redemptions')
          .doc(winner.redemptionId)
          .update({
            itemName: parts.join(' · '),
            payout: amount,
            buyAmount: buy,
            slotName: winner.slotName || null,
          })
          .catch((err) => console.error('redemption payout update failed', err));
      }

      // Chat hears the first logged payout; corrections stay quiet.
      let announce = { posted: false, reason: 'disabled' };
      if (before.payout == null && g.announcePayout && g.payoutMessage) {
        announce = await tryAnnounce(
          fillTemplate(g.payoutMessage, {
            winner: winner.displayName || winner.twitchName,
            payout: formatMoney(amount),
            buy: buy != null ? formatMoney(buy) : '',
            multi: formatMulti(amount, buy),
            slot: winner.slotName || 'their slot',
            prize: g.prize,
            title: g.title,
          })
        );
      }
      return res.status(200).json({ ok: true, announce });
    }

    if (action === 'back') {
      // Leave the winner window without ending anything. Entries resume if
      // they were open before the roll. An unconfirmed pick is simply dropped;
      // Skip is the explicit way to exclude someone who went silent. From
      // 'playing' it just takes the bonus card off the overlay.
      if (!['rolling', 'playing'].includes(giveaway.status)) {
        return res.status(400).json({ error: 'NOT_ROLLING' });
      }
      await clearWinnerStream(ref);
      await ref.update({
        status: giveaway.closedAt ? 'closed' : 'open',
        winner: null,
        winnerTwitchId: null,
        rolledAt: null,
        announcedPick: null,
        playing: null,
      });
      return res.status(200).json({ ok: true });
    }

    if (action === 'end') {
      if (!['open', 'closed', 'rolling', 'playing'].includes(giveaway.status)) {
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
        playing: null,
      };
      if (!giveaway.confirmedAt) update.confirmedAt = now;
      if (['rolling', 'playing'].includes(giveaway.status)) await clearWinnerStream(ref);
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
