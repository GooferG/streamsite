import { authedFetch } from '../../utils/authedFetch';

// POST one action to the Goofer Ball staff endpoint. Never throws.
export async function ballAction(body) {
  try {
    const res = await authedFetch('/api/admin/ball', { method: 'POST', body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data: data || {} };
  } catch {
    return { ok: false, status: 0, data: { error: 'Network error' } };
  }
}

const ERROR_TEXT = {
  ROUND_ACTIVE: 'Settle or cancel the current round first.',
  INVALID_PRIZE: 'Set tickets or a $ prize.',
  NOT_OPEN: 'The drum is not open.',
  NOT_CLOSED: 'Close the lineup first.',
  EMPTY_DRUM: 'Nobody in the drum.',
  DRAW_BUSY: 'A draw is still on screen.',
  ALREADY_SETTLED: 'Already paid out.',
  NO_RESULTS: 'No drawn ball has a result yet.',
  FINAL: 'This round is over.',
  NOT_DRAWN: 'That ball is not on the rack.',
  ALREADY_SCRATCHED: 'Already scratched.',
  REVEAL_PLAYING: 'Wait for the reveal to finish.',
  HUNT_NOT_FOUND: 'That hunt is gone.',
  WINNER_CHANGED: 'The winner changed since your preview. Preview again.',
  HUNT_CHANGED: 'The linked hunt changed. Preview again.',
  COMMUNITYHUNTS_UNAVAILABLE: 'communityhunts.gg is unavailable. Type the numbers in.',
  NOT_AUTHENTICATED: 'Signed out. Sign in again at /admin.',
};

export function ballErrorText(code, status) {
  if (status === 401 || status === 403) return ERROR_TEXT.NOT_AUTHENTICATED;
  return ERROR_TEXT[code] || `Failed: ${code || status || 'unknown'}`;
}

// The problem to show for an `announce` reply, or null when it posted (or
// was already posted, or the draw was scratched).
export function announceProblem(ok, data) {
  const r = data && data.announce;
  if (ok && r && (r.posted || r.reason === 'already' || r.reason === 'scratched' || r.reason === 'later')) return null;
  return (r && r.reason) || (data && data.error) || 'unknown';
}
