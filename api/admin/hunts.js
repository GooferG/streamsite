import { adminDb, FieldValue } from '../_lib/firebaseAdmin.js';
import { applyCors, requireAdmin } from '../_lib/verifyAuth.js';
import {
  getCurrentHunt,
  getHunt,
  toRoundSnapshot,
  huntResult,
  CommunityHuntsError,
} from '../_lib/communityHunts.js';
import { buildWinners } from '../_lib/predictions.js';
import { sanitizeRewards, placeLabel } from '../_lib/predictionRewards.js';
import { openedMessage, lockedMessage, resultsMessage } from '../_lib/predictionChat.js';
import { sendChannelMessage } from '../_lib/twitchChat.js';

// Admin prediction-round lifecycle. A round can have payout predictions and/or
// slot suggestions enabled. Predictions go open -> locked -> settled, and only
// one prediction round can be open or locked at a time. Rounds snapshot
// GooferG's current communityhunts.gg hunt (or take a manual cost).
//
// POST { action, ...payload }

// Thrown inside actions (and transactions) to answer with a 4xx code.
class ActionError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

function parsePayout(value) {
  if (value === '' || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// Settling (and previewing it) needs a locked round, so no guess can change
// between the preview and the payout.
function assertLocked(round) {
  if (!round.acceptPredictions) throw new ActionError(400, 'PREDICTIONS_DISABLED');
  // A round can look 'locked' from a stale read while a settle transaction
  // already committed in between (see F1) — any sign of a past settle counts.
  if (round.status === 'settled' || round.settledAt || round.actual) {
    throw new ActionError(400, 'ALREADY_SETTLED');
  }
  if (round.status !== 'locked') throw new ActionError(400, 'NOT_LOCKED');
}

const MESSAGES = { opened: openedMessage, locked: lockedMessage, results: resultsMessage };
// Round statuses in which each chat line may post (null = any).
const EVENT_STATUSES = { opened: null, locked: ['locked', 'settled'], results: ['settled'] };

// Posts one chat line per round event. The event is claimed on the round in a
// transaction before posting, so two callers can't both post; a failed post
// releases the claim so Retry can post it. A chat failure never throws.
async function announceEvent(ref, event) {
  const claim = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new ActionError(404, 'NOT_FOUND');
    const round = snap.data();
    if (!round.announce) return { result: { posted: false, reason: 'disabled' } };
    const allowed = EVENT_STATUSES[event];
    if (allowed && !allowed.includes(round.status)) throw new ActionError(400, 'WRONG_STATUS');
    if (round.announced && round.announced[event]) {
      return { result: { posted: false, reason: 'already' } };
    }
    tx.update(ref, { [`announced.${event}`]: FieldValue.serverTimestamp() });
    return { round };
  });
  if (claim.result) return claim.result;

  try {
    await sendChannelMessage(MESSAGES[event](claim.round));
    return { posted: true };
  } catch (err) {
    console.error('prediction chat announce failed', err);
    // The release write can itself fail (e.g. the round vanished in between);
    // that must not mask the original chat error or throw out of this function.
    try {
      await ref.update({ [`announced.${event}`]: null });
    } catch (releaseErr) {
      console.error('prediction chat claim release failed', releaseErr);
    }
    return { posted: false, reason: err.message };
  }
}

// create and lock have already written the round; a chat problem must not
// turn that into an error response.
async function announceQuietly(ref, event) {
  try {
    return await announceEvent(ref, event);
  } catch (err) {
    console.error('prediction chat announce failed', err);
    return { posted: false, reason: err.code || err.message };
  }
}

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { action, ...payload } = req.body || {};

  try {
    if (action === 'preview_hunt') {
      const hunt = await getCurrentHunt();
      if (!hunt) return res.status(404).json({ error: 'NO_CURRENT_HUNT' });
      return res.status(200).json({ ok: true, snapshot: toRoundSnapshot(hunt) });
    }

    if (action === 'create') {
      const title = String(payload.title || '').trim();
      const contextNote = String(payload.contextNote || '').trim() || null;
      if (!title) return res.status(400).json({ error: 'title required' });

      const acceptPredictions = payload.acceptPredictions !== false;
      const acceptSuggestions = !!payload.acceptSuggestions;
      if (!acceptPredictions && !acceptSuggestions) {
        return res.status(400).json({ error: 'enable predictions or suggestions' });
      }

      const suggestionCapRaw = Number(payload.suggestionCap);
      const suggestionCap = acceptSuggestions
        ? (Number.isInteger(suggestionCapRaw) && suggestionCapRaw >= 1
            ? Math.min(20, suggestionCapRaw)
            : 3)
        : 0;

      const source = payload.source === 'manual' ? 'manual' : 'communityhunts';
      let bonusHuntSnapshot = null;
      let manualTotalCost = null;

      if (source === 'communityhunts') {
        const hunt = await getCurrentHunt();
        if (!hunt) return res.status(400).json({ error: 'NO_CURRENT_HUNT' });
        bonusHuntSnapshot = toRoundSnapshot(hunt);
      } else {
        manualTotalCost =
          payload.manualTotalCost === '' || payload.manualTotalCost == null
            ? null
            : Number(payload.manualTotalCost);
      }

      const rewards = sanitizeRewards(payload.rewards);
      // The chat lines are about guessing, so a suggestion-only round never posts.
      const announce = acceptPredictions && payload.announce !== false;
      const now = FieldValue.serverTimestamp();
      const huntsCol = adminDb.collection('hunts');
      const ref = huntsCol.doc();

      await adminDb.runTransaction(async (tx) => {
        // The viewer page shows only the newest round, so a new round would
        // hide an active prediction round.
        const active = await tx.get(huntsCol.where('status', 'in', ['open', 'locked']));
        if (active.docs.some((d) => d.data().acceptPredictions)) {
          throw new ActionError(400, 'ROUND_ACTIVE');
        }
        tx.set(ref, {
          title,
          contextNote,
          // Feature flags
          acceptPredictions,
          acceptSuggestions,
          suggestionCap,
          // Source data
          source,
          bonusHuntSnapshot,
          manualTotalCost,
          // Prediction config
          rewards,
          announce,
          announced: { opened: null, locked: null, results: null },
          // Prediction lifecycle state
          status: 'open',
          entryCount: 0,
          suggestionCount: 0,
          actual: null,
          winners: [],
          // Timestamps
          openedAt: now,
          lockedAt: null,
          settledAt: null,
          createdAt: now,
          createdBy: admin.email,
        });
      });
      const announceResult = announce
        ? await announceQuietly(ref, 'opened')
        : { posted: false, reason: 'disabled' };
      return res.status(200).json({ ok: true, id: ref.id, announce: announceResult });
    }

    // All other actions need an existing hunt.
    const { id } = payload;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const ref = adminDb.collection('hunts').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'NOT_FOUND' });
    const round = snap.data();

    if (action === 'hunt_result') {
      const huntId = round.bonusHuntSnapshot && round.bonusHuntSnapshot.huntId;
      if (round.source !== 'communityhunts' || !huntId) {
        return res.status(400).json({ error: 'NOT_COMMUNITYHUNTS_ROUND' });
      }
      const hunt = await getHunt(huntId);
      return res.status(200).json({ ok: true, result: huntResult(hunt) });
    }

    if (action === 'lock') {
      // Check-and-write in one transaction: a settle can commit between this
      // handler's initial `ref.get()` (above) and a plain `ref.update()` (see F1).
      await adminDb.runTransaction(async (tx) => {
        const fresh = await tx.get(ref);
        if (!fresh.exists) throw new ActionError(404, 'NOT_FOUND');
        const current = fresh.data();
        if (!current.acceptPredictions) throw new ActionError(400, 'PREDICTIONS_DISABLED');
        if (current.status !== 'open') throw new ActionError(400, 'NOT_OPEN');
        tx.update(ref, { status: 'locked', lockedAt: FieldValue.serverTimestamp() });
      });
      const announce = await announceQuietly(ref, 'locked');
      return res.status(200).json({ ok: true, announce });
    }

    if (action === 'reopen') {
      // Same check-and-write-in-a-transaction pattern as lock (F1).
      await adminDb.runTransaction(async (tx) => {
        const fresh = await tx.get(ref);
        if (!fresh.exists) throw new ActionError(404, 'NOT_FOUND');
        const current = fresh.data();
        if (current.status !== 'locked' || current.settledAt) {
          throw new ActionError(400, 'NOT_LOCKED');
        }
        // The next lock posts again, with the new guess count.
        tx.update(ref, { status: 'open', lockedAt: null, 'announced.locked': null });
      });
      return res.status(200).json({ ok: true });
    }

    if (action === 'preview_settle') {
      assertLocked(round);
      const actualPayout = parsePayout(payload.actualPayout);
      if (actualPayout == null) return res.status(400).json({ error: 'actualPayout required' });
      const entriesSnap = await ref.collection('entries').get();
      const entries = entriesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      return res.status(200).json({
        ok: true,
        actualPayout,
        entryCount: entries.length,
        placements: buildWinners(entries, round, actualPayout),
      });
    }

    if (action === 'settle') {
      const actualPayout = parsePayout(payload.actualPayout);
      if (actualPayout == null) return res.status(400).json({ error: 'actualPayout required' });

      // One transaction: a second settle (another tab, a mod) re-reads the
      // round, finds it settled and pays nothing.
      const winners = await adminDb.runTransaction(async (tx) => {
        const fresh = await tx.get(ref);
        if (!fresh.exists) throw new ActionError(404, 'NOT_FOUND');
        const current = fresh.data();
        assertLocked(current);
        const entriesSnap = await tx.get(ref.collection('entries'));
        const entries = entriesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const now = FieldValue.serverTimestamp();
        const settled = [];

        for (const winner of buildWinners(entries, current, actualPayout)) {
          if (!winner) continue;
          const place = placeLabel(winner.place);
          const { tickets, kind, amount, label } = winner.prize;

          if (tickets > 0) {
            // set+merge so a missing user doc can't fail the whole settle.
            tx.set(
              adminDb.collection('users').doc(winner.twitchId),
              {
                tickets: FieldValue.increment(tickets),
                totalEarned: FieldValue.increment(tickets),
                updatedAt: now,
              },
              { merge: true }
            );
            tx.set(adminDb.collection('ticket_ledger').doc(), {
              userId: winner.twitchId,
              delta: tickets,
              reason: 'prediction',
              refId: id,
              note: `Prediction ${place} place — ${current.title}`,
              createdAt: now,
            });
          }

          let redemptionId = null;
          if (label) {
            const redemptionRef = adminDb.collection('redemptions').doc();
            redemptionId = redemptionRef.id;
            tx.set(redemptionRef, {
              userId: winner.twitchId,
              twitchName: winner.twitchName,
              displayName: winner.displayName,
              profileImageUrl: winner.profileImageUrl,
              itemId: id,
              itemName: `${current.title} · ${place} place`,
              cost: 0,
              kind: 'prediction',
              status: 'pending',
              note: label,
              prizeKind: kind,
              prizeAmount: amount,
              predictionRoundId: id,
              huntId: id,
              createdAt: now,
              fulfilledAt: null,
            });
          }
          settled.push({ ...winner, redemptionId });
        }

        tx.update(ref, {
          actual: { payout: actualPayout },
          winners: settled,
          status: 'settled',
          settledAt: now,
          settledBy: admin.email,
        });
        return settled;
      });
      return res.status(200).json({ ok: true, winners });
    }

    if (action === 'announce') {
      const event = payload.event;
      if (!Object.prototype.hasOwnProperty.call(MESSAGES, event)) {
        return res.status(400).json({ error: 'INVALID_EVENT' });
      }
      const announce = await announceEvent(ref, event);
      return res.status(200).json({ ok: true, announce });
    }

    if (action === 'delete') {
      // Hard delete hunt + entries + suggestions subcollections.
      const subcols = ['entries', 'suggestions'];
      for (const sub of subcols) {
        const subSnap = await ref.collection(sub).get();
        if (!subSnap.empty) {
          for (let i = 0; i < subSnap.docs.length; i += 400) {
            const b = adminDb.batch();
            subSnap.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref));
            await b.commit();
          }
        }
      }
      await ref.delete();
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'UNKNOWN_ACTION' });
  } catch (err) {
    if (err instanceof ActionError) {
      return res.status(err.status).json({ error: err.code });
    }
    if (err instanceof CommunityHuntsError) {
      const notFound = err.status === 404;
      return res
        .status(notFound ? 404 : 502)
        .json({ error: notFound ? 'HUNT_NOT_FOUND' : 'COMMUNITYHUNTS_UNAVAILABLE', detail: err.code });
    }
    console.error('hunts admin error', err);
    return res.status(500).json({ error: 'INTERNAL', detail: err.message });
  }
}
