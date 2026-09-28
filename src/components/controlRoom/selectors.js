export const LIVE_GIVEAWAY_STATUSES = ['open', 'closed', 'rolling', 'playing'];
export const OVERLAY_PATHS = ['/giveaway-overlay', '/suggest-overlay'];
const SHOW_ORDER = ['rolling', 'playing', 'open', 'closed'];

// The giveaway the panel shows. `list` is newest first; an older rolling
// giveaway still wins over a newer open one, because a pick needs the operator.
export function shownGiveaway(list) {
  for (const status of SHOW_ORDER) {
    const hit = (list || []).find((g) => g.status === status);
    if (hit) return hit;
  }
  return null;
}

// The pick whose winner chat message may still be pending (the rule the admin
// page has always used).
export function currentPickOf(list) {
  return (
    (list || []).find(
      (g) => ['rolling', 'playing'].includes(g.status) && g.winnerTwitchId && g.rolledAt
    ) || null
  );
}

export function activeRoundOf(rounds) {
  return (
    (rounds || []).find(
      (r) => r.acceptPredictions && (r.status === 'open' || r.status === 'locked')
    ) || null
  );
}

export function pickConfirmed(giveaway) {
  if (!giveaway || !giveaway.winnerTwitchId) return false;
  return (giveaway.winners || []).some((w) => w.twitchId === giveaway.winnerTwitchId);
}

// Where the provider runs at all. OBS browser sources never drive timers.
export function controlRoomAllowed(pathname) {
  return !OVERLAY_PATHS.includes(pathname);
}

// Where the floating panel and the stage moment render. /admin has its own UI.
export function panelAllowed(pathname) {
  return controlRoomAllowed(pathname) && !pathname.startsWith('/admin');
}
