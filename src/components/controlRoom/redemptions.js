import { tsMillis } from '../../utils/giveaway';

// The Redeem tab's pure rules. The provider's feed is pending redemptions,
// newest first, capped at QUEUE_CAP.
export const QUEUE_CAP = 50;
export const FILTERS = ['all', 'stream', 'payouts'];
export const FILTER_LABELS = { all: 'All', stream: 'Stream', payouts: 'Payouts' };
const PAYOUT_KINDS = ['giveaway', 'prediction'];

// Store orders played on stream, prizes owed from giveaways and predictions,
// or anything else (old docs, future kinds), which only shows under All.
export function kindGroup(kind) {
  if (kind === 'stream') return 'stream';
  return PAYOUT_KINDS.includes(kind) ? 'payouts' : 'other';
}

export const kindLabel = (kind) => String(kind || 'item').toUpperCase();

// Store orders cost tickets; prizes cost nothing, so they show no price.
export const showsCost = (r) => Number(r && r.cost) > 0;

export const whoRedeemed = (r) => r.displayName || r.twitchName || r.userId || 'someone';

export function filterQueue(list, filter) {
  if (filter !== 'stream' && filter !== 'payouts') return list || [];
  return (list || []).filter((r) => kindGroup(r.kind) === filter);
}

export function filterCounts(list) {
  const counts = { all: 0, stream: 0, payouts: 0 };
  for (const r of list || []) {
    counts.all += 1;
    const group = kindGroup(r.kind);
    if (group !== 'other') counts[group] += 1;
  }
  return counts;
}

// The feed is newest first; the queue reads oldest first, like a to-do list.
export const queueOrder = (list) => [...(list || [])].reverse();

const createdMs = (r) => tsMillis(r && r.createdAt);

export function newestAt(list) {
  let newest = null;
  for (const r of list || []) {
    const ms = createdMs(r);
    if (ms != null && (newest == null || ms > newest)) newest = ms;
  }
  return newest;
}

// Pending redemptions newer than this browser's mark. Before the first
// baseline nothing is unseen, and a doc without a createdAt counts as seen.
export function unseenCount(list, seenAt) {
  if (seenAt == null) return 0;
  return (list || []).filter((r) => {
    const ms = createdMs(r);
    return ms != null && ms > seenAt;
  }).length;
}

export function ageLabel(ts, now) {
  const ms = tsMillis(ts);
  if (ms == null) return '';
  const minutes = Math.floor(Math.max(0, now - ms) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function redemptionErrorText(code) {
  if (code === 'NOT_PENDING') return 'Already handled by someone else.';
  if (code === 'NOT_FOUND') return "This one's gone.";
  return "Didn't go through. Try again.";
}
