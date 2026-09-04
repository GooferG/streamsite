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
import { mapBeanBoard } from '../utils/beanLeaderboard';

// Live standings come from /api/leaderboard, which proxies the bean site's
// public board for the Rainbet "code BEAN" leaderboard (recounted upstream
// every 15 minutes). `mock: true` keeps the deterministic demo data for tests
// and layout work.

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

// Fixed demo end date for mock mode. NOTE: month is 0-indexed.
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
  mock: false,
  pollMs: 60000,
  endpoint: '/api/leaderboard',
  // Mock-mode pool. Live mode reads the pool bean advertises.
  prizePool: PRIZE_POOL_TOTAL,
  referralCode: LEADERBOARD.referralCode,
  brand: LEADERBOARD.brand,
};

function liveInitialState() {
  return {
    players: [],
    prizePool: 0,
    paidPlaces: 0,
    lastUpdatedAt: Date.now(),
    endsAt: null,
    periodLabel: 'CURRENT PERIOD',
    weekLabel: 'LIVE',
    isLoading: true,
    error: null,
  };
}

export function useLeaderboardData(options = {}) {
  const { mock, pollMs, endpoint, prizePool, referralCode, brand } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const baselineRef = useRef(null);
  if (mock && baselineRef.current === null) {
    baselineRef.current = getBaselinePlayers();
  }

  const [state, setState] = useState(() => {
    if (!mock) return liveInitialState();
    const initial = baselineRef.current;
    return {
      players: attachPositions(initial),
      prizePool,
      paidPlaces: initial.length,
      lastUpdatedAt: Date.now(),
      endsAt: leaderboardEndsAt(),
      periodLabel: currentPeriodLabel(),
      weekLabel: currentWeekLabel(),
      isLoading: false,
      error: null,
    };
  });

  const seedRef = useRef(1);

  // Mock mode: deterministic simulated polls.
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
          ...prev,
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

  // Live mode: poll our proxy of bean's board.
  useEffect(() => {
    if (mock) return undefined;
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(endpoint);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = await res.json();
        if (cancelled) return;
        const board = payload && payload.board;
        setState((prev) => {
          if (!board) {
            // Nothing polled upstream yet. Keep whatever we last showed; only
            // report unavailable when there is nothing to show at all.
            return {
              ...prev,
              isLoading: false,
              error: prev.players.length ? prev.error : 'Standings unavailable',
            };
          }
          const mapped = mapBeanBoard(board, {
            previousPlayers: prev.players,
            now: Date.now(),
          });
          return { ...mapped, isLoading: false, error: null };
        });
      } catch (e) {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: e && e.message ? e.message : 'fetch failed',
        }));
      }
    };

    load();
    const id = setInterval(load, pollMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [mock, pollMs, endpoint]);

  return {
    players: state.players,
    prizePool: mock ? prizePool : state.prizePool,
    paidPlaces: state.paidPlaces,
    referralCode,
    brand,
    periodLabel: state.periodLabel,
    weekLabel: state.weekLabel,
    endsAt: state.endsAt,
    lastUpdatedAt: state.lastUpdatedAt,
    isLoading: state.isLoading,
    error: state.error,
  };
}
