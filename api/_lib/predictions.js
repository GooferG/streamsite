// Payout-only winner picking for prediction rounds. Pure (no firebase-admin)
// so it can be unit tested. Rules match the previous payout path: closest
// guess to the actual payout wins, a tie goes to the earlier submission,
// entries without a numeric guess are ignored, one slot per reward tier.

function submittedMs(entry) {
  return entry.submittedAt && entry.submittedAt.toMillis ? entry.submittedAt.toMillis() : 0;
}

export function pickWinners(entries, round) {
  const tierPlaces = ((round && round.rewards && round.rewards.tiers) || [])
    .map((t) => t.place)
    .sort((a, b) => a - b);
  const actual = round && round.actual && round.actual.payout;
  if (typeof actual !== 'number' || !Number.isFinite(actual)) {
    return tierPlaces.map(() => null);
  }
  const ranked = entries
    .filter((e) => typeof e.payoutGuess === 'number' && Number.isFinite(e.payoutGuess))
    .map((e) => ({ ...e, payoutDiff: Math.abs(e.payoutGuess - actual) }))
    .sort((a, b) => a.payoutDiff - b.payoutDiff || submittedMs(a) - submittedMs(b));
  return tierPlaces.map((_, i) => ranked[i] || null);
}
