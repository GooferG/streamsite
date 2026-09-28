// Read helpers for prediction round docs (Firestore hunts/{id}). A round's
// money context comes from its communityhunts snapshot, or from the manual
// start cost the admin typed.

export function roundCurrency(round) {
  if (!round || round.source !== 'communityhunts') return null;
  return (round.bonusHuntSnapshot && round.bonusHuntSnapshot.currency) || null;
}

export function roundTotalCost(round) {
  if (!round) return 0;
  const raw =
    round.source === 'communityhunts'
      ? round.bonusHuntSnapshot && round.bonusHuntSnapshot.totalCost
      : round.manualTotalCost;
  return Number(raw) || 0;
}

// While a round is open only staff (and each viewer, for their own entry) may
// read its entries (firestore.rules), so viewer pages must not query them.
export function entriesSealed(round, isStaff) {
  return !!round && round.status === 'open' && !isStaff;
}
