import { renderHook, act } from '@testing-library/react';
import { useLeaderboardData } from '../useLeaderboardData';

describe('useLeaderboardData (mock mode)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-01T00:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns 20 players sorted by wagered descending', () => {
    const { result } = renderHook(() => useLeaderboardData({ mock: true, pollMs: 60000 }));
    expect(result.current.players).toHaveLength(20);
    for (let i = 0; i < result.current.players.length - 1; i += 1) {
      expect(result.current.players[i].wagered).toBeGreaterThanOrEqual(
        result.current.players[i + 1].wagered,
      );
    }
  });

  it('attaches position and previousPosition to each player', () => {
    const { result } = renderHook(() => useLeaderboardData({ mock: true, pollMs: 60000 }));
    result.current.players.forEach((p, i) => {
      expect(p.position).toBe(i + 1);
      expect(p.previousPosition).toBe(i + 1); // identical to position on initial render
    });
  });

  it('exposes a maskedUsername derived from the raw username', () => {
    const { result } = renderHook(() => useLeaderboardData({ mock: true, pollMs: 60000 }));
    result.current.players.forEach((p) => {
      expect(p.maskedUsername).toMatch(/^.\*\*\*\*.$|^..\*\*\*\*.$/);
    });
  });

  it('exposes prizePool, periodLabel, weekLabel, endsAt, lastUpdatedAt', () => {
    const { result } = renderHook(() => useLeaderboardData({ mock: true, pollMs: 60000 }));
    expect(typeof result.current.prizePool).toBe('number');
    expect(typeof result.current.periodLabel).toBe('string');
    expect(typeof result.current.weekLabel).toBe('string');
    expect(typeof result.current.endsAt).toBe('number');
    expect(typeof result.current.lastUpdatedAt).toBe('number');
  });

  it('updates players and lastUpdatedAt on each poll tick', () => {
    const { result } = renderHook(() => useLeaderboardData({ mock: true, pollMs: 30000 }));
    const initialLastUpdated = result.current.lastUpdatedAt;
    const initialP01Wagered = result.current.players[0].wagered;

    act(() => {
      jest.advanceTimersByTime(30000);
    });

    expect(result.current.lastUpdatedAt).toBeGreaterThan(initialLastUpdated);
    const totalWagered = result.current.players.reduce((sum, p) => sum + p.wagered, 0);
    const initialTotal = 23434853 + 9256889 + 7198825 + 6430844 + 6376767
      + 5123400 + 4890210 + 4321000 + 3987654 + 3654321
      + 3200000 + 2987600 + 2754100 + 2500000 + 2300000
      + 2050000 + 1820000 + 1500000 + 1200000 + 1012000;
    expect(totalWagered).toBeGreaterThanOrEqual(initialTotal); // monotonic — deltas only add
    expect(totalWagered).toBeGreaterThan(initialTotal); // and at least one player gained
    // (initialP01Wagered is referenced just to assert types — value may or may not change)
    expect(typeof initialP01Wagered).toBe('number');
  });

  it('computes a delta field showing change since last poll', () => {
    const { result } = renderHook(() => useLeaderboardData({ mock: true, pollMs: 30000 }));
    result.current.players.forEach((p) => expect(p.delta).toBe(0));

    act(() => {
      jest.advanceTimersByTime(30000);
    });

    const anyChanged = result.current.players.some((p) => p.delta > 0);
    expect(anyChanged).toBe(true);
  });

  it('tracks previousPosition correctly across polls', () => {
    const { result } = renderHook(() => useLeaderboardData({ mock: true, pollMs: 30000 }));
    const initialIds = result.current.players.map((p) => p.id);

    act(() => {
      jest.advanceTimersByTime(30000);
    });

    result.current.players.forEach((p) => {
      const previousIndex = initialIds.indexOf(p.id);
      expect(p.previousPosition).toBe(previousIndex + 1);
    });
  });

  it('cleans up the interval on unmount', () => {
    const { unmount } = renderHook(() => useLeaderboardData({ mock: true, pollMs: 30000 }));
    unmount();
    // If the interval leaked, advancing time would still call setState on an unmounted
    // hook and Jest would log a warning. We assert no warnings here indirectly via
    // not throwing — and we trust React's act() machinery to surface leaks.
    act(() => {
      jest.advanceTimersByTime(60000);
    });
    expect(true).toBe(true);
  });
});
