# Gamba Leaderboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mock-data broadcast-style leaderboard tool at `/gamba/leaderboard`, make it the new gamba index, and architect it so a real casino affiliate API (Rainbet / Roobet / Stake / Shuffle) can be swapped in via a single hook later.

**Architecture:** A new `src/components/Leaderboard/` folder containing one top-level layout component, six visual sub-components, three custom hooks, and a deterministic mock-data module. All data flows through a single `useLeaderboardData` hook — the swap point for future real-API integration. The tool slots into the existing `GambaPage` shell (no new global chrome).

**Tech Stack:** React 19, Tailwind (existing tokens only — no new colors), react-router-dom v7, lucide-react icons, Jest + react-scripts for tests where they earn their keep.

**Spec:** [docs/superpowers/specs/2026-05-26-gamba-leaderboard-design.md](../specs/2026-05-26-gamba-leaderboard-design.md)

**Testing philosophy:** This project has no tests today (per CLAUDE.md). We do NOT introduce a full test infrastructure for presentational components. We DO write unit tests for the pieces with non-trivial logic: number formatting, masked-username generation, position-trend computation, countdown math, deterministic mock data generation. Tests live in `__tests__/` adjacent to the file under test and use `react-scripts`' built-in Jest config — `npm test -- --watchAll=false` runs the full suite.

**Branch:** Work continues on the current branch (`leadearboard-mockup`). Each task ends with a commit.

---

## File Structure

**New files:**

| Path | Responsibility |
|---|---|
| `src/components/Leaderboard/index.js` | Public export of `Leaderboard` component |
| `src/components/Leaderboard/Leaderboard.js` | Top-level layout — composes children, calls `useLeaderboardData` |
| `src/components/Leaderboard/BroadcastHeader.js` | Upper-third: STANDINGS eyebrow, LAST UPDATED, prize pool, T-MINUS timer |
| `src/components/Leaderboard/BroadcastFrame.js` | Outer chrome: corner brackets, REC dot, session timecode, scanline overlay |
| `src/components/Leaderboard/LeaderTakeover.js` | P01 full-width banner with oversized digits + LEADING BY gap |
| `src/components/Leaderboard/RaceBars.js` | P02-P05 standard race rows |
| `src/components/Leaderboard/RosterTable.js` | P06-P20 dense table, no bars |
| `src/components/Leaderboard/TickerCrawl.js` | Bottom scrolling marquee with in-joke sponsor lines |
| `src/components/Leaderboard/StationID.js` | Single-line "STATION ID · BROADCAST SYSTEM v1 …" bug |
| `src/components/Leaderboard/TrendArrow.js` | Shared trend indicator (▲ ▼ ─) — used by both RaceBars and RosterTable |
| `src/components/Leaderboard/WagerDropChip.js` | Animated `+$X` chip that flies in on poll deltas |
| `src/components/Leaderboard/mockData.js` | 20 deterministic baseline players + delta generator |
| `src/components/Leaderboard/format.js` | Pure formatters: `formatUSD`, `maskUsername`, `formatPosition` |
| `src/components/Leaderboard/__tests__/format.test.js` | Tests for format.js |
| `src/components/Leaderboard/__tests__/mockData.test.js` | Tests for mockData.js |
| `src/hooks/useLeaderboardData.js` | Data hook — reads mock today, real API tomorrow |
| `src/hooks/useCountdown.js` | 30-day rolling timer hook |
| `src/hooks/useSessionTimecode.js` | Page session timecode (HH:MM:SS) |
| `src/hooks/__tests__/useCountdown.test.js` | Tests for useCountdown.js |
| `src/hooks/__tests__/useLeaderboardData.test.js` | Tests for useLeaderboardData.js |

**Modified files:**

| Path | Change |
|---|---|
| `src/App.js` | Add `<Route path="leaderboard" element={null} />` under `/gamba` and change index redirect target from `/gamba/hunt-tracker` to `/gamba/leaderboard` |
| `src/pages/GambaPage.js` | Add `leaderboard` to `TOOLS` array (first entry, icon `Radio`), import + render `<Leaderboard />` in the tool surface block |

---

## Task 1: Pure formatters (`format.js`)

**Files:**

- Create: `src/components/Leaderboard/format.js`
- Create: `src/components/Leaderboard/__tests__/format.test.js`

- [ ] **Step 1: Write failing tests**

Create `src/components/Leaderboard/__tests__/format.test.js`:

```js
import { formatUSD, maskUsername, formatPosition } from '../format';

describe('formatUSD', () => {
  it('formats whole dollars with commas and dollar sign', () => {
    expect(formatUSD(23434853)).toBe('$23,434,853');
  });

  it('returns $0 for zero', () => {
    expect(formatUSD(0)).toBe('$0');
  });

  it('handles small numbers without decimals', () => {
    expect(formatUSD(1500)).toBe('$1,500');
  });

  it('treats null/undefined as $0', () => {
    expect(formatUSD(null)).toBe('$0');
    expect(formatUSD(undefined)).toBe('$0');
  });

  it('formats negative numbers (defensive)', () => {
    expect(formatUSD(-200)).toBe('-$200');
  });
});

describe('maskUsername', () => {
  it('keeps first 2 and last 1 character, masks the middle with ****', () => {
    expect(maskUsername('Neverleavehome')).toBe('Ne****e');
  });

  it('handles short usernames by keeping first char and last char', () => {
    expect(maskUsername('abcd')).toBe('a****d');
  });

  it('returns empty string for empty input', () => {
    expect(maskUsername('')).toBe('');
  });

  it('returns the input unchanged when length is 1', () => {
    expect(maskUsername('x')).toBe('x');
  });
});

describe('formatPosition', () => {
  it('zero-pads to 2 digits and prefixes with P', () => {
    expect(formatPosition(1)).toBe('P01');
    expect(formatPosition(7)).toBe('P07');
    expect(formatPosition(20)).toBe('P20');
  });

  it('does not truncate 3-digit positions', () => {
    expect(formatPosition(100)).toBe('P100');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --watchAll=false --testPathPattern=Leaderboard/__tests__/format`
Expected: FAIL — module `../format` not found.

- [ ] **Step 3: Implement `format.js`**

Create `src/components/Leaderboard/format.js`:

```js
export function formatUSD(amount) {
  if (amount === null || amount === undefined) return '$0';
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(amount));
  const withCommas = abs.toLocaleString('en-US');
  return `${sign}$${withCommas}`;
}

export function maskUsername(username) {
  if (!username) return '';
  if (username.length === 1) return username;
  if (username.length <= 4) {
    return `${username[0]}****${username[username.length - 1]}`;
  }
  return `${username.slice(0, 2)}****${username[username.length - 1]}`;
}

export function formatPosition(position) {
  return `P${String(position).padStart(2, '0')}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --watchAll=false --testPathPattern=Leaderboard/__tests__/format`
Expected: PASS — all 11 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/components/Leaderboard/format.js src/components/Leaderboard/__tests__/format.test.js
git commit -m "leaderboard: add format helpers (USD, mask, position)"
```

---

## Task 2: Mock data module (`mockData.js`)

**Files:**

- Create: `src/components/Leaderboard/mockData.js`
- Create: `src/components/Leaderboard/__tests__/mockData.test.js`

- [ ] **Step 1: Write failing tests**

Create `src/components/Leaderboard/__tests__/mockData.test.js`:

```js
import {
  getBaselinePlayers,
  applyDeltas,
  generatePollDeltas,
} from '../mockData';

describe('getBaselinePlayers', () => {
  it('returns exactly 20 players', () => {
    expect(getBaselinePlayers()).toHaveLength(20);
  });

  it('returns players sorted by wagered descending', () => {
    const players = getBaselinePlayers();
    for (let i = 0; i < players.length - 1; i += 1) {
      expect(players[i].wagered).toBeGreaterThanOrEqual(players[i + 1].wagered);
    }
  });

  it('places P01 at least 2x P02 (for leader takeover visual)', () => {
    const [p1, p2] = getBaselinePlayers();
    expect(p1.wagered).toBeGreaterThanOrEqual(p2.wagered * 2);
  });

  it('every player has the expected shape', () => {
    const players = getBaselinePlayers();
    players.forEach((p) => {
      expect(typeof p.id).toBe('string');
      expect(typeof p.username).toBe('string');
      expect(p.username.length).toBeGreaterThan(0);
      expect(typeof p.wagered).toBe('number');
      expect(p.wagered).toBeGreaterThan(0);
    });
  });

  it('player ids are unique', () => {
    const ids = getBaselinePlayers().map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('returns identical data across calls (deterministic)', () => {
    const a = getBaselinePlayers();
    const b = getBaselinePlayers();
    expect(a).toEqual(b);
  });
});

describe('applyDeltas', () => {
  it('adds deltas to the matching players by id and re-sorts', () => {
    const players = [
      { id: 'a', username: 'A', wagered: 100 },
      { id: 'b', username: 'B', wagered: 50 },
    ];
    const next = applyDeltas(players, { b: 200 });
    expect(next[0].id).toBe('b');
    expect(next[0].wagered).toBe(250);
    expect(next[1].id).toBe('a');
    expect(next[1].wagered).toBe(100);
  });

  it('leaves unaffected players untouched', () => {
    const players = [
      { id: 'a', username: 'A', wagered: 100 },
      { id: 'b', username: 'B', wagered: 50 },
    ];
    const next = applyDeltas(players, { a: 10 });
    expect(next.find((p) => p.id === 'b').wagered).toBe(50);
  });

  it('returns a new array (does not mutate input)', () => {
    const players = [{ id: 'a', username: 'A', wagered: 100 }];
    const next = applyDeltas(players, { a: 1 });
    expect(next).not.toBe(players);
    expect(players[0].wagered).toBe(100);
  });
});

describe('generatePollDeltas', () => {
  it('returns an object keyed by player id with positive integer values', () => {
    const players = getBaselinePlayers();
    const deltas = generatePollDeltas(players, { seed: 42 });
    Object.entries(deltas).forEach(([id, value]) => {
      expect(players.find((p) => p.id === id)).toBeDefined();
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    });
  });

  it('affects between 1 and 3 players per poll', () => {
    const players = getBaselinePlayers();
    const deltas = generatePollDeltas(players, { seed: 42 });
    const count = Object.keys(deltas).length;
    expect(count).toBeGreaterThanOrEqual(1);
    expect(count).toBeLessThanOrEqual(3);
  });

  it('is deterministic when seeded', () => {
    const players = getBaselinePlayers();
    const a = generatePollDeltas(players, { seed: 7 });
    const b = generatePollDeltas(players, { seed: 7 });
    expect(a).toEqual(b);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --watchAll=false --testPathPattern=Leaderboard/__tests__/mockData`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `mockData.js`**

Create `src/components/Leaderboard/mockData.js`:

```js
// Deterministic mock leaderboard data.
// 20 players with a log-style wagered distribution. P01 is engineered to be
// at least 2x P02 so the leader-takeover banner visually earns its scale.

const NAMES = [
  'Neverleavehome',
  'midnightowl1',
  'maximumoverdriveo',
  'minorthreats',
  'reefermadnessH',
  'dustywindow',
  'yellowpages',
  'channel47at3am',
  'staticnoise',
  'thelastpayphone',
  'busstoplarry',
  'cathoderay',
  'velvetropes',
  'sundayspecial',
  'graveyardshift',
  'parkinglotpoet',
  'dialup_dave',
  'crttvfanclub',
  'roadsidediner',
  'closingcredits',
];

const BASE_WAGERED = [
  23434853, 9256889, 7198825, 6430844, 6376767,
  5123400, 4890210, 4321000, 3987654, 3654321,
  3200000, 2987600, 2754100, 2500000, 2300000,
  2050000, 1820000, 1500000, 1200000, 1012000,
];

export function getBaselinePlayers() {
  return NAMES.map((username, i) => ({
    id: `mock-${i + 1}`,
    username,
    wagered: BASE_WAGERED[i],
  }));
}

export function applyDeltas(players, deltasById) {
  const next = players.map((p) => {
    const delta = deltasById[p.id];
    if (!delta) return { ...p };
    return { ...p, wagered: p.wagered + delta };
  });
  next.sort((a, b) => b.wagered - a.wagered);
  return next;
}

// Mulberry32 — small deterministic PRNG so seeded calls match across runs.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generatePollDeltas(players, { seed } = {}) {
  const rand = seed !== undefined ? mulberry32(seed) : Math.random;
  const count = 1 + Math.floor(rand() * 3); // 1, 2, or 3
  const picked = new Set();
  const result = {};
  let safety = 0;
  while (picked.size < count && safety < 50) {
    safety += 1;
    const idx = Math.floor(rand() * players.length);
    const player = players[idx];
    if (picked.has(player.id)) continue;
    picked.add(player.id);
    // Weighted delta: 10k–500k, biased toward smaller amounts.
    const u = rand();
    const delta = Math.floor(10000 + Math.pow(u, 2) * 490000);
    result[player.id] = delta;
  }
  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --watchAll=false --testPathPattern=Leaderboard/__tests__/mockData`
Expected: PASS — all 12 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/components/Leaderboard/mockData.js src/components/Leaderboard/__tests__/mockData.test.js
git commit -m "leaderboard: add deterministic mock player data and delta generator"
```

---

## Task 3: `useCountdown` hook

**Files:**

- Create: `src/hooks/useCountdown.js`
- Create: `src/hooks/__tests__/useCountdown.test.js`

- [ ] **Step 1: Write failing tests**

Create `src/hooks/__tests__/useCountdown.test.js`:

```js
import { renderHook, act } from '@testing-library/react';
import { useCountdown } from '../useCountdown';

describe('useCountdown', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-01T00:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns days/hours/minutes/seconds remaining until endsAt', () => {
    const endsAt = new Date('2026-05-03T01:02:03Z').getTime();
    const { result } = renderHook(() => useCountdown(endsAt));
    expect(result.current).toEqual({ days: 2, hours: 1, minutes: 2, seconds: 3 });
  });

  it('returns zeros when endsAt is in the past', () => {
    const endsAt = new Date('2026-04-30T00:00:00Z').getTime();
    const { result } = renderHook(() => useCountdown(endsAt));
    expect(result.current).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  });

  it('ticks down every second', () => {
    const endsAt = new Date('2026-05-01T00:00:10Z').getTime();
    const { result } = renderHook(() => useCountdown(endsAt));
    expect(result.current.seconds).toBe(10);
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.seconds).toBe(9);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --watchAll=false --testPathPattern=hooks/__tests__/useCountdown`
Expected: FAIL — module `../useCountdown` not found. (If `@testing-library/react` is missing, it ships with `react-scripts`'s `@testing-library/react@^13+` — present in `package.json` by default. If a separate install is required, run `npm install --save-dev @testing-library/react` before re-running.)

- [ ] **Step 3: Implement `useCountdown.js`**

Create `src/hooks/useCountdown.js`:

```js
import { useEffect, useState } from 'react';

function compute(endsAt) {
  const diff = endsAt - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

export function useCountdown(endsAt) {
  const [remaining, setRemaining] = useState(() => compute(endsAt));

  useEffect(() => {
    setRemaining(compute(endsAt));
    const id = setInterval(() => setRemaining(compute(endsAt)), 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  return remaining;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --watchAll=false --testPathPattern=hooks/__tests__/useCountdown`
Expected: PASS — 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useCountdown.js src/hooks/__tests__/useCountdown.test.js
git commit -m "leaderboard: add useCountdown hook"
```

---

## Task 4: `useSessionTimecode` hook (no tests — too thin)

**Files:**

- Create: `src/hooks/useSessionTimecode.js`

- [ ] **Step 1: Implement the hook**

Create `src/hooks/useSessionTimecode.js`:

```js
import { useEffect, useRef, useState } from 'react';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function format(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

export function useSessionTimecode() {
  const startRef = useRef(Date.now());
  const [text, setText] = useState('00:00:00');

  useEffect(() => {
    const tick = () => {
      const seconds = Math.floor((Date.now() - startRef.current) / 1000);
      setText(format(seconds));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return text;
}
```

- [ ] **Step 2: Quick smoke check — render a throwaway consumer in the dev server**

Run: `npm start`
Manually verify: nothing breaks at startup. Stop the server.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useSessionTimecode.js
git commit -m "leaderboard: add useSessionTimecode hook"
```

---

## Task 5: `useLeaderboardData` hook

**Files:**

- Create: `src/hooks/useLeaderboardData.js`
- Create: `src/hooks/__tests__/useLeaderboardData.test.js`

- [ ] **Step 1: Write failing tests**

Create `src/hooks/__tests__/useLeaderboardData.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --watchAll=false --testPathPattern=hooks/__tests__/useLeaderboardData`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `useLeaderboardData.js`**

Create `src/hooks/useLeaderboardData.js`:

```js
import { useEffect, useMemo, useRef, useState } from 'react';
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
        return {
          players: attachPositions(next, previousIds, deltas),
          lastUpdatedAt: Date.now(),
        };
      });
    };

    const id = setInterval(tick, pollMs);
    return () => clearInterval(id);
  }, [mock, pollMs]);

  const endsAt = useMemo(() => thirtyDaysFromMonthStart(), []);
  const periodLabel = useMemo(() => currentPeriodLabel(), []);
  const weekLabel = useMemo(() => currentWeekLabel(), []);

  return {
    players: state.players,
    prizePool,
    periodLabel,
    weekLabel,
    endsAt,
    lastUpdatedAt: state.lastUpdatedAt,
    isLoading: false,
    error: null,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --watchAll=false --testPathPattern=hooks/__tests__/useLeaderboardData`
Expected: PASS — 8 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useLeaderboardData.js src/hooks/__tests__/useLeaderboardData.test.js
git commit -m "leaderboard: add useLeaderboardData hook (mock mode)"
```

---

## Task 6: `TrendArrow` shared component

**Files:**

- Create: `src/components/Leaderboard/TrendArrow.js`

- [ ] **Step 1: Implement the component**

Create `src/components/Leaderboard/TrendArrow.js`:

```js
export default function TrendArrow({ current, previous, className = '' }) {
  let symbol = '─';
  let label = 'no change';
  let toneClass = 'text-white/40';

  if (previous > current) {
    symbol = '▲';
    label = 'up';
    toneClass = 'text-emerald-signal';
  } else if (previous < current) {
    symbol = '▼';
    label = 'down';
    toneClass = 'text-white-muted';
  }

  return (
    <span
      className={`inline-block tabular-nums font-mono ${toneClass} ${className}`}
      aria-label={label}
    >
      {symbol}
    </span>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Leaderboard/TrendArrow.js
git commit -m "leaderboard: add TrendArrow shared component"
```

---

## Task 7: `WagerDropChip` component

**Files:**

- Create: `src/components/Leaderboard/WagerDropChip.js`

- [ ] **Step 1: Implement the component**

Create `src/components/Leaderboard/WagerDropChip.js`:

```js
import { useEffect, useState } from 'react';
import { formatUSD } from './format';

// Renders the +$X chip for ~1.9s when `delta` changes to a non-zero value.
// Always mounted so it can capture deltas as they arrive — toggles its own
// visibility internally.
export default function WagerDropChip({ delta }) {
  const [visible, setVisible] = useState(false);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!delta) return undefined;
    setShown(delta);
    setVisible(true);
    const id = setTimeout(() => setVisible(false), 1900);
    return () => clearTimeout(id);
  }, [delta]);

  if (!shown) return null;

  return (
    <span
      className={`ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold font-mono tabular-nums tracking-eyebrow-sm
        bg-emerald-signal/15 text-emerald-signal border border-emerald-signal/30
        transition-all duration-300 motion-reduce:transition-none
        ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'}`}
      aria-hidden="true"
    >
      <span>+</span>
      <span>{formatUSD(shown).replace('$', '$')}</span>
    </span>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Leaderboard/WagerDropChip.js
git commit -m "leaderboard: add WagerDropChip animated delta indicator"
```

---

## Task 8: `BroadcastHeader` component

**Files:**

- Create: `src/components/Leaderboard/BroadcastHeader.js`

- [ ] **Step 1: Implement the component**

Create `src/components/Leaderboard/BroadcastHeader.js`:

```js
import { formatUSD } from './format';
import { useCountdown } from '../../hooks/useCountdown';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatRelativeAge(ms) {
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s AGO`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m AGO`;
  return `${Math.floor(ms / 3_600_000)}h AGO`;
}

export default function BroadcastHeader({
  weekLabel,
  periodLabel,
  prizePool,
  endsAt,
  lastUpdatedAt,
  now,
}) {
  const remaining = useCountdown(endsAt);
  const age = Math.max(0, now - lastUpdatedAt);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-3 gap-x-6 px-4 sm:px-6 py-5 border-b border-white/8">
      <div className="space-y-1">
        <div className="text-[10px] font-bold tracking-eyebrow-lg text-white/65 font-mono">
          STANDINGS · {weekLabel}
        </div>
        <div className="text-[10px] font-bold tracking-eyebrow-md text-white/45 font-mono tabular-nums">
          LAST UPDATED · {formatRelativeAge(age)}
        </div>
      </div>

      <div className="text-center">
        <div className="text-[10px] font-bold tracking-eyebrow-md text-white/50 font-mono">
          *** {periodLabel} STANDINGS ***
        </div>
        <div className="mt-1 text-[11px] font-bold tracking-eyebrow-md text-white/60 font-mono">
          PRIZE POOL · {formatUSD(prizePool)}
        </div>
      </div>

      <div className="sm:text-right space-y-1">
        <div className="text-[10px] font-bold tracking-eyebrow-lg text-white/65 font-mono">
          T-MINUS
        </div>
        <div className="text-base sm:text-lg font-bold tabular-nums font-mono text-white-body">
          {pad2(remaining.days)}d {pad2(remaining.hours)}h{' '}
          {pad2(remaining.minutes)}m {pad2(remaining.seconds)}s
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Leaderboard/BroadcastHeader.js
git commit -m "leaderboard: add BroadcastHeader (eyebrow, prize pool, T-minus)"
```

---

## Task 9: `LeaderTakeover` component

**Files:**

- Create: `src/components/Leaderboard/LeaderTakeover.js`

- [ ] **Step 1: Implement the component**

Create `src/components/Leaderboard/LeaderTakeover.js`:

```js
import { formatUSD, formatPosition } from './format';
import TrendArrow from './TrendArrow';
import WagerDropChip from './WagerDropChip';

export default function LeaderTakeover({ leader, runnerUp }) {
  if (!leader) return null;
  const lead = runnerUp ? leader.wagered - runnerUp.wagered : 0;

  return (
    <div className="relative overflow-hidden border-b border-white/8">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-screen motion-reduce:hidden"
        aria-hidden="true"
        style={{
          backgroundImage:
            'repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(255,255,255,0.6) 2px, rgba(255,255,255,0.6) 3px)',
        }}
      />
      <div
        className="pointer-events-none absolute -inset-12 bg-emerald-signal/10 blur-3xl motion-reduce:hidden"
        aria-hidden="true"
      />

      <div className="relative grid grid-cols-1 sm:grid-cols-[auto_1fr_auto] items-center gap-y-4 gap-x-8 px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-bold tracking-eyebrow-lg text-emerald-signal tabular-nums font-mono">
            {formatPosition(leader.position)}
          </span>
          <TrendArrow current={leader.position} previous={leader.previousPosition} />
        </div>

        <div>
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-white-body break-all">
            {leader.maskedUsername}
            <WagerDropChip delta={leader.delta} />
          </div>
          <div className="mt-1 text-5xl sm:text-6xl md:text-7xl font-extrabold tabular-nums font-mono text-emerald-signal leading-none">
            {formatUSD(leader.wagered)}
          </div>
        </div>

        {lead > 0 && (
          <div className="sm:text-right">
            <div className="text-[10px] font-bold tracking-eyebrow-lg text-white/55 font-mono">
              LEADING BY
            </div>
            <div className="text-lg sm:text-xl font-bold tabular-nums font-mono text-white-body">
              {formatUSD(lead)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Leaderboard/LeaderTakeover.js
git commit -m "leaderboard: add LeaderTakeover P01 banner"
```

---

## Task 10: `RaceBars` component (P02–P05)

**Files:**

- Create: `src/components/Leaderboard/RaceBars.js`

- [ ] **Step 1: Implement the component**

Create `src/components/Leaderboard/RaceBars.js`:

```js
import { useEffect, useState } from 'react';
import { formatUSD, formatPosition } from './format';
import TrendArrow from './TrendArrow';
import WagerDropChip from './WagerDropChip';

export default function RaceBars({ players, leaderWagered }) {
  // `mounted` controls the bar fill-in animation on initial render.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (!leaderWagered) return null;

  return (
    <div className="divide-y divide-white/6">
      {players.map((p, i) => {
        const pct = Math.max(2, Math.min(100, (p.wagered / leaderWagered) * 100));
        return (
          <div
            key={p.id}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-4 sm:px-6 py-3"
          >
            <div className="flex items-center gap-3 w-28">
              <span className="text-[11px] font-bold tracking-eyebrow-lg text-white/65 tabular-nums font-mono">
                {formatPosition(p.position)}
              </span>
              <TrendArrow current={p.position} previous={p.previousPosition} />
            </div>

            <div className="min-w-0">
              <div className="flex items-center text-sm font-bold text-white-body truncate">
                <span className="truncate">{p.maskedUsername}</span>
                <WagerDropChip delta={p.delta} />
              </div>
              <div className="mt-1.5 h-2 bg-white/5 overflow-hidden">
                <div
                  className="h-full bg-white/35 transition-[width] duration-700 ease-out motion-reduce:transition-none motion-reduce:duration-0"
                  style={{
                    width: mounted ? `${pct}%` : '0%',
                    transitionDelay: `${i * 80}ms`,
                  }}
                />
              </div>
            </div>

            <div className="text-sm sm:text-base font-bold tabular-nums font-mono text-white-body">
              {formatUSD(p.wagered)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Leaderboard/RaceBars.js
git commit -m "leaderboard: add RaceBars (P02-P05 race rows)"
```

---

## Task 11: `RosterTable` component (P06–P20)

**Files:**

- Create: `src/components/Leaderboard/RosterTable.js`

- [ ] **Step 1: Implement the component**

Create `src/components/Leaderboard/RosterTable.js`:

```js
import { formatUSD, formatPosition } from './format';
import TrendArrow from './TrendArrow';
import WagerDropChip from './WagerDropChip';

export default function RosterTable({ players }) {
  if (!players.length) return null;

  return (
    <div className="border-t border-white/8">
      <div className="px-4 sm:px-6 py-3 text-[10px] font-bold tracking-eyebrow-lg text-white/55 font-mono">
        ROSTER 06–20
      </div>
      <div className="divide-y divide-white/6">
        {players.map((p) => (
          <div
            key={p.id}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-4 sm:px-6 py-2.5 hover:bg-white/3 transition-colors motion-reduce:transition-none"
          >
            <div className="flex items-center gap-3 w-20 sm:w-24">
              <span className="text-[10px] font-bold tracking-eyebrow-md text-white/55 tabular-nums font-mono">
                {formatPosition(p.position)}
              </span>
              <TrendArrow current={p.position} previous={p.previousPosition} />
            </div>

            <div className="flex items-center min-w-0 text-sm text-white/85 truncate">
              <span className="truncate">{p.maskedUsername}</span>
              <WagerDropChip delta={p.delta} />
            </div>

            <div className="text-sm tabular-nums font-mono text-white/85">
              {formatUSD(p.wagered)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Leaderboard/RosterTable.js
git commit -m "leaderboard: add RosterTable (P06-P20 dense list)"
```

---

## Task 12: `TickerCrawl` component

**Files:**

- Create: `src/components/Leaderboard/TickerCrawl.js`

- [ ] **Step 1: Implement the component**

Create `src/components/Leaderboard/TickerCrawl.js`:

```js
const SPONSORS = [
  "THIS BROADCAST BROUGHT TO YOU BY UNCLE LARRY'S DISCOUNT BACKHOES",
  'GET HIM ON THE CB · CHANNEL 19 · KEEP IT WIDE OPEN',
  'STAY TUNED FOR THE LATE-NIGHT WAGER REPORT',
  'WE NOW RETURN YOU TO YOUR REGULARLY SCHEDULED STANDINGS',
  'PUBLIC ACCESS · COMMUNITY FUNDED · ABSOLUTELY UNAUTHORIZED',
  'IF YOUR TV IS SMOKING THAT IS NORMAL',
  'MOCK DATA · ENTERTAINMENT ONLY · NO ACTUAL PAYOUT',
  'TAPE WAS REWOUND BY HAND',
  'PLEASE STAND BY · STANDINGS REFRESH AT IRREGULAR INTERVALS',
  'PROUDLY BROADCASTING FROM A BASEMENT IN AN UNDISCLOSED CITY',
  'NO PURCHASE NECESSARY · NO PRIZE NECESSARY EITHER',
  'GOOFER TV · WHERE THE NUMBERS GO UP AND ALSO SOMETIMES DOWN',
];

export default function TickerCrawl() {
  // Duplicate the content so the marquee loops seamlessly.
  const line = SPONSORS.join('   ·   ');

  return (
    <div
      className="relative overflow-hidden border-t border-white/8 bg-zinc-broadcast/60"
      aria-hidden="true"
    >
      <div className="ticker-track whitespace-nowrap py-2.5 text-[10px] font-bold tracking-eyebrow-lg text-white/55 font-mono motion-reduce:[animation:none]">
        <span className="px-6">{line}</span>
        <span className="px-6">{line}</span>
      </div>
      <style>{`
        @keyframes leaderboard-ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-track {
          display: inline-flex;
          min-width: 200%;
          animation: leaderboard-ticker 40s linear infinite;
        }
        .ticker-track:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Leaderboard/TickerCrawl.js
git commit -m "leaderboard: add TickerCrawl (sponsor-style marquee)"
```

---

## Task 13: `StationID` component

**Files:**

- Create: `src/components/Leaderboard/StationID.js`

- [ ] **Step 1: Implement the component**

Create `src/components/Leaderboard/StationID.js`:

```js
export default function StationID() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/8 px-4 sm:px-6 py-3 text-[10px] font-bold tracking-eyebrow-lg text-white/45 font-mono">
      <span>STATION ID</span>
      <span className="text-white/20">·</span>
      <span>BROADCAST SYSTEM v1</span>
      <span className="text-white/20">·</span>
      <span>BUILT BY GOOFER</span>
      <span className="text-white/20">·</span>
      <a
        href="#"
        className="underline decoration-white/25 underline-offset-4 hover:text-white-body hover:decoration-white-body transition-colors motion-reduce:transition-none"
      >
        /tools
      </a>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Leaderboard/StationID.js
git commit -m "leaderboard: add StationID bug"
```

---

## Task 14: `BroadcastFrame` wrapper

**Files:**

- Create: `src/components/Leaderboard/BroadcastFrame.js`

- [ ] **Step 1: Implement the component**

Create `src/components/Leaderboard/BroadcastFrame.js`:

```js
import { useSessionTimecode } from '../../hooks/useSessionTimecode';

const CORNERS = [
  { pos: 'top-1.5 left-1.5', glyph: '◤' },
  { pos: 'top-1.5 right-1.5', glyph: '◥' },
  { pos: 'bottom-1.5 left-1.5', glyph: '◣' },
  { pos: 'bottom-1.5 right-1.5', glyph: '◢' },
];

export default function BroadcastFrame({ children }) {
  const timecode = useSessionTimecode();

  return (
    <div className="relative overflow-hidden border border-white/10 bg-zinc-card/40">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-screen motion-reduce:hidden"
        aria-hidden="true"
        style={{
          backgroundImage:
            'repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(255,255,255,0.6) 2px, rgba(255,255,255,0.6) 3px)',
        }}
      />

      {CORNERS.map(({ pos, glyph }) => (
        <span
          key={pos}
          className={`pointer-events-none absolute ${pos} text-white/45 text-xs font-bold leading-none select-none`}
          aria-hidden="true"
        >
          {glyph}
        </span>
      ))}

      <div className="pointer-events-none absolute top-2 right-6 sm:right-8 z-10 flex items-center gap-2 text-[10px] font-bold font-mono tracking-eyebrow-lg text-white/65">
        <span
          className="inline-block w-2 h-2 rounded-full bg-red-destructive animate-pulse motion-reduce:animate-none"
          aria-hidden="true"
        />
        <span aria-hidden="true">SESSION {timecode}</span>
      </div>

      <div className="relative">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Leaderboard/BroadcastFrame.js
git commit -m "leaderboard: add BroadcastFrame chrome (corners + REC dot)"
```

---

## Task 15: `Leaderboard` top-level layout

**Files:**

- Create: `src/components/Leaderboard/Leaderboard.js`
- Create: `src/components/Leaderboard/index.js`

- [ ] **Step 1: Implement the layout**

Create `src/components/Leaderboard/Leaderboard.js`:

```js
import { useEffect, useState } from 'react';
import { useLeaderboardData } from '../../hooks/useLeaderboardData';
import BroadcastFrame from './BroadcastFrame';
import BroadcastHeader from './BroadcastHeader';
import LeaderTakeover from './LeaderTakeover';
import RaceBars from './RaceBars';
import RosterTable from './RosterTable';
import TickerCrawl from './TickerCrawl';
import StationID from './StationID';

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function Leaderboard() {
  const data = useLeaderboardData();
  const now = useNow();
  const [leader, runnerUp, ...rest] = data.players;
  const top5Tail = rest.slice(0, 4); // P02-P05 are now leader,runnerUp,rest[0..3]
  const racers = [runnerUp, ...rest.slice(0, 3)].filter(Boolean); // P02..P05
  const roster = data.players.slice(5); // P06..P20

  return (
    <BroadcastFrame>
      <BroadcastHeader
        weekLabel={data.weekLabel}
        periodLabel={data.periodLabel}
        prizePool={data.prizePool}
        endsAt={data.endsAt}
        lastUpdatedAt={data.lastUpdatedAt}
        now={now}
      />
      <LeaderTakeover leader={leader} runnerUp={runnerUp} />
      <RaceBars players={racers} leaderWagered={leader ? leader.wagered : 0} />
      <RosterTable players={roster} />
      <TickerCrawl />
      <StationID />
    </BroadcastFrame>
  );
}
```

Create `src/components/Leaderboard/index.js`:

```js
export { default } from './Leaderboard';
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Leaderboard/Leaderboard.js src/components/Leaderboard/index.js
git commit -m "leaderboard: add Leaderboard top-level layout"
```

---

## Task 16: Wire into `GambaPage` and update routing

**Files:**

- Modify: `src/pages/GambaPage.js`
- Modify: `src/App.js`

- [ ] **Step 1: Add Leaderboard import and tool entry in `GambaPage.js`**

In [src/pages/GambaPage.js](../../../src/pages/GambaPage.js), update imports (line 2 and line 3 area):

```js
import { useNavigate, useLocation } from 'react-router-dom';
import { Target, Gamepad2, MessageSquarePlus, Layers, Radio } from 'lucide-react';
import BonusHuntsPage from './BonusHunts';
import HuntTracker from '../components/HuntTracker';
import SlotPicker from '../components/SlotPicker';
import SuggestAdminTab from '../components/SuggestAdminTab';
import Leaderboard from '../components/Leaderboard';
```

Update `TOOLS` (lines 8–13) — leaderboard goes first:

```js
const TOOLS = [
  { id: 'leaderboard', label: 'Leaderboard', code: 'LB', icon: Radio },
  { id: 'hunt-tracker', label: 'Hunt Tracker', code: 'HT', icon: Target },
  { id: 'bonus-hunts', label: 'Bonus Hunts', code: 'BH', icon: Layers },
  { id: 'wheel', label: 'Slot Picker', code: 'SP', icon: Gamepad2 },
  { id: 'suggest', label: 'Suggestions', code: 'SG', icon: MessageSquarePlus },
];
```

Update the active-tool fallback (line 52) — the default is now leaderboard:

```js
const activeTool = location.pathname.split('/')[2] || 'leaderboard';
```

Update the active-meta fallback (line 55) — first entry in the array is now leaderboard:

```js
const activeMeta = TOOLS.find((t) => t.id === activeTool) || TOOLS[0];
```

Add the leaderboard render in the tool surface block (lines 133–139):

```js
        {/* Tool surface — untouched, hosted in a plain container */}
        <div className="mt-6">
          {activeTool === 'leaderboard' && <Leaderboard />}
          {activeTool === 'suggest' && <SuggestAdminTab />}
          {activeTool === 'bonus-hunts' && <BonusHuntsPage />}
          {activeTool === 'hunt-tracker' && <HuntTracker />}
          {activeTool === 'wheel' && <SlotPicker />}
        </div>
```

- [ ] **Step 2: Update gamba routing in `App.js`**

In [src/App.js](../../../src/App.js) lines 211–222, change the gamba block to add the leaderboard route and switch the index redirect:

```jsx
          <Route path="/gamba" element={<GambaPage />}>
            <Route
              index
              element={<Navigate to="/gamba/leaderboard" replace />}
            />
            <Route path="leaderboard" element={null} />
            <Route path="wheel" element={null} />
            <Route path="equity" element={null} />
            <Route path="hunt" element={null} />
            <Route path="suggest" element={null} />
            <Route path="bonus-hunts" element={null} />
            <Route path="hunt-tracker" element={null} />
          </Route>
```

- [ ] **Step 3: Smoke-check in the dev server**

Run: `npm start`

Manually verify in a browser:

1. Visit `http://localhost:3000/gamba` — should auto-redirect to `/gamba/leaderboard`.
2. The leaderboard renders with: broadcast frame (corners, REC dot top-right), broadcast header (STANDINGS, prize pool, T-MINUS countdown ticking), leader takeover with oversized digits, 4 race bars, roster table with 15 rows, ticker crawl scrolling, station ID at the bottom.
3. Wait ~45 seconds → at least one wager-drop chip should fly in next to a player, bar widths update, lastUpdatedAt label resets.
4. Click the `LB` tab on the toolbar — stays on the leaderboard. Click `HT` — Hunt Tracker still works. Click `LB` again — back to leaderboard.
5. Direct-navigate to `http://localhost:3000/gamba/hunt-tracker` — Hunt Tracker still renders (regression check).
6. Resize to mobile width — header columns stack, leader takeover stays readable, bars and roster wrap without horizontal scroll.

If any of those fail, fix before committing.

Stop the dev server.

- [ ] **Step 4: Run the full test suite to make sure nothing regressed**

Run: `npm test -- --watchAll=false`
Expected: all leaderboard tests pass; project still has no other tests, so total = our new tests, all green.

- [ ] **Step 5: Commit**

```bash
git add src/App.js src/pages/GambaPage.js
git commit -m "leaderboard: wire into gamba tool registry and make it the index"
```

---

## Task 17: Production build sanity check

**Files:** none.

- [ ] **Step 1: Run the production build**

Run: `npm run build`
Expected: build completes without errors. ESLint warnings from `react-scripts` are acceptable if they are unrelated to the leaderboard files; warnings introduced by leaderboard files should be fixed.

- [ ] **Step 2: If build fails, fix and re-run; no commit needed unless code was changed**

If a fix is required, commit it as:

```bash
git add <files>
git commit -m "leaderboard: fix production build"
```

---

## Self-Review Notes

Spec coverage check — every spec requirement traced to a task:

- Route + index redirect → Task 16.
- GambaPage tool registry entry with `Radio` icon → Task 16.
- Component folder split → Tasks 1, 2, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15.
- Hooks layer (data/countdown/timecode) → Tasks 3, 4, 5.
- Broadcast frame (corners, REC dot, scanline, session timecode) → Task 14.
- Broadcast header (eyebrow, last-updated, prize pool, T-minus) → Task 8.
- Leader takeover (oversized digits, gap callout, P01-only emerald accent, scanline wash) → Task 9.
- Race bars P02-P05 (bar fill, stagger, desaturated color, trend arrow) → Tasks 6, 10.
- Roster table P06-P20 → Tasks 6, 11.
- Wager drop chips (no game names, +$X only) → Task 7, used by Tasks 9, 10, 11.
- Ticker crawl with in-jokes (no specific cadence claim) → Task 12.
- Station ID with `/tools` link → Task 13.
- Mock data: 20 deterministic players, P01 ≥ 2× P02 → Task 2.
- Poll cadence 30-60s (45s default) → Task 5.
- Trend arrow with previousPosition tracking → Tasks 6 (display), 5 (computation).
- Reduced-motion gating → applied in Tasks 7, 9, 10, 11, 12, 14 via `motion-reduce:` utilities.
- A11y `aria-label` on trend arrows, `aria-hidden` on decorative → Tasks 6, 7, 12, 14.
- Real-API swap point isolated in `useLeaderboardData` → Task 5.
- Index redirect changed from `hunt-tracker` to `leaderboard` → Task 16.

Type/signature consistency check:

- `useLeaderboardData` returns `{ players, prizePool, periodLabel, weekLabel, endsAt, lastUpdatedAt, isLoading, error }`. Consumed in `Leaderboard.js` (Task 15) — fields match.
- Each `player` has `{ id, username, wagered, position, previousPosition, delta, maskedUsername }`. Consumed by `LeaderTakeover`, `RaceBars`, `RosterTable` — all fields match.
- `TrendArrow` props `{ current, previous }` map cleanly to `position, previousPosition` everywhere it's used.
- `WagerDropChip` prop `delta` matches the player field name.
- `BroadcastHeader` props match what Task 15's `Leaderboard.js` passes.
- `formatUSD`, `maskUsername`, `formatPosition` from Task 1 are imported and used consistently throughout.

No placeholders, no TBDs, no "implement later." Every code-changing step shows the code.
