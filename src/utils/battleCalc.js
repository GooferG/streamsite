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
// rakePct: number (e.g. 10 for 10%)
export function computeBattle(players, rakePct) {
  const list = Array.isArray(players) ? players : [];
  const ranPlayers = list.filter((p) => p.ran);

  const totalPot = ranPlayers.reduce((sum, p) => sum + (Number(p.payout) || 0), 0);
  const pct = Number(rakePct) || 0;
  const rakeAmount = totalPot * (pct / 100);
  const potAfterRake = totalPot - rakeAmount;

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
    totalPot,
    rakeAmount,
    potAfterRake,
    winner,
    loser,
  };
}
