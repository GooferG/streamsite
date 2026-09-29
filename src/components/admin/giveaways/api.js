import { authedFetch } from '../../../utils/authedFetch';

// Announce results that are not worth a warning toast.
export const QUIET_ANNOUNCE = ['disabled', 'empty', 'already'];

export async function postAction(action, body = {}) {
  const res = await authedFetch('/api/admin/giveaways', {
    method: 'POST',
    body: JSON.stringify({ action, ...body }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

const ERROR_TEXT = {
  NO_ENTRIES: 'Nobody left to draw.',
  NO_MORE_ENTRIES: 'Nobody left to draw.',
  ROLL_RACE: 'Someone else rolled first.',
  NOT_OPEN: 'Entries are already closed.',
  NOT_ROLLABLE: 'Not ready to roll yet.',
  NOT_FOUND: 'That giveaway is gone.',
  NOT_AUTHENTICATED: 'Signed out. Sign in again at /admin.',
};

export function giveawayErrorText(code, status) {
  if (status === 401 || status === 403) return ERROR_TEXT.NOT_AUTHENTICATED;
  return ERROR_TEXT[code] || `Action failed: ${code || status || 'unknown'}`;
}
