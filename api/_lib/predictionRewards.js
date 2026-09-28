// Reward tiers for prediction rounds. Pure (no firebase-admin) so it can be
// unit tested. A tier is { place, tickets, prize } where prize is null or
// { kind: 'cash' | 'bonus', amount } in dollars. Rounds created before the
// prize field existed carry { place, tickets, cashLabel } instead.

export const MAX_TICKETS = 1000000;
export const MAX_PRIZE_AMOUNT = 100000;
const PRIZE_KINDS = ['cash', 'bonus'];
const PLACE_LABELS = { 1: '1st', 2: '2nd', 3: '3rd' };

export function placeLabel(place) {
  return PLACE_LABELS[place] || `${place}th`;
}

function sanitizePrize(prize) {
  if (!prize || !PRIZE_KINDS.includes(prize.kind)) return null;
  const amount = Number(prize.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_PRIZE_AMOUNT) return null;
  return { kind: prize.kind, amount: Math.round(amount * 100) / 100 };
}

function sanitizeTier(tier) {
  if (!tier) return null;
  const place = Number(tier.place);
  if (!Number.isInteger(place) || place < 1 || place > 3) return null;
  const raw = Number(tier.tickets);
  const tickets = Number.isFinite(raw) ? Math.min(MAX_TICKETS, Math.max(0, Math.floor(raw))) : 0;
  return { place, tickets, prize: sanitizePrize(tier.prize) };
}

// Admin input -> stored rewards. Invalid tiers and prizes are dropped, the
// first tier for a place wins, and 1st and 2nd are always present. Any legacy
// `type` field is ignored: a tier pays exactly what it lists.
export function sanitizeRewards(input) {
  const tiers = [];
  const seen = new Set();
  const list = input && Array.isArray(input.tiers) ? input.tiers : [];
  for (const raw of list) {
    const tier = sanitizeTier(raw);
    if (!tier || seen.has(tier.place)) continue;
    seen.add(tier.place);
    tiers.push(tier);
  }
  for (const place of [1, 2]) {
    if (!seen.has(place)) tiers.push({ place, tickets: 0, prize: null });
  }
  tiers.sort((a, b) => a.place - b.place);
  return { tiers };
}

function dollars(amount) {
  const n = Number(amount);
  const digits = Number.isInteger(n) ? 0 : 2;
  return `$${n.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function prizeLabel(prize) {
  if (!prize) return null;
  if (prize.kind === 'cash') return dollars(prize.amount);
  if (prize.kind === 'bonus') return `Bonus buy ${dollars(prize.amount)}`;
  return null;
}

// The prize a stored tier pays, with its label. Legacy tiers only had a
// free-text cashLabel, which is kept as the label.
export function tierPrize(tier) {
  if (!tier) return null;
  if (tier.prize) {
    return { kind: tier.prize.kind, amount: tier.prize.amount, label: prizeLabel(tier.prize) };
  }
  if (tier.cashLabel) return { kind: 'cash', amount: null, label: tier.cashLabel };
  return null;
}
