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

// Rounds created before this branch have tiers with NO `prize` key (just
// { place, tickets, cashLabel }), and a round-level rewards.type
// ('tickets'|'cash'|'both') that the old form used to hide the ticket or cash
// input — but the server ignored, so e.g. a 'cash' round still paid its
// hidden 100/50 tickets. For those legacy tiers only, honor the type the
// admin actually picked. Tiers with a `prize` key (the new shape) always pay
// exactly what they list, regardless of rewards.type.
function legacyPrizeFor(tier, legacyType) {
  const hasPrizeKey = Object.prototype.hasOwnProperty.call(tier, 'prize');
  const raw = Number(tier.tickets);
  const tickets = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
  const prize = tierPrize(tier);
  if (hasPrizeKey) return { tickets, prize };
  if (legacyType === 'cash') return { tickets: 0, prize };
  if (legacyType === 'tickets') return { tickets, prize: null };
  return { tickets, prize };
}

// Winner records for a payout: one per tier in place order, null where no
// entry placed. Settle fills in redemptionId when it files a prize.
export function buildWinners(entries, round, actualPayout) {
  const tiers = sortedTiers(round);
  const picks = pickWinners(entries, { ...round, actual: { payout: actualPayout } });
  const legacyType = round && round.rewards && round.rewards.type;
  return tiers.map((tier, i) => {
    const e = picks[i];
    if (!e) return null;
    const { tickets, prize } = legacyPrizeFor(tier, legacyType);
    return {
      place: tier.place,
      twitchId: e.twitchId || e.id,
      twitchName: e.twitchName || null,
      displayName: e.displayName || null,
      profileImageUrl: e.profileImageUrl || null,
      payoutGuess: e.payoutGuess,
      diff: e.payoutDiff,
      prize: {
        tickets,
        kind: prize ? prize.kind : null,
        amount: prize ? prize.amount : null,
        label: prize ? prize.label : null,
      },
      redemptionId: null,
    };
  });
}
