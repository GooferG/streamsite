// Display helpers for communityhunts.gg hunts on the Hunts tab. P/L follows
// communityhunts' own rule: only hunts that recorded a starting pot have one.

const HUNT_TYPE_LABELS = {
  community: 'Community',
  solo: 'Solo',
  vip: 'VIP',
  affiliate: 'Affiliate',
  streamer: 'Streamer',
  toplb: 'Top LB',
};

export function huntTypeLabel(type) {
  if (!type) return 'Hunt';
  return HUNT_TYPE_LABELS[type] || type.charAt(0).toUpperCase() + type.slice(1);
}

export function profitLoss(hunt) {
  const pot = Number(hunt && hunt.pot);
  const won = Number(hunt && hunt.totalWon);
  if (!(pot > 0) || hunt.totalWon == null || !Number.isFinite(won)) return null;
  return Math.round((won - pot) * 100) / 100;
}

export function formatHuntDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatMultiplier(x) {
  if (x == null || x === '') return '—';
  const n = Number(x);
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(n >= 100 ? 0 : 1)}x`;
}
