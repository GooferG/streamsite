// Dev-only fixtures for /gamba?fixture=live|prehunt|offair|noleaderboard.
// GambaGuide requires this module only outside production builds.

const NOW = new Date(2026, 9, 1, 21, 58).getTime();

const BOARD = {
  players: [
    { maskedUsername: 'ab***z', wagered: 41203, prize: 2000 },
    { maskedUsername: 'kr***9', wagered: 34333, prize: 1000 },
    { maskedUsername: 'vo***t', wagered: 29120, prize: 500 },
    { maskedUsername: 'sk***y', wagered: 18452, prize: 250 },
    { maskedUsername: 'xi***r', wagered: 12010, prize: 100 },
  ],
  prizePool: 5000,
  periodLabel: 'OCTOBER',
  endsAt: NOW + 27 * 86400000 + 4 * 3600000,
  isLoading: false,
  error: null,
};
const COUNTDOWN = { days: 27, hours: 4, minutes: 0, seconds: 0, isOver: false };

const bonus = (slot, bet, win) => ({ slot, bet, win, multiplier: win == null ? null : win / bet, thumb: null });
const LIVE_HUNT = {
  id: 'h9',
  status: 'live',
  huntType: 'community',
  currency: null,
  startedAt: '2026-10-01T23:30:00.000Z',
  endedAt: null,
  bonusCount: 8,
  pot: 2421.82,
  totalWon: null,
  averageMultiple: null,
  bonuses: [
    bonus('Wanted Dead or a Wild', 0.6, 127.2),
    bonus('Sugar Rush 1000', 0.6, 24),
    bonus('Gates of Olympus', 0.6, 61.8),
    bonus('The Dog House', 0.6, 3),
    bonus('Big Bass Splash', 0.6, null),
    bonus('Fruit Party', 0.6, null),
    bonus('Starlight Princess', 0.6, null),
    bonus('Sweet Bonanza', 0.6, null),
  ],
};
const LAST_HUNT = { id: 'h8', status: 'archived', huntType: 'community', currency: null, bonusCount: 30, pot: 1800, totalWon: 2175.7, averageMultiple: 72.5, endedAt: '2026-09-30T04:10:00.000Z' };
const ROUND = (status) => ({
  id: 'r7',
  title: 'Thursday comm hunt',
  status,
  acceptPredictions: true,
  entryCount: 6,
  source: 'communityhunts',
  bonusHuntSnapshot: { huntId: 'h9', totalCost: 2421.82, currency: null, bonusCount: 8 },
  rewards: { tiers: [{ place: 1, tickets: 500, prize: null }] },
});

export const GUIDE_FIXTURES = {
  live: { now: NOW, leaderboard: BOARD, countdown: COUNTDOWN, hunts: { live: LIVE_HUNT, recent: [LAST_HUNT], loading: false, error: null }, round: ROUND('open') },
  prehunt: { now: NOW, leaderboard: BOARD, countdown: COUNTDOWN, hunts: { live: null, recent: [LAST_HUNT], loading: false, error: null }, round: ROUND('open') },
  offair: { now: NOW, leaderboard: BOARD, countdown: COUNTDOWN, hunts: { live: null, recent: [LAST_HUNT], loading: false, error: null }, round: null },
  noleaderboard: {
    now: NOW,
    leaderboard: { ...BOARD, players: [], prizePool: 0, error: 'HTTP 502' },
    countdown: { unknown: true },
    hunts: { live: null, recent: [LAST_HUNT], loading: false, error: null },
    round: null,
  },
};
