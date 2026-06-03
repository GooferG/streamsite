// Pure pot math for Bonus Battle. No React, no Firestore — unit-testable.

// Supported battle currencies. `locale` drives Intl grouping/decimal/symbol
// conventions; `display` picks symbol vs code so each currency is unambiguous:
//   USD → $1,080.00   CAD → CA$1,080.00   ARS → ARS 1.080,50
// (en-US disambiguates CAD as "CA$"; es-AR gives Argentine grouping, and we use
// the "code" display for ARS since its bare symbol is "$".)
export const CURRENCIES = [
  { code: 'USD', label: 'USD ($)', locale: 'en-US', display: 'symbol' },
  { code: 'CAD', label: 'CAD (CA$)', locale: 'en-US', display: 'symbol' },
  { code: 'ARS', label: 'ARS (AR$)', locale: 'es-AR', display: 'code' },
];

const CURRENCY_BY_CODE = CURRENCIES.reduce((m, c) => {
  m[c.code] = c;
  return m;
}, {});

// Currency formatter. `code` selects the currency + its locale conventions;
// unknown/missing codes fall back to USD. Display label only — no conversion.
export function currency(val, code = 'USD') {
  const n = Number(val) || 0;
  const cfg = CURRENCY_BY_CODE[code] || CURRENCY_BY_CODE.USD;
  return n.toLocaleString(cfg.locale, {
    style: 'currency',
    currency: cfg.code,
    currencyDisplay: cfg.display,
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
