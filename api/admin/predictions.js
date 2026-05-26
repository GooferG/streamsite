import { adminDb, FieldValue } from '../_lib/firebaseAdmin.js';
import { applyCors, requireAdmin } from '../_lib/verifyAuth.js';

// Admin prediction round lifecycle: create / lock / settle / delete.
// POST { action, ...payload }
//
// Reused data:
//   - bonushunt.gg snapshot (from existing bonus-hunts.gg public API)

const BONUSHUNT_API = 'https://bonushunt.gg/api/public';
const BONUSHUNT_KEY = process.env.BONUSHUNT_API_KEY ||
  'bnt_b493e9020cf2ecb1e4a8043cb1ea1941a8555a1fa2c90e62f411b6cdb0aba14c';

async function fetchCurrentHunt() {
  const r = await fetch(`${BONUSHUNT_API}/hunts`, {
    headers: { Authorization: `Bearer ${BONUSHUNT_KEY}` },
  });
  if (!r.ok) throw new Error(`BONUSHUNT_${r.status}`);
  const data = await r.json();
  const list = Array.isArray(data) ? data : data.hunts ?? data.data ?? [];
  // Pick the most recent hunt that's in-progress (not yet fully opened) OR
  // the most recently created. Real-world: streamer's latest is usually the
  // one they want.
  list.sort(
    (a, b) =>
      new Date(b.created_at ?? b.createdAt ?? 0) -
      new Date(a.created_at ?? a.createdAt ?? 0)
  );
  return list[0] || null;
}

function snapshotHunt(hunt) {
  if (!hunt) return null;
  const bonuses = hunt.bonuses ?? [];
  return {
    huntId: hunt.id ?? null,
    huntName: hunt.title ?? null,
    casino: hunt.casino ?? null,
    totalCost: Number(hunt.startCost ?? 0),
    slots: bonuses.map((b) => ({
      name: b.slotName ?? `Bonus ${b.id ?? '?'}`,
      cost: Number(b.betSize ?? 0),
      imageUrl: b.slotImage ?? null,
      provider: b.provider ?? null,
    })),
    snapshotAt: new Date().toISOString(),
  };
}

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
  // Always have at least 1st and 2nd present; default each to zero tickets if
  // missing so we don't crash on settle. Admin is expected to fill these.
  const places = new Set(tiers.map((t) => t.place));
  if (!places.has(1)) tiers.push({ place: 1, tickets: 0, cashLabel: null });
  if (!places.has(2)) tiers.push({ place: 2, tickets: 0, cashLabel: null });
  tiers.sort((a, b) => a.place - b.place);
  return { type, tiers };
}

function pickWinners(entries, round) {
  // entries: full list of entry docs
  // round.actual: { payout, topSlotName }
  // round.kinds: { payout, topSlot }
  // round.rewards.tiers: list of { place }
  //
  // For each kind, rank entries by distance / match. We award places 1..N
  // based on how many tiers exist. If both kinds are enabled, we score by
  // a combined rank: rank-sum, lower is better.
  //
  // Ties broken by earliest `submittedAt`.

  const kinds = round.kinds || {};
  const actual = round.actual || {};
  const tierPlaces = (round.rewards?.tiers || [])
    .map((t) => t.place)
    .sort((a, b) => a - b);

  const enriched = entries.map((e) => {
    let payoutDiff = null;
    if (kinds.payout && typeof actual.payout === 'number' && typeof e.payoutGuess === 'number') {
      payoutDiff = Math.abs(e.payoutGuess - actual.payout);
    }
    const topSlotMatch =
      kinds.topSlot && actual.topSlotName && e.topSlotGuess
        ? e.topSlotGuess.toLowerCase() === String(actual.topSlotName).toLowerCase()
        : null;
    return { ...e, payoutDiff, topSlotMatch };
  });

  // Sort comparator — earliest submittedAt is the tiebreaker.
  const tieBreak = (a, b) => {
    const aMs = a.submittedAt?.toMillis ? a.submittedAt.toMillis() : 0;
    const bMs = b.submittedAt?.toMillis ? b.submittedAt.toMillis() : 0;
    return aMs - bMs;
  };

  let ranked;
  if (kinds.payout && kinds.topSlot) {
    // Combined: top-slot matches go first (sorted by payout diff among them,
    // then non-matches by payout diff). Within ties, earliest wins.
    ranked = [...enriched].sort((a, b) => {
      const matchOrder = (b.topSlotMatch ? 1 : 0) - (a.topSlotMatch ? 1 : 0);
      if (matchOrder !== 0) return matchOrder;
      const ad = a.payoutDiff ?? Infinity;
      const bd = b.payoutDiff ?? Infinity;
      if (ad !== bd) return ad - bd;
      return tieBreak(a, b);
    });
  } else if (kinds.payout) {
    ranked = [...enriched].sort((a, b) => {
      const ad = a.payoutDiff ?? Infinity;
      const bd = b.payoutDiff ?? Infinity;
      if (ad !== bd) return ad - bd;
      return tieBreak(a, b);
    });
  } else if (kinds.topSlot) {
    ranked = [...enriched].sort((a, b) => {
      const matchOrder = (b.topSlotMatch ? 1 : 0) - (a.topSlotMatch ? 1 : 0);
      if (matchOrder !== 0) return matchOrder;
      return tieBreak(a, b);
    });
  } else {
    ranked = [];
  }

  // Take top N where N = tier count, but only viable picks. For payout: every
  // entry is viable. For topSlot only: only entries that matched. For combined:
  // we keep order but exclude entries with neither match nor a payout guess.
  const viable = ranked.filter((e) => {
    if (kinds.payout && typeof e.payoutDiff === 'number') return true;
    if (kinds.topSlot && e.topSlotMatch) return true;
    return false;
  });

  return tierPlaces.map((place, i) => viable[i] || null);
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
      // Helper for the create modal to show what the snapshot will be.
      const hunt = await fetchCurrentHunt();
      if (!hunt) return res.status(404).json({ error: 'NO_CURRENT_HUNT' });
      return res.status(200).json({ ok: true, snapshot: snapshotHunt(hunt) });
    }

    if (action === 'create') {
      const title = String(payload.title || '').trim();
      const contextNote = String(payload.contextNote || '').trim() || null;
      if (!title) return res.status(400).json({ error: 'title required' });

      const kinds = {
        payout: !!payload.kinds?.payout,
        topSlot: !!payload.kinds?.topSlot,
      };
      if (!kinds.payout && !kinds.topSlot) {
        return res.status(400).json({ error: 'at least one prediction kind required' });
      }

      const source = payload.source === 'manual' ? 'manual' : 'bonushunt';
      let bonusHuntSnapshot = null;
      let manualSlots = null;
      let manualTotalCost = null;

      if (source === 'bonushunt') {
        const hunt = await fetchCurrentHunt();
        if (!hunt) return res.status(400).json({ error: 'NO_CURRENT_HUNT' });
        bonusHuntSnapshot = snapshotHunt(hunt);
      } else {
        const rawSlots = String(payload.manualSlots || '')
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean);
        if (kinds.topSlot && rawSlots.length === 0) {
          return res.status(400).json({ error: 'manual slots required when topSlot is enabled' });
        }
        manualSlots = rawSlots;
        manualTotalCost =
          payload.manualTotalCost === '' || payload.manualTotalCost == null
            ? null
            : Number(payload.manualTotalCost);
      }

      const rewards = sanitizeRewards(payload.rewards);
      const now = FieldValue.serverTimestamp();

      const ref = await adminDb.collection('prediction_rounds').add({
        title,
        contextNote,
        kinds,
        source,
        bonusHuntSnapshot,
        manualSlots,
        manualTotalCost,
        rewards,
        status: 'open',
        entryCount: 0,
        actual: null,
        winners: [],
        openedAt: now,
        lockedAt: null,
        settledAt: null,
        createdAt: now,
        createdBy: admin.email,
      });
      return res.status(200).json({ ok: true, id: ref.id });
    }

    // All other actions need an existing round.
    const { id } = payload;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const ref = adminDb.collection('prediction_rounds').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'NOT_FOUND' });
    const round = snap.data();

    if (action === 'lock') {
      if (round.status !== 'open') return res.status(400).json({ error: 'NOT_OPEN' });
      await ref.update({ status: 'locked', lockedAt: FieldValue.serverTimestamp() });
      return res.status(200).json({ ok: true });
    }

    if (action === 'reopen') {
      // Edge case: streamer locked too early. Allow re-open while not settled.
      if (round.status !== 'locked') return res.status(400).json({ error: 'NOT_LOCKED' });
      await ref.update({ status: 'open', lockedAt: null });
      return res.status(200).json({ ok: true });
    }

    if (action === 'settle') {
      if (!['open', 'locked'].includes(round.status)) {
        return res.status(400).json({ error: 'NOT_SETTLEABLE' });
      }
      const actualPayout = round.kinds.payout
        ? Number(payload.actualPayout)
        : null;
      const actualTopSlot = round.kinds.topSlot
        ? String(payload.actualTopSlotName || '').trim() || null
        : null;
      if (round.kinds.payout && !Number.isFinite(actualPayout)) {
        return res.status(400).json({ error: 'actualPayout required' });
      }
      if (round.kinds.topSlot && !actualTopSlot) {
        return res.status(400).json({ error: 'actualTopSlotName required' });
      }

      // Load all entries.
      const entriesSnap = await ref.collection('entries').get();
      const entries = entriesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const updatedRound = {
        ...round,
        actual: { payout: actualPayout, topSlotName: actualTopSlot },
      };
      const placements = pickWinners(entries, updatedRound);

      // Build winners list + distribute rewards.
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
          topSlotGuess: e.topSlotGuess || null,
          diff:
            typeof e.payoutDiff === 'number' && Number.isFinite(e.payoutDiff)
              ? e.payoutDiff
              : null,
          topSlotMatch: e.topSlotMatch === true,
          prize: { tickets: tier?.tickets || null, cashLabel: tier?.cashLabel || null },
          redemptionId: null,
        };

        // Distribute tickets immediately if tier specifies them.
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

        // Create cash redemption if tier specifies cash.
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
            createdAt: now,
            fulfilledAt: null,
          });
          winnerObj.redemptionId = redemptionRef.id;
        }
        winners.push(winnerObj);
      }

      batch.update(ref, {
        actual: { payout: actualPayout, topSlotName: actualTopSlot },
        winners,
        status: 'settled',
        settledAt: now,
        settledBy: admin.email,
      });

      await batch.commit();
      return res.status(200).json({ ok: true, winners });
    }

    if (action === 'delete') {
      // Hard delete round + entries subcollection.
      const subSnap = await ref.collection('entries').get();
      if (!subSnap.empty) {
        for (let i = 0; i < subSnap.docs.length; i += 400) {
          const b = adminDb.batch();
          subSnap.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref));
          await b.commit();
        }
      }
      await ref.delete();
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'UNKNOWN_ACTION' });
  } catch (err) {
    console.error('predictions admin error', err);
    return res.status(500).json({ error: 'INTERNAL', detail: err.message });
  }
}
