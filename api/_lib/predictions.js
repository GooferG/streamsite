// Payout-only winner picking for prediction rounds. Pure (no firebase-admin)
// so it can be unit tested. The closest guess to the actual payout wins. A
// tie goes to whoever settled on their final guess first (lastEditAt, falling
// back to submittedAt), so editing late never keeps an early tie-break.
// Entries without a numeric guess are ignored; one slot per reward tier.

import { tierPrize } from './predictionRewards.js';

function toMs(ts) {
  return ts && ts.toMillis ? ts.toMillis() : 0;
}

function finalGuessMs(entry) {
  return toMs(entry.lastEditAt) || toMs(entry.submittedAt);
}

function sortedTiers(round) {
  return ((round && round.rewards && round.rewards.tiers) || [])
    .slice()
    .sort((a, b) => a.place - b.place);
}

export function pickWinners(entries, round) {
  const tiers = sortedTiers(round);
  const actual = round && round.actual && round.actual.payout;
  if (typeof actual !== 'number' || !Number.isFinite(actual)) {
    return tiers.map(() => null);
  }
  const ranked = entries
    .filter((e) => typeof e.payoutGuess === 'number' && Number.isFinite(e.payoutGuess))
    .map((e) => ({ ...e, payoutDiff: Math.abs(e.payoutGuess - actual) }))
    .sort((a, b) => a.payoutDiff - b.payoutDiff || finalGuessMs(a) - finalGuessMs(b));
  return tiers.map((_, i) => ranked[i] || null);
}

// Winner records for a payout: one per tier in place order, null where no
// entry placed. Settle fills in redemptionId when it files a prize.
export function buildWinners(entries, round, actualPayout) {
  const tiers = sortedTiers(round);
  const picks = pickWinners(entries, { ...round, actual: { payout: actualPayout } });
  return tiers.map((tier, i) => {
    const e = picks[i];
    if (!e) return null;
    const prize = tierPrize(tier);
    const tickets = Number(tier.tickets);
    return {
      place: tier.place,
      twitchId: e.twitchId || e.id,
      twitchName: e.twitchName || null,
      displayName: e.displayName || null,
      profileImageUrl: e.profileImageUrl || null,
      payoutGuess: e.payoutGuess,
      diff: e.payoutDiff,
      prize: {
        tickets: Number.isFinite(tickets) && tickets > 0 ? Math.floor(tickets) : 0,
        kind: prize ? prize.kind : null,
        amount: prize ? prize.amount : null,
        label: prize ? prize.label : null,
      },
      redemptionId: null,
    };
  });
}
