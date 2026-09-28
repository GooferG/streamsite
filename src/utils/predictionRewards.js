// Client-side reward helpers for prediction rounds: labels (mirroring
// api/_lib/predictionRewards.js, which CRA can't import) and the admin
// rewards-editor form. Prize amounts are dollars.

export const MAX_PRIZE_AMOUNT = 100000;
const PLACE_LABELS = { 1: '1st', 2: '2nd', 3: '3rd' };

export const PRIZE_KINDS = [
  { value: 'none', label: 'No prize' },
  { value: 'cash', label: 'Cash' },
  { value: 'bonus', label: 'Bonus buy' },
];

export function placeLabel(place) {
  return PLACE_LABELS[place] || `${place}th`;
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

// What a settled winner won, for display. Rounds settled before prizes
// existed stored a free-text cashLabel.
export function winnerPrizeLabel(prize) {
  if (!prize) return null;
  return prize.label || prize.cashLabel || null;
}

// One tier as "100t + $10 cash", "50t", "Bonus buy $20" or "No reward".
// `legacyType` is the round's old `rewards.type` ('tickets'|'cash'|'both'),
// which only matters for a legacy tier (no `prize` key) — the old form hid
// the ticket or cash input behind it, so honor whichever the admin picked.
export function rewardSummary(tier, legacyType) {
  const legacy = !(tier && Object.prototype.hasOwnProperty.call(tier, 'prize'));
  const showTickets = !legacy || legacyType !== 'cash';
  const showCash = !legacy || legacyType !== 'tickets';
  const parts = [];
  const tickets = Number(tier && tier.tickets) || 0;
  if (showTickets && tickets > 0) parts.push(`${tickets}t`);
  if (showCash) {
    const prize = tier && tier.prize;
    const label = prizeLabel(prize);
    if (label) parts.push(prize.kind === 'cash' ? `${label} cash` : label);
    else if (tier && tier.cashLabel) parts.push(tier.cashLabel);
  }
  return parts.length ? parts.join(' + ') : 'No reward';
}

const DEFAULT_ROWS = [
  { place: 1, tickets: '100', prizeKind: 'none', prizeAmount: '' },
  { place: 2, tickets: '50', prizeKind: 'none', prizeAmount: '' },
  { place: 3, tickets: '25', prizeKind: 'none', prizeAmount: '' },
];

export function defaultRewardsForm() {
  return { rows: DEFAULT_ROWS.map((row) => ({ ...row })), thirdEnabled: false };
}

function hasPrizeShape(round) {
  const tiers = round && round.rewards && round.rewards.tiers;
  return (
    Array.isArray(tiers) &&
    tiers.length > 0 &&
    tiers.every((t) => t && Object.prototype.hasOwnProperty.call(t, 'prize'))
  );
}

// Newest round (the list is newest first) whose rewards can seed the form.
export function lastRewardsRound(rounds) {
  return (rounds || []).find((r) => r && r.acceptPredictions && hasPrizeShape(r)) || null;
}

export function rewardsFormFrom(round) {
  const form = defaultRewardsForm();
  if (!hasPrizeShape(round)) return form;
  for (const tier of round.rewards.tiers) {
    const row = form.rows.find((r) => r.place === tier.place);
    if (!row) continue;
    row.tickets = String(tier.tickets ?? 0);
    row.prizeKind = tier.prize ? tier.prize.kind : 'none';
    row.prizeAmount = tier.prize ? String(tier.prize.amount) : '';
    if (tier.place === 3) form.thirdEnabled = true;
  }
  return form;
}

function activeRows(form) {
  return form.rows.filter((row) => row.place !== 3 || form.thirdEnabled);
}

// The first incomplete prize as a message, else null.
export function validateRewardsForm(form) {
  for (const row of activeRows(form)) {
    if (row.prizeKind === 'none') continue;
    const n = Number(row.prizeAmount);
    if (row.prizeAmount === '' || !Number.isFinite(n) || n <= 0 || n > MAX_PRIZE_AMOUNT) {
      return `Enter a prize amount for ${placeLabel(row.place)} place (up to $100,000)`;
    }
  }
  return null;
}

export function rewardsPayload(form) {
  return {
    tiers: activeRows(form).map((row) => ({
      place: row.place,
      tickets: Math.max(0, Math.floor(Number(row.tickets) || 0)),
      prize:
        row.prizeKind === 'none'
          ? null
          : { kind: row.prizeKind, amount: Number(row.prizeAmount) },
    })),
  };
}
