import { useEffect, useRef, useState } from 'react';
import {
  getBaselinePlayers,
  applyDeltas,
  generatePollDeltas,
} from '../components/Leaderboard/mockData';
import { maskUsername } from '../components/Leaderboard/format';

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
  }));
}

function thirtyDaysFromMonthStart() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return monthStart.getTime() + 30 * 24 * 60 * 60 * 1000;
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
  prizePool: 25000,
};

export function useLeaderboardData(options = {}) {
  const { mock, pollMs, prizePool } = { ...DEFAULT_OPTIONS, ...options };

  const baselineRef = useRef(null);
  if (baselineRef.current === null) {
    baselineRef.current = getBaselinePlayers();
  }

  const [state, setState] = useState(() => {
    const initial = baselineRef.current;
    return {
      players: attachPositions(initial),
      lastUpdatedAt: Date.now(),
      endsAt: thirtyDaysFromMonthStart(),
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
        const nextEndsAt = thirtyDaysFromMonthStart();
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
    periodLabel: state.periodLabel,
    weekLabel: state.weekLabel,
    endsAt: state.endsAt,
    lastUpdatedAt: state.lastUpdatedAt,
    isLoading: false,
    error: null,
  };
}
