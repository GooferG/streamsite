// What logging a giveaway payout writes onto the winner's redemption. Pure
// (no firebase-admin) so it can be unit tested; the caller passes the server
// timestamp in as `now`. Bonus wins are paid on the spot, so the first payout
// on a pending redemption fulfils it. A fulfilled or cancelled redemption
// keeps its status: logging a correction only updates the numbers.
export function payoutRedemptionUpdate(redemption, { itemName, payout, buyAmount, slotName, actor, now }) {
  const update = {
    itemName,
    payout,
    buyAmount: buyAmount ?? null,
    slotName: slotName || null,
  };
  if (redemption && redemption.status === 'pending') {
    update.status = 'fulfilled';
    update.fulfilledAt = now;
    update.fulfilledBy = actor || null;
  }
  return update;
}
