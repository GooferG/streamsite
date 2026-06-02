// Pure pot math for Bonus Battle. No React, no Firestore — unit-testable.

// USD formatter. Two decimals, thousands separator, leading $.
export function currency(val) {
  const n = Number(val) || 0;
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Tie-break: highest payout wins; ties broken by lowest `order` (insertion order).
function better(a, b) {
  if (b == null) return a;
  if (a.payout !== b.payout) return a.payout > b.payout ? a : b;
  return (a.order ?? 0) <= (b.order ?? 0) ? a : b;
}
function worse(a, b) {
  if (b == null) return a;
  if (a.payout !== b.payout) return a.payout < b.payout ? a : b;
  return (a.order ?? 0) <= (b.order ?? 0) ? a : b;
}

// players: [{ id, name, slot, payout, ran, order }]
// opts: { rakePct, entryFee } — or a bare number (legacy: treated as rakePct,
//   entryFee 0). The pot is funded by entry fees: every player pays the fee to
//   join, so totalPot = entryFee × playerCount. Payouts entered during play are
//   for ranking only (who pulled the most) and surface as `totalPayouts`.
export function computeBattle(players, opts) {
  const list = Array.isArray(players) ? players : [];
  const ranPlayers = list.filter((p) => p.ran);

  const { rakePct, entryFee } =
    typeof opts === 'number' ? { rakePct: opts, entryFee: 0 } : opts || {};
  const pct = Number(rakePct) || 0;
  const fee = Number(entryFee) || 0;

  // Pot = entry fees collected from every player in the battle.
  const totalPot = fee * list.length;
  const rakeAmount = totalPot * (pct / 100);
  const potAfterRake = totalPot - rakeAmount;

  // Sum of bonus payouts — drives ranking/standings, not the pot.
  const totalPayouts = ranPlayers.reduce((sum, p) => sum + (Number(p.payout) || 0), 0);

  let winner = null;
  let loser = null;
  for (const p of ranPlayers) {
    winner = better(p, winner);
    loser = worse(p, loser);
  }

  return {
    total: list.length,
    ran: ranPlayers.length,
    left: list.length - ranPlayers.length,
    entryFee: fee,
    totalPot,
    rakeAmount,
    potAfterRake,
    totalPayouts,
    winner,
    loser,
  };
}
