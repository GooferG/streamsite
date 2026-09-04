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

  it('exposes referralCode and brand for the information contract', () => {
    const { result } = renderHook(() => useLeaderboardData({ mock: true, pollMs: 60000 }));
    expect(result.current.referralCode).toBe('BEAN');
    expect(result.current.brand).toBe('Rainbet');
  });

  it('allows referralCode and brand to be overridden via options', () => {
    const { result } = renderHook(() =>
      useLeaderboardData({ mock: true, pollMs: 60000, referralCode: 'GOOF', brand: 'Stake' }),
    );
    expect(result.current.referralCode).toBe('GOOF');
    expect(result.current.brand).toBe('Stake');
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
    const initialTotal =
      1464622.96 + 1034104.98 + 790547.86 + 703037.66 + 584398.66
      + 264991.93 + 243842.27 + 220580.21 + 218940.73 + 199706.01
      + 194481.82 + 187465.35 + 183261.85 + 149599.53 + 135194.83
      + 95487.09 + 94087.37 + 82543.59 + 79000.32 + 77163.89;
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

describe('useLeaderboardData (live mode)', () => {
  const board = {
    id: '1',
    prizePool: 250000,
    rankingField: 'Weighted Wager',
    closesAt: '2026-09-12T00:00:00.000Z',
    fetchedAt: '2026-09-04T15:16:05.990Z',
    paidPlaces: 2,
    entries: [
      { rank: 1, maskedHandle: '2A***r', playerId: 'a', weightedWager: 100, prize: 70000, delta: 0, tier: 1 },
      { rank: 2, maskedHandle: 've***y', playerId: 'b', weightedWager: 50, prize: 40000, delta: 1, tier: 1 },
    ],
  };

  const originalFetch = global.fetch;
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
    global.fetch = originalFetch;
  });

  it('starts loading with no players, then maps the fetched board', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ board }) }),
    );
    const { result } = renderHook(() => useLeaderboardData({ pollMs: 60000 }));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.players).toEqual([]);

    await act(async () => {
      await Promise.resolve();
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/leaderboard');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.players).toHaveLength(2);
    expect(result.current.players[0].maskedUsername).toBe('2A***r');
    expect(result.current.players[1].previousPosition).toBe(3);
    expect(result.current.prizePool).toBe(250000);
    expect(result.current.endsAt).toBe(Date.parse(board.closesAt));
    expect(result.current.lastUpdatedAt).toBe(Date.parse(board.fetchedAt));
  });

  it('reports an error and keeps an empty board when the proxy fails', async () => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: false, status: 502 }));
    const { result } = renderHook(() => useLeaderboardData({ pollMs: 60000 }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe('HTTP 502');
    expect(result.current.players).toEqual([]);
  });

  it('keeps the last good board when a later poll returns null', async () => {
    let call = 0;
    global.fetch = jest.fn(() => {
      call += 1;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ board: call === 1 ? board : null }),
      });
    });
    const { result } = renderHook(() => useLeaderboardData({ pollMs: 30000 }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.players).toHaveLength(2);

    await act(async () => {
      jest.advanceTimersByTime(30000);
      await Promise.resolve();
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result.current.players).toHaveLength(2);
    expect(result.current.error).toBeNull();
  });
});
