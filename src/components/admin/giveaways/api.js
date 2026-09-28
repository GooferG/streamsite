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
