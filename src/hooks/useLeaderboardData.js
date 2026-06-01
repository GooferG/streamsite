import { useEffect, useRef, useState } from 'react';
import {
  getBaselinePlayers,
  applyDeltas,
  generatePollDeltas,
} from '../components/Leaderboard/mockData';
import {
  maskUsername,
  getPrizeForPosition,
  PRIZE_POOL_TOTAL,
} from '../components/Leaderboard/format';
import { LEADERBOARD } from '../constants';

function attachPositions(players, previousIds = null, deltasById = {}) {
  const previousIndexById = previousIds
    ? Object.fromEntries(previousIds.map((id, i) => [id, i]))
    : null;
  return players.map((p, i) => ({
    ...p,
    position: i + 1,
    previousPosition:
      previousIndexById && previousIndexById[p.id] !== undefined
        ? previousIndexById[p.id] + 1
        : i + 1,
    delta: deltasById[p.id] || 0,
    maskedUsername: maskUsername(p.username),
    prize: getPrizeForPosition(i + 1),
  }));
}

// Fixed demo end date. Set this to whenever you want the leaderboard race to
// end; once it passes, the countdown shows the "leaderboard over" state. To
// "reset" the demo, change this to a future date.
// NOTE: month is 0-indexed — January = 0, June = 5, December = 11.
function leaderboardEndsAt() {
  return new Date(2026, 5, 13, 23, 59, 59).getTime(); // 2026-06-13 23:59:59
}

function currentPeriodLabel() {
  const now = new Date();
  return now
    .toLocaleString('en-US', { month: 'long', year: 'numeric' })
    .toUpperCase();
}

function currentWeekLabel() {
  const now = new Date();
  const dayOfMonth = now.getDate();
  const week = Math.min(4, Math.max(1, Math.ceil(dayOfMonth / 7)));
  return `WK 0${week} OF 04`;
}

const DEFAULT_OPTIONS = {
  mock: true,
  pollMs: 45000,
  prizePool: PRIZE_POOL_TOTAL,
  referralCode: LEADERBOARD.referralCode,
  brand: LEADERBOARD.brand,
};

export function useLeaderboardData(options = {}) {
  const { mock, pollMs, prizePool, referralCode, brand } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const baselineRef = useRef(null);
  if (baselineRef.current === null) {
    baselineRef.current = getBaselinePlayers();
  }

  const [state, setState] = useState(() => {
    const initial = baselineRef.current;
    return {
      players: attachPositions(initial),
      lastUpdatedAt: Date.now(),
      endsAt: leaderboardEndsAt(),
      periodLabel: currentPeriodLabel(),
      weekLabel: currentWeekLabel(),
    };
  });

  const seedRef = useRef(1);

  useEffect(() => {
    if (!mock) return undefined;

    const tick = () => {
      setState((prev) => {
        const stripped = prev.players.map(({ id, username, wagered }) => ({
          id,
          username,
          wagered,
        }));
        const previousIds = stripped.map((p) => p.id);
        const seed = seedRef.current;
        seedRef.current += 1;
        const deltas = generatePollDeltas(stripped, { seed });
        const next = applyDeltas(stripped, deltas);
        const nextEndsAt = leaderboardEndsAt();
        const nextPeriodLabel = currentPeriodLabel();
        const nextWeekLabel = currentWeekLabel();
        return {
          players: attachPositions(next, previousIds, deltas),
          lastUpdatedAt: Date.now(),
          endsAt: nextEndsAt === prev.endsAt ? prev.endsAt : nextEndsAt,
          periodLabel:
            nextPeriodLabel === prev.periodLabel ? prev.periodLabel : nextPeriodLabel,
          weekLabel:
            nextWeekLabel === prev.weekLabel ? prev.weekLabel : nextWeekLabel,
        };
      });
    };

    const id = setInterval(tick, pollMs);
    return () => clearInterval(id);
  }, [mock, pollMs]);

  return {
    players: state.players,
    prizePool,
    referralCode,
    brand,
    periodLabel: state.periodLabel,
    weekLabel: state.weekLabel,
    endsAt: state.endsAt,
    lastUpdatedAt: state.lastUpdatedAt,
    isLoading: false,
    error: null,
  };
}
