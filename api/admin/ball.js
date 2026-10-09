import { randomInt } from 'node:crypto';
import { adminDb, FieldValue, Timestamp } from '../_lib/firebaseAdmin.js';
import { applyCors, requireAdmin } from '../_lib/verifyAuth.js';
import { CommunityHuntsError, getHunt } from '../_lib/communityHunts.js';
import { prizeLabel } from '../_lib/predictionRewards.js';
import { resultRows, sanitizeOverrides, winnerOf } from '../_lib/ballResults.js';
import { sendChannelMessage } from '../_lib/twitchChat.js';
import {
  ACTIVE_STATUSES,
  DRAW_REVEAL_MS,
  drawKey,
  drawLine,
  formatMulti,
  hasPrize,
  openedLine,
  resultsLine,
  sanitizeBallPrize,
  scratchLine,
  slotKey,
} from '../_lib/ballRules.js';

// Goofer Ball staff endpoint (spec: Staff API). POST { action, id?, ... }.
// One round can be open or closed at a time. Entries come from chat
// (api/_lib/slotCommand.js), never from here.

class ActionError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

const rounds = () => adminDb.collection('ball_rounds');
const tsMs = (ts) => (ts && typeof ts.toMillis === 'function' ? ts.toMillis() : null);
// A draw line may post this much before the reveal ends (clock skew between
// the driving staff browser and the server).
const EARLY_SLACK_MS = 1000;

// Check-and-write in one transaction so two staff tabs can't interleave.
async function mutate(ref, fn) {
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new ActionError(404, 'NOT_FOUND');
    return fn(tx, snap.data());
  });
}

function assertActive(round) {
  if (!ACTIVE_STATUSES.includes(round.status)) throw new ActionError(400, 'FINAL');
}

const findEntry = (round, drawNo) => (round.rack || []).find((e) => e.drawNo === Number(drawNo)) || null;

// Claims one chat line on the round in a transaction, then posts it, so two
// callers can't both post. A failed post releases the claim for a retry.
async function announceEvent(ref, event, drawNo, nowMs) {
  const claim = await mutate(ref, async (tx, round) => {
    const announced = round.announced || {};
    let field;
    let text;
    if (event === 'opened') {
      if (announced.opened) return null;
      field = 'announced.opened';
      text = openedLine(round);
    } else if (event === 'draw' || event === 'scratch') {
      const entry = findEntry(round, drawNo);
      if (!entry) throw new ActionError(400, 'NOT_DRAWN');
      const bucket = event === 'draw' ? 'draws' : 'scratches';
      if (announced[bucket] && announced[bucket][drawKey(entry.drawNo)]) return null;
      if (event === 'draw') {
        if (entry.scratched) return { skip: 'scratched' };
        const at = tsMs(entry.drawnAt);
        // Chat runs ahead of the video: a line before the reveal spoils it.
        if (at != null && nowMs < at + DRAW_REVEAL_MS - EARLY_SLACK_MS) throw new ActionError(409, 'TOO_EARLY');
        text = drawLine(entry);
      } else {
        if (!entry.scratched) throw new ActionError(400, 'NOT_SCRATCHED');
        text = scratchLine(entry);
      }
      field = `announced.${bucket}.${drawKey(entry.drawNo)}`;
    } else if (event === 'results') {
      if (round.status !== 'settled' || !round.winner) throw new ActionError(400, 'NOT_SETTLED');
      if (announced.results) return null;
      field = 'announced.results';
      text = resultsLine(round);
    } else {
      throw new ActionError(400, 'INVALID_EVENT');
    }
    tx.update(ref, { [field]: FieldValue.serverTimestamp() });
    return { field, text };
  });
  if (!claim) return { posted: false, reason: 'already' };
  if (claim.skip) return { posted: false, reason: claim.skip };
  try {
    await sendChannelMessage(claim.text);
    return { posted: true };
  } catch (err) {
    console.error('ball chat announce failed', err);
    try {
      await ref.update({ [claim.field]: null });
    } catch (releaseErr) {
      console.error('ball chat claim release failed', releaseErr);
    }
    return { posted: false, reason: err.message };
  }
}

// open and scratch have already written; a chat problem must not turn that
// into an error response.
async function announceQuietly(ref, event, drawNo, nowMs) {
  try {
    return await announceEvent(ref, event, drawNo, nowMs);
  } catch (err) {
    console.error('ball chat announce failed', err);
    return { posted: false, reason: err.code || err.message };
  }
}

// Settling (and previewing it) needs a closed round, so no new draw can land
// between the preview and the payout. Scratches are still allowed on a closed
// round, so settle re-reads and re-ranks the rack inside its transaction.
function assertClosed(round) {
  if (round.status === 'settled' || round.settledAt) throw new ActionError(400, 'ALREADY_SETTLED');
  if (round.status !== 'closed') throw new ActionError(400, 'NOT_CLOSED');
}

// The linked hunt's bonus rows. A communityhunts outage leaves an empty list
// and a flag, so a fully manual payout table can still settle.
async function huntBonuses(round) {
  if (!round.huntId) return { bonuses: [], huntError: null };
  try {
    const hunt = await getHunt(round.huntId);
    if (!hunt) return { bonuses: [], huntError: 'HUNT_NOT_FOUND' };
    return { bonuses: Array.isArray(hunt.bonuses) ? hunt.bonuses : [], huntError: null };
  } catch (err) {
    if (err instanceof CommunityHuntsError) {
      return { bonuses: [], huntError: err.status === 404 ? 'HUNT_NOT_FOUND' : 'COMMUNITYHUNTS_UNAVAILABLE' };
    }
    throw err;
  }
}

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { action, ...payload } = req.body || {};
  const nowMs = Date.now();

  try {
    if (action === 'open') {
      const prize = sanitizeBallPrize(payload.prize);
      if (!hasPrize(prize)) return res.status(400).json({ error: 'INVALID_PRIZE' });
      const ref = rounds().doc();
      await adminDb.runTransaction(async (tx) => {
        const active = await tx.get(rounds().where('status', 'in', ACTIVE_STATUSES));
        if (!active.empty) throw new ActionError(400, 'ROUND_ACTIVE');
        tx.set(ref, {
          status: 'open',
          prize,
          requireFollow: payload.requireFollow !== false,
          rack: [],
          lastDrawAt: null,
          huntId: null,
          results: null,
          winner: null,
          announced: { opened: null, draws: {}, scratches: {}, results: null },
          openedAt: FieldValue.serverTimestamp(),
          closedAt: null,
          settledAt: null,
          cancelledAt: null,
          openedBy: admin.email,
        });
      });
      const announce = await announceQuietly(ref, 'opened', null, nowMs);
      return res.status(200).json({ ok: true, id: ref.id, announce });
    }

    const { id } = payload;
    if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Missing id' });
    const ref = rounds().doc(id);

    if (action === 'update_prize') {
      const prize = sanitizeBallPrize(payload.prize);
      if (!hasPrize(prize)) return res.status(400).json({ error: 'INVALID_PRIZE' });
      await mutate(ref, async (tx, round) => {
        assertActive(round);
        tx.update(ref, { prize });
      });
      return res.status(200).json({ ok: true, prize });
    }

    if (action === 'draw') {
      const entry = await mutate(ref, async (tx, round) => {
        if (round.status !== 'open') throw new ActionError(400, 'NOT_OPEN');
        const last = tsMs(round.lastDrawAt);
        if (last != null && nowMs < last + DRAW_REVEAL_MS) throw new ActionError(409, 'DRAW_BUSY');
        const drum = await tx.get(ref.collection('balls').where('status', '==', 'drum'));
        if (drum.empty) throw new ActionError(400, 'EMPTY_DRUM');
        const pick = drum.docs[randomInt(drum.docs.length)];
        const ball = pick.data();
        const rack = round.rack || [];
        // Arrays can't hold serverTimestamp(); the overlay times the reveal
        // off this value, so it is the server's clock at draw time.
        const drawnAt = Timestamp.fromMillis(nowMs);
        const next = {
          drawNo: rack.length + 1,
          twitchId: pick.id,
          twitchName: ball.twitchName || null,
          displayName: ball.displayName || null,
          slotId: ball.slotId,
          slotName: ball.slotName,
          thumb: ball.thumb || null,
          drawnAt,
          scratched: false,
        };
        tx.update(pick.ref, { status: 'drawn', drawNo: next.drawNo, updatedAt: FieldValue.serverTimestamp() });
        tx.update(ref, { rack: [...rack, next], lastDrawAt: drawnAt });
        return next;
      });
      return res.status(200).json({ ok: true, entry: { ...entry, drawnAt: nowMs } });
    }

    if (action === 'scratch') {
      const drawNo = Number(payload.drawNo);
      const entry = await mutate(ref, async (tx, round) => {
        assertActive(round);
        const rack = round.rack || [];
        const i = rack.findIndex((e) => e.drawNo === drawNo);
        if (i === -1) throw new ActionError(400, 'NOT_DRAWN');
        if (rack[i].scratched) throw new ActionError(400, 'ALREADY_SCRATCHED');
        const ballRef = ref.collection('balls').doc(rack[i].twitchId);
        const ballSnap = await tx.get(ballRef);
        const next = rack.map((e, j) => (j === i ? { ...e, scratched: true } : e));
        // The viewer may have been scratched before and called again; only
        // touch the ball if it is still this draw.
        if (ballSnap.exists && ballSnap.data().drawNo === drawNo) {
          tx.update(ballRef, { status: 'scratched', updatedAt: FieldValue.serverTimestamp() });
        }
        // The slot stays blocked for the round (it was scratched for being unavailable).
        tx.set(ref.collection('claims').doc(slotKey(rack[i].slotId)), { scratched: true }, { merge: true });
        tx.update(ref, { rack: next });
        return next[i];
      });
      const announce = await announceQuietly(ref, 'scratch', drawNo, nowMs);
      return res.status(200).json({ ok: true, entry, announce });
    }

    if (action === 'close') {
      await mutate(ref, async (tx, round) => {
        if (round.status !== 'open') throw new ActionError(400, 'NOT_OPEN');
        tx.update(ref, { status: 'closed', closedAt: FieldValue.serverTimestamp() });
      });
      return res.status(200).json({ ok: true });
    }

    if (action === 'reopen') {
      await mutate(ref, async (tx, round) => {
        if (round.status !== 'closed') throw new ActionError(400, 'NOT_CLOSED');
        tx.update(ref, { status: 'open', closedAt: null });
      });
      return res.status(200).json({ ok: true });
    }

    if (action === 'cancel') {
      await mutate(ref, async (tx, round) => {
        assertActive(round);
        tx.update(ref, { status: 'cancelled', cancelledAt: FieldValue.serverTimestamp() });
      });
      return res.status(200).json({ ok: true });
    }

    if (action === 'link_hunt') {
      const huntId = payload.huntId ? String(payload.huntId) : null;
      // Throws CommunityHuntsError (404 → HUNT_NOT_FOUND) for a hunt that isn't there.
      if (huntId && !(await getHunt(huntId))) throw new ActionError(404, 'HUNT_NOT_FOUND');
      await mutate(ref, async (tx, round) => {
        assertActive(round);
        tx.update(ref, { huntId });
      });
      return res.status(200).json({ ok: true, huntId });
    }

    if (action === 'announce') {
      const announce = await announceEvent(ref, payload.event, payload.drawNo, nowMs);
      return res.status(200).json({ ok: true, announce });
    }

    if (action === 'preview_settle') {
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: 'NOT_FOUND' });
      const round = snap.data();
      assertClosed(round);
      const { bonuses, huntError } = await huntBonuses(round);
      const rows = resultRows(round, bonuses, sanitizeOverrides(payload.overrides));
      return res.status(200).json({ ok: true, rows, winner: winnerOf(rows), prize: round.prize, huntError });
    }

    if (action === 'settle') {
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: 'NOT_FOUND' });
      assertClosed(snap.data());
      const overrides = sanitizeOverrides(payload.overrides);
      // Network first; the transaction re-checks the round and re-ranks.
      const fetchedHuntId = snap.data().huntId || null;
      const { bonuses, huntError } = await huntBonuses(snap.data());
      if (huntError) {
        // Hunt numbers are missing: only a table that is fully manual may settle.
        const manual = (snap.data().rack || [])
          .filter((e) => !e.scratched)
          .every((e) => overrides[e.drawNo] && overrides[e.drawNo].multiplier != null);
        if (!manual) throw new ActionError(502, huntError);
      }
      const expectDrawNo = Number(payload.expectDrawNo);
      const winner = await mutate(ref, async (tx, current) => {
        assertClosed(current);
        if ((current.huntId || null) !== fetchedHuntId) throw new ActionError(409, 'HUNT_CHANGED');
        const rows = resultRows(current, bonuses, overrides);
        const top = winnerOf(rows);
        if (!top) throw new ActionError(400, 'NO_RESULTS');
        if (Number.isInteger(expectDrawNo) && expectDrawNo > 0 && top.drawNo !== expectDrawNo) {
          throw new ActionError(409, 'WINNER_CHANGED');
        }
        const now = FieldValue.serverTimestamp();
        const prize = current.prize || { tickets: 0, prize: null };
        const multi = formatMulti(top.multiplier);

        const results = {};
        for (const r of rows) {
          if (r.multiplier != null) results[r.drawNo] = { multiplier: r.multiplier, win: r.win, bet: r.bet, source: r.source };
        }

        if (prize.tickets > 0) {
          // set+merge so a viewer who never signed in still gets paid.
          tx.set(
            adminDb.collection('users').doc(top.twitchId),
            { tickets: FieldValue.increment(prize.tickets), totalEarned: FieldValue.increment(prize.tickets), updatedAt: now },
            { merge: true }
          );
          tx.set(adminDb.collection('ticket_ledger').doc(), {
            userId: top.twitchId,
            delta: prize.tickets,
            reason: 'goofer_ball',
            refId: id,
            note: `Goofer Ball winner — ${top.slotName} ${multi}`,
            createdAt: now,
          });
        }

        let redemptionId = null;
        const label = prizeLabel(prize.prize);
        if (label) {
          const redemptionRef = adminDb.collection('redemptions').doc();
          redemptionId = redemptionRef.id;
          tx.set(redemptionRef, {
            userId: top.twitchId,
            twitchName: top.twitchName,
            displayName: top.displayName,
            profileImageUrl: null,
            itemId: id,
            itemName: `Goofer Ball · ${top.slotName} ${multi}`,
            cost: 0,
            kind: 'goofer_ball',
            status: 'pending',
            note: label,
            prizeKind: prize.prize.kind,
            prizeAmount: prize.prize.amount,
            ballRoundId: id,
            createdAt: now,
            fulfilledAt: null,
          });
        }

        const winnerDoc = {
          drawNo: top.drawNo,
          twitchId: top.twitchId,
          twitchName: top.twitchName,
          displayName: top.displayName,
          slotId: top.slotId,
          slotName: top.slotName,
          thumb: top.thumb,
          multiplier: top.multiplier,
          win: top.win,
          redemptionId,
        };
        tx.update(ref, { results, winner: winnerDoc, status: 'settled', settledAt: now, settledBy: admin.email });
        return winnerDoc;
      });
      return res.status(200).json({ ok: true, winner });
    }

    return res.status(400).json({ error: 'UNKNOWN_ACTION' });
  } catch (err) {
    if (err instanceof ActionError) return res.status(err.status).json({ error: err.code });
    if (err instanceof CommunityHuntsError) {
      const notFound = err.status === 404;
      return res
        .status(notFound ? 404 : 502)
        .json({ error: notFound ? 'HUNT_NOT_FOUND' : 'COMMUNITYHUNTS_UNAVAILABLE', detail: err.code });
    }
    console.error('ball admin error', err);
    return res.status(500).json({ error: 'INTERNAL', detail: err.message });
  }
}
