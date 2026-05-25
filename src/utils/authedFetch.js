import { auth } from '../config/firebase';

/**
 * fetch wrapper that attaches the current Firebase user's ID token as
 * Authorization: Bearer <token>. Throws if there is no signed-in user.
 */
export async function authedFetch(input, init = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('NOT_AUTHENTICATED');
  const token = await user.getIdToken();
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(input, { ...init, headers });
}
