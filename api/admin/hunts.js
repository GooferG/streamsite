import { adminDb, FieldValue } from '../_lib/firebaseAdmin.js';
import { applyCors, requireAdmin } from '../_lib/verifyAuth.js';
import {
  getCurrentHunt,
  getHunt,
  toRoundSnapshot,
  huntResult,
  CommunityHuntsError,
} from '../_lib/communityHunts.js';
import { pickWinners } from '../_lib/predictions.js';

// Admin prediction-round lifecycle. A round can have payout predictions and/or
// slot suggestions enabled. Predictions go open -> locked -> settled. Rounds
// snapshot GooferG's current communityhunts.gg hunt (or take a manual cost).
//
// POST { action, ...payload }

function sanitizeTier(tier) {
  if (!tier) return null;
  const place = Number(tier.place);
  if (!Number.isInteger(place) || place < 1 || place > 3) return null;
  const tickets =
    tier.tickets === '' || tier.tickets == null
      ? null
      : Math.max(0, Math.floor(Number(tier.tickets)));
  const cashLabel =
    tier.cashLabel && typeof tier.cashLabel === 'string'
      ? tier.cashLabel.trim().slice(0, 80) || null
      : null;
  if (tickets == null && !cashLabel) return null;
  return { place, tickets, cashLabel };
}

function sanitizeRewards(input) {
  const validTypes = ['tickets', 'cash', 'both'];
  const type = validTypes.includes(input?.type) ? input.type : 'tickets';
  const tiers = Array.isArray(input?.tiers)
    ? input.tiers.map(sanitizeTier).filter(Boolean)
    : [];
  const places = new Set(tiers.map((t) => t.place));
  if (!places.has(1)) tiers.push({ place: 1, tickets: 0, cashLabel: null });
  if (!places.has(2)) tiers.push({ place: 2, tickets: 0, cashLabel: null });
  tiers.sort((a, b) => a.place - b.place);
  return { type, tiers };
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
      const now = FieldValue.serverTimestamp();

      const ref = await adminDb.collection('hunts').add({
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
      return res.status(200).json({ ok: true, id: ref.id });
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
      if (!round.acceptPredictions) {
        return res.status(400).json({ error: 'PREDICTIONS_DISABLED' });
      }
      if (round.status !== 'open') return res.status(400).json({ error: 'NOT_OPEN' });
      await ref.update({ status: 'locked', lockedAt: FieldValue.serverTimestamp() });
      return res.status(200).json({ ok: true });
    }

    if (action === 'reopen') {
      if (round.status !== 'locked') return res.status(400).json({ error: 'NOT_LOCKED' });
      await ref.update({ status: 'open', lockedAt: null });
      return res.status(200).json({ ok: true });
    }

    if (action === 'settle') {
      if (!round.acceptPredictions) {
        return res.status(400).json({ error: 'PREDICTIONS_DISABLED' });
      }
      if (!['open', 'locked'].includes(round.status)) {
        return res.status(400).json({ error: 'NOT_SETTLEABLE' });
      }
      const actualPayout = Number(payload.actualPayout);
      if (payload.actualPayout === '' || payload.actualPayout == null || !Number.isFinite(actualPayout)) {
        return res.status(400).json({ error: 'actualPayout required' });
      }

      const entriesSnap = await ref.collection('entries').get();
      const entries = entriesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const placements = pickWinners(entries, { ...round, actual: { payout: actualPayout } });

      const winners = [];
      const now = FieldValue.serverTimestamp();
      const batch = adminDb.batch();

      for (let i = 0; i < placements.length; i++) {
        const place = round.rewards.tiers[i]?.place ?? i + 1;
        const tier = round.rewards.tiers[i];
        const e = placements[i];
        if (!e) continue;

        const winnerObj = {
          place,
          twitchId: e.twitchId,
          twitchName: e.twitchName,
          displayName: e.displayName,
          profileImageUrl: e.profileImageUrl || null,
          payoutGuess: typeof e.payoutGuess === 'number' ? e.payoutGuess : null,
          diff:
            typeof e.payoutDiff === 'number' && Number.isFinite(e.payoutDiff)
              ? e.payoutDiff
              : null,
          prize: { tickets: tier?.tickets || null, cashLabel: tier?.cashLabel || null },
          redemptionId: null,
        };

        if (tier?.tickets && tier.tickets > 0) {
          const userRef = adminDb.collection('users').doc(e.twitchId);
          batch.update(userRef, {
            tickets: FieldValue.increment(tier.tickets),
            totalEarned: FieldValue.increment(tier.tickets),
            updatedAt: now,
          });
          const ledgerRef = adminDb.collection('ticket_ledger').doc();
          batch.set(ledgerRef, {
            userId: e.twitchId,
            delta: tier.tickets,
            reason: 'prediction',
            refId: id,
            note: `Prediction ${place === 1 ? '1st' : place === 2 ? '2nd' : '3rd'} place — ${round.title}`,
            createdAt: now,
          });
        }

        if (tier?.cashLabel) {
          const redemptionRef = adminDb.collection('redemptions').doc();
          batch.set(redemptionRef, {
            userId: e.twitchId,
            twitchName: e.twitchName || null,
            displayName: e.displayName || null,
            profileImageUrl: e.profileImageUrl || null,
            itemId: id,
            itemName: `${round.title} · ${place === 1 ? '1st' : place === 2 ? '2nd' : '3rd'} place`,
            cost: 0,
            kind: 'prediction',
            status: 'pending',
            note: tier.cashLabel,
            predictionRoundId: id,
            huntId: id,
            createdAt: now,
            fulfilledAt: null,
          });
          winnerObj.redemptionId = redemptionRef.id;
        }
        winners.push(winnerObj);
      }

      batch.update(ref, {
        actual: { payout: actualPayout },
        winners,
        status: 'settled',
        settledAt: now,
        settledBy: admin.email,
      });

      await batch.commit();
      return res.status(200).json({ ok: true, winners });
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
