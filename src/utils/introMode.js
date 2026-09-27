// Which TV intro a page load gets.
//  'gate' — first visit landing on home: black tube, click to power on (with sound).
//  'flip' — any other brand-page load: ~500ms of static, once per tab session.
//  'none' — product routes (/gamba, /admin, callbacks), repeat loads, reduced motion.

const POWERED_KEY = 'gg_tv_powered';
const WELCOME_KEY = 'gg_welcome_seen'; // WelcomeSignOn's flag: regulars who predate the gate
const SESSION_KEY = 'tvIntroPlayed';

export function introModeFor({ pathname, isBrandRoute, powered, sessionPlayed, reducedMotion }) {
  if (!isBrandRoute) return 'none';
  if (!powered && pathname === '/') return 'gate';
  if (sessionPlayed || reducedMotion) return 'none';
  return 'flip';
}

// Unreadable storage (private mode, blocked site data) counts as powered and
// played, so the gate never traps anyone and nothing replays on every load.
export function readIntroFlags() {
  try {
    const local = window.localStorage;
    return {
      powered: local.getItem(POWERED_KEY) != null || local.getItem(WELCOME_KEY) === '1',
      sessionPlayed: window.sessionStorage.getItem(SESSION_KEY) != null,
    };
  } catch {
    return { powered: true, sessionPlayed: true };
  }
}

export function markPowered() {
  try {
    window.localStorage.setItem(POWERED_KEY, '1');
  } catch {
    // best-effort
  }
}

export function markSessionPlayed() {
  try {
    window.sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    // best-effort
  }
}
