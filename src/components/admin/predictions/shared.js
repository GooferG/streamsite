import { authedFetch } from '../../../utils/authedFetch';

// Shared pieces for the prediction control room components.

export const inputCls =
  'w-full bg-zinc-broadcast/60 border border-white/10 px-3 py-2.5 text-sm text-white-body placeholder:text-white/25 focus:border-orange-admin/70 focus:outline-none transition-colors duration-150';

export function formatTs(ts) {
  if (!ts) return '—';
  const date = ts.toDate ? ts.toDate() : new Date(ts.toMillis ? ts.toMillis() : ts);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const ERROR_TEXT = {
  ROUND_ACTIVE: 'Settle or delete the current round first.',
  NOT_LOCKED: 'Lock the round before settling.',
  NOT_OPEN: 'The round is not open.',
  ALREADY_SETTLED: 'This round is already settled.',
  PREDICTIONS_DISABLED: 'This round has predictions turned off.',
  WRONG_STATUS: 'Not available in this round state.',
  NO_CURRENT_HUNT: 'No communityhunts.gg hunt found yet.',
  COMMUNITYHUNTS_UNAVAILABLE: 'communityhunts.gg is unavailable. Try again or use manual entry.',
};

export function errorText(code) {
  return ERROR_TEXT[code] || code || 'Failed';
}

// POST one action to the admin rounds endpoint. Never throws.
export async function roundsAction(body) {
  try {
    const res = await authedFetch('/api/admin/hunts', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return { ok: res.ok, data: data || {} };
  } catch {
    return { ok: false, data: { error: 'Network error' } };
  }
}

// The error to show for an `announce` reply, or null when the line is posted
// (or was already posted by another tab).
export function announceFailure(ok, data) {
  const result = data && data.announce;
  if (ok && result && (result.posted || result.reason === 'already')) return null;
  return (result && result.reason) || (data && data.error) || 'unknown';
}
