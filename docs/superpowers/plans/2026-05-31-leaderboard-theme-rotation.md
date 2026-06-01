# Leaderboard Theme Rotation Implementation Plan

> **STATUS: IMPLEMENTED (2026-05-31).** Built on branch `feat/leaderboard-themes`.
> The tasks below are the original plan and are kept as history. Execution
> expanded the scope mid-build (a shared **information contract**, a WebGL
> shader backdrop, gradient podium cards, a demo disclaimer, a fixed/expirable
> end date with a "leaderboard over" state, and enlarged countdowns). See the
> **Implementation Addendum** at the bottom of this file for what was actually
> built, the deviations, and the final file inventory.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the gamba leaderboard rotate through 4 distinct visual themes (broadcast/casino/minimal/neon) sharing one mock data source, switched manually via named chips and persisted in the URL `?theme=` param.

**Architecture:** The existing data/view seam (`useLeaderboardData` hook vs `Leaderboard.js`) is extended so the view is pluggable. `Leaderboard.js` becomes a thin wrapper that calls the data hooks once, reads the active theme from the URL, and renders a `ThemeSwitcher` plus the active theme component (fed `{ data, now }` props). Each theme is an isolated presentational component registered in `themes/index.js`. The current broadcast look moves verbatim into `BroadcastTheme.js`.

**Tech Stack:** React 19, react-router-dom v7 (`useSearchParams`), Tailwind (custom tokens in `tailwind.config.js`), Jest + `@testing-library/react` (jsdom), `lucide-react` icons.

Spec: [docs/superpowers/specs/2026-05-31-leaderboard-theme-rotation-design.md](../specs/2026-05-31-leaderboard-theme-rotation-design.md)

---

## File Structure

**Create:**
- `src/components/Leaderboard/themes/index.js` — registry (`THEMES`, `DEFAULT_THEME_ID`)
- `src/components/Leaderboard/themes/BroadcastTheme.js` — current `Leaderboard.js` body, props-driven
- `src/components/Leaderboard/themes/CasinoTheme.js` — new
- `src/components/Leaderboard/themes/MinimalTheme.js` — new
- `src/components/Leaderboard/themes/NeonTheme.js` — new
- `src/components/Leaderboard/ThemeSwitcher.js` — chips + conditional reset
- `src/components/Leaderboard/useNow.js` — extracted ticking-clock hook (shared by wrapper)
- `src/components/Leaderboard/themes/__tests__/registry.test.js`
- `src/components/Leaderboard/__tests__/ThemeSwitcher.test.js`
- `src/components/Leaderboard/__tests__/Leaderboard.test.js` — theme resolution from URL

**Modify:**
- `src/components/Leaderboard/Leaderboard.js` — becomes the wrapper
- `src/components/Leaderboard/index.js` — unchanged in behavior (still `export { default } from './Leaderboard'`); no edit expected

**Unchanged (themes consume these):** `BroadcastFrame.js`, `BroadcastHeader.js`, `LeaderTakeover.js`, `PodiumCard.js`, `RaceBars.js`, `RosterTable.js`, `SponsorBanner.js`, `TickerCrawl.js`, `StationID.js`, `TrendArrow.js`, `WagerDropChip.js`, `TiltCard.js`, `format.js`, `mockData.js`, `useLeaderboardData.js`.

**Theme prop contract** — every theme component is `export default function XTheme({ data, now })` where:
- `data` = the object returned by `useLeaderboardData()`: `{ players, prizePool, periodLabel, weekLabel, endsAt, lastUpdatedAt, isLoading, error }`
- `now` = ticking `Date.now()` number from `useNow()`
Each theme's root element carries `data-theme="<id>"` for test assertions.

---

## Task 1: Extract `useNow` hook

Pulls the ticking clock out of `Leaderboard.js` so the wrapper can own it and pass `now` to any theme.

**Files:**
- Create: `src/components/Leaderboard/useNow.js`

- [ ] **Step 1: Create the hook**

`src/components/Leaderboard/useNow.js`:

```js
import { useEffect, useState } from 'react';

// Ticking wall-clock used by themes for countdowns. One interval, lifted to the
// Leaderboard wrapper so all themes share a single timer.
export default function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}
```

- [ ] **Step 2: Verify it builds (no test yet — trivial timer hook)**

Run: `npx eslint src/components/Leaderboard/useNow.js`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/Leaderboard/useNow.js
git commit -m "refactor: extract useNow hook from Leaderboard"
```

---

## Task 2: Move broadcast look into `BroadcastTheme.js` (props-driven)

Moves the current `Leaderboard.js` body verbatim into a theme component that takes `{ data, now }` instead of calling hooks. No visual change.

**Files:**
- Create: `src/components/Leaderboard/themes/BroadcastTheme.js`

- [ ] **Step 1: Create `BroadcastTheme.js`**

`src/components/Leaderboard/themes/BroadcastTheme.js` — this is the existing `Leaderboard.js` body with the two hook calls removed (data + now arrive as props), `data.` prefixes added where the body referenced destructured fields, imports repointed one level up (`../`), and `data-theme="broadcast"` on the root:

```jsx
import BroadcastFrame from '../BroadcastFrame';
import BroadcastHeader from '../BroadcastHeader';
import LeaderTakeover from '../LeaderTakeover';
import PodiumCard from '../PodiumCard';
import RaceBars from '../RaceBars';
import RosterTable from '../RosterTable';
import SponsorBanner from '../SponsorBanner';
import TickerCrawl from '../TickerCrawl';
import StationID from '../StationID';

const TAKEOVER_THRESHOLD = 1.3;

export default function BroadcastTheme({ data, now }) {
  const [leader, runnerUp, third, ...rest] = data.players;
  const showTakeover =
    leader && runnerUp && leader.wagered >= runnerUp.wagered * TAKEOVER_THRESHOLD;
  const racers = showTakeover
    ? rest.slice(0, 7)
    : [leader, runnerUp, third, ...rest].filter(Boolean).slice(0, 7);
  const roster = showTakeover ? data.players.slice(10) : data.players.slice(7);
  const racerLeader = showTakeover ? racers[0] : leader;

  return (
    <div data-theme="broadcast">
      <BroadcastFrame>
        <BroadcastHeader
          weekLabel={data.weekLabel}
          periodLabel={data.periodLabel}
          prizePool={data.prizePool}
          endsAt={data.endsAt}
          lastUpdatedAt={data.lastUpdatedAt}
          now={now}
        />

        {showTakeover && (
          <div className="px-4 sm:px-6 py-6 border-b border-white/8">
            <div className="grid grid-cols-1 lg:grid-cols-[5fr_3fr] gap-4 lg:gap-5">
              <LeaderTakeover leader={leader} runnerUp={runnerUp} />
              <div className="grid grid-cols-1 gap-4 lg:gap-5">
                <PodiumCard player={runnerUp} tier="runnerUp" />
                <PodiumCard player={third} tier="third" />
              </div>
            </div>
          </div>
        )}

        <SponsorBanner />

        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-4 px-4 sm:px-6 py-3 border-b border-white/8 text-[10px] font-bold tracking-eyebrow-lg text-white/55 font-mono">
          <span className="w-16 sm:w-20" aria-hidden="true" />
          <span aria-hidden="true" />
          <span className="text-right">WAGERED</span>
          <span className="text-right w-20 sm:w-24">PRIZE</span>
        </div>

        <RaceBars
          players={racers}
          leaderWagered={racerLeader ? racerLeader.wagered : 0}
        />
        <RosterTable
          players={roster}
          leaderWagered={racerLeader ? racerLeader.wagered : 0}
        />
        <TickerCrawl />
        <StationID />
      </BroadcastFrame>
    </div>
  );
}
```

- [ ] **Step 2: Lint**

Run: `npx eslint src/components/Leaderboard/themes/BroadcastTheme.js`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/Leaderboard/themes/BroadcastTheme.js
git commit -m "refactor: move broadcast layout into BroadcastTheme (props-driven)"
```

---

## Task 3: Theme registry with broadcast wired

**Files:**
- Create: `src/components/Leaderboard/themes/index.js`
- Test: `src/components/Leaderboard/themes/__tests__/registry.test.js`

- [ ] **Step 1: Write the failing test**

`src/components/Leaderboard/themes/__tests__/registry.test.js`:

```js
import { THEMES, DEFAULT_THEME_ID } from '../index';

describe('theme registry', () => {
  it('every entry has id, label, and a Component', () => {
    THEMES.forEach((t) => {
      expect(typeof t.id).toBe('string');
      expect(typeof t.label).toBe('string');
      expect(t.Component).toBeTruthy();
    });
  });

  it('theme ids are unique', () => {
    const ids = THEMES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('DEFAULT_THEME_ID exists in THEMES', () => {
    expect(THEMES.some((t) => t.id === DEFAULT_THEME_ID)).toBe(true);
  });

  it('default theme is the first entry (broadcast)', () => {
    expect(THEMES[0].id).toBe(DEFAULT_THEME_ID);
    expect(DEFAULT_THEME_ID).toBe('broadcast');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --watchAll=false --testPathPattern=registry`
Expected: FAIL — cannot find module `../index` (or export undefined).

- [ ] **Step 3: Create the registry (broadcast only for now)**

`src/components/Leaderboard/themes/index.js`:

```js
import BroadcastTheme from './BroadcastTheme';

export const DEFAULT_THEME_ID = 'broadcast';

export const THEMES = [
  { id: 'broadcast', label: 'Broadcast', Component: BroadcastTheme },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --watchAll=false --testPathPattern=registry`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Leaderboard/themes/index.js src/components/Leaderboard/themes/__tests__/registry.test.js
git commit -m "feat: add leaderboard theme registry with broadcast"
```

---

## Task 4: Rewrite `Leaderboard.js` as the wrapper

The wrapper calls the data hooks once, resolves the active theme from `?theme=`, and renders the active theme. (ThemeSwitcher is added in Task 6 — not yet.)

**Files:**
- Modify: `src/components/Leaderboard/Leaderboard.js` (full replace)
- Test: `src/components/Leaderboard/__tests__/Leaderboard.test.js`

- [ ] **Step 1: Write the failing test**

`src/components/Leaderboard/__tests__/Leaderboard.test.js`:

```jsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Leaderboard from '../Leaderboard';

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Leaderboard />
    </MemoryRouter>,
  );
}

describe('Leaderboard theme resolution', () => {
  it('renders the default (broadcast) theme with no ?theme param', () => {
    const { container } = renderAt('/gamba/leaderboard');
    expect(container.querySelector('[data-theme="broadcast"]')).toBeTruthy();
  });

  it('falls back to default theme for an unknown ?theme value', () => {
    const { container } = renderAt('/gamba/leaderboard?theme=banana');
    expect(container.querySelector('[data-theme="broadcast"]')).toBeTruthy();
  });

  it('renders broadcast when ?theme=broadcast', () => {
    const { container } = renderAt('/gamba/leaderboard?theme=broadcast');
    expect(container.querySelector('[data-theme="broadcast"]')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --watchAll=false --testPathPattern=Leaderboard.test`
Expected: FAIL — `Leaderboard` still calls `useLeaderboardData`/`useNow` internally and renders no `[data-theme]` root, OR fails because the current default export doesn't read the URL. (Either way, the `data-theme` query returns null.)

- [ ] **Step 3: Replace `Leaderboard.js` with the wrapper**

`src/components/Leaderboard/Leaderboard.js` (full file):

```jsx
import { useSearchParams } from 'react-router-dom';
import { useLeaderboardData } from '../../hooks/useLeaderboardData';
import useNow from './useNow';
import { THEMES, DEFAULT_THEME_ID } from './themes';

function resolveTheme(requestedId) {
  return THEMES.find((t) => t.id === requestedId) || THEMES[0];
}

export default function Leaderboard() {
  const data = useLeaderboardData();
  const now = useNow();
  const [params] = useSearchParams();

  const active = resolveTheme(params.get('theme'));
  const ActiveTheme = active.Component;

  return <ActiveTheme data={data} now={now} />;
}

export { DEFAULT_THEME_ID };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --watchAll=false --testPathPattern=Leaderboard.test`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the existing data tests to confirm no regression**

Run: `npm test -- --watchAll=false --testPathPattern=useLeaderboardData`
Expected: PASS (existing 8 tests unchanged — data layer untouched).

- [ ] **Step 6: Commit**

```bash
git add src/components/Leaderboard/Leaderboard.js src/components/Leaderboard/__tests__/Leaderboard.test.js
git commit -m "feat: make Leaderboard a theme-resolving wrapper"
```

---

## Task 5: Manual verification — broadcast unchanged in the app

No code. Confirms the refactor is visually identical before adding the switcher.

- [ ] **Step 1: Start the dev server**

Run: `npm start`
Navigate to `http://localhost:3000/gamba/leaderboard`.

- [ ] **Step 2: Verify**

Expected: the leaderboard looks **identical** to before (broadcast frame, race bars, ticker, takeover banner when leader ≥1.3× runner-up). Then visit `http://localhost:3000/gamba/leaderboard?theme=banana` — still broadcast (fallback works). Stop the server (Ctrl+C).

- [ ] **Step 3: No commit (verification only).**

---

## Task 6: ThemeSwitcher component + wire into wrapper

Named chips + conditional reset. Wrapper translates selection into `?theme=` mutations.

**Files:**
- Create: `src/components/Leaderboard/ThemeSwitcher.js`
- Test: `src/components/Leaderboard/__tests__/ThemeSwitcher.test.js`
- Modify: `src/components/Leaderboard/Leaderboard.js`

- [ ] **Step 1: Write the failing test**

`src/components/Leaderboard/__tests__/ThemeSwitcher.test.js`:

```jsx
import { render, screen, fireEvent } from '@testing-library/react';
import ThemeSwitcher from '../ThemeSwitcher';

const THEMES = [
  { id: 'broadcast', label: 'Broadcast', Component: () => null },
  { id: 'casino', label: 'Casino', Component: () => null },
  { id: 'neon', label: 'Neon', Component: () => null },
];

function setup(activeId) {
  const onSelect = jest.fn();
  render(
    <ThemeSwitcher
      themes={THEMES}
      activeId={activeId}
      defaultId="broadcast"
      onSelect={onSelect}
    />,
  );
  return { onSelect };
}

describe('ThemeSwitcher', () => {
  it('renders a chip per theme', () => {
    setup('broadcast');
    THEMES.forEach((t) => {
      expect(screen.getByRole('button', { name: t.label })).toBeTruthy();
    });
  });

  it('marks the active chip with aria-pressed=true', () => {
    setup('casino');
    expect(
      screen.getByRole('button', { name: 'Casino' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      screen.getByRole('button', { name: 'Broadcast' }).getAttribute('aria-pressed'),
    ).toBe('false');
  });

  it('calls onSelect with the theme id when a chip is clicked', () => {
    const { onSelect } = setup('broadcast');
    fireEvent.click(screen.getByRole('button', { name: 'Neon' }));
    expect(onSelect).toHaveBeenCalledWith('neon');
  });

  it('hides the reset control when active theme is the default', () => {
    setup('broadcast');
    expect(screen.queryByRole('button', { name: /reset/i })).toBeNull();
  });

  it('shows reset when off-default and calls onSelect(defaultId)', () => {
    const { onSelect } = setup('neon');
    const reset = screen.getByRole('button', { name: /reset/i });
    fireEvent.click(reset);
    expect(onSelect).toHaveBeenCalledWith('broadcast');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --watchAll=false --testPathPattern=ThemeSwitcher`
Expected: FAIL — cannot find module `../ThemeSwitcher`.

- [ ] **Step 3: Create `ThemeSwitcher.js`**

`src/components/Leaderboard/ThemeSwitcher.js`:

```jsx
import { RotateCcw } from 'lucide-react';

// Neutral house-brand chrome that sits above the active theme. Chips derive
// from the registry; reset only appears when off the default theme.
export default function ThemeSwitcher({ themes, activeId, defaultId, onSelect }) {
  const offDefault = activeId !== defaultId;

  return (
    <div className="flex flex-wrap items-center gap-2 px-1 py-3">
      <span className="text-[10px] font-bold tracking-eyebrow-lg text-white/45 font-mono mr-1">
        STYLE
      </span>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Leaderboard style">
        {themes.map((t) => {
          const active = t.id === activeId;
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(t.id)}
              className={`px-3 py-1.5 text-[11px] font-bold tracking-eyebrow-sm uppercase font-mono border transition-colors duration-150 ${
                active
                  ? 'border-emerald-signal/60 bg-emerald-signal/10 text-emerald-signal'
                  : 'border-white/10 text-white/60 hover:text-white-body hover:bg-white/5'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {offDefault && (
        <button
          type="button"
          onClick={() => onSelect(defaultId)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold tracking-eyebrow-sm uppercase font-mono text-white/45 hover:text-white-body transition-colors duration-150"
        >
          <RotateCcw size={11} aria-hidden="true" />
          Reset
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --watchAll=false --testPathPattern=ThemeSwitcher`
Expected: PASS (5 tests).

- [ ] **Step 5: Wire the switcher into the wrapper**

Replace `src/components/Leaderboard/Leaderboard.js` with:

```jsx
import { useSearchParams } from 'react-router-dom';
import { useLeaderboardData } from '../../hooks/useLeaderboardData';
import useNow from './useNow';
import { THEMES, DEFAULT_THEME_ID } from './themes';
import ThemeSwitcher from './ThemeSwitcher';

function resolveTheme(requestedId) {
  return THEMES.find((t) => t.id === requestedId) || THEMES[0];
}

export default function Leaderboard() {
  const data = useLeaderboardData();
  const now = useNow();
  const [params, setParams] = useSearchParams();

  const active = resolveTheme(params.get('theme'));
  const ActiveTheme = active.Component;

  const handleSelect = (id) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id === DEFAULT_THEME_ID) {
          next.delete('theme');
        } else {
          next.set('theme', id);
        }
        return next;
      },
      { replace: true },
    );
  };

  return (
    <div>
      <ThemeSwitcher
        themes={THEMES}
        activeId={active.id}
        defaultId={DEFAULT_THEME_ID}
        onSelect={handleSelect}
      />
      <ActiveTheme data={data} now={now} />
    </div>
  );
}

export { DEFAULT_THEME_ID };
```

- [ ] **Step 6: Run the full leaderboard test suite**

Run: `npm test -- --watchAll=false --testPathPattern=Leaderboard`
Expected: PASS — `Leaderboard.test` (3) + `ThemeSwitcher.test` (5). The default-theme resolution tests still pass because the switcher chrome wraps but does not change the rendered `[data-theme]` root.

- [ ] **Step 7: Commit**

```bash
git add src/components/Leaderboard/ThemeSwitcher.js src/components/Leaderboard/__tests__/ThemeSwitcher.test.js src/components/Leaderboard/Leaderboard.js
git commit -m "feat: add ThemeSwitcher chips and wire theme to URL param"
```

---

## Task 7: Verify switcher behavior + URL/tool-routing isolation in the app

No code. Confirms the spec's "param isolation" claim and reset/URL behavior in the running app before building more themes.

- [ ] **Step 1: Start the dev server**

Run: `npm start` → `http://localhost:3000/gamba/leaderboard`.

- [ ] **Step 2: Verify switcher + URL**

Expected:
- A `STYLE` row with chips renders above the broadcast leaderboard. Only `Broadcast` chip shows for now (other themes not added yet); it is highlighted (active). No reset visible (on default).
- The leaderboard below is still the broadcast look.

- [ ] **Step 3: Verify tool routing isn't disturbed**

Manually append `?theme=broadcast` to the URL and confirm the gamba page still shows the **leaderboard** tool selected (not knocked to the hub or another channel). Switch to another gamba channel (e.g. Bonus Hunts) and back; confirm no crash. Stop the server.

- [ ] **Step 4: No commit (verification only).**

> If tool routing IS disturbed (it should not be, per spec — tool comes from the path, theme from query), STOP and reconcile before proceeding: the wrapper must only ever mutate the `theme` search param and never the path.

---

## Task 8: MinimalTheme (clean/calm, no motion)

Built first among the new themes because it's the simplest and validates the prop contract end-to-end. Flat table, big numbers, generous whitespace. Calm by character — no motion.

**Files:**
- Create: `src/components/Leaderboard/themes/MinimalTheme.js`
- Modify: `src/components/Leaderboard/themes/index.js`

- [ ] **Step 1: Create `MinimalTheme.js`**

`src/components/Leaderboard/themes/MinimalTheme.js`:

```jsx
import { formatUSD, formatPosition } from '../format';

// Clean, modern, calm. No motion by design — restraint is the theme. Consumes
// the same { data } the other themes do.
export default function MinimalTheme({ data }) {
  const players = data.players.slice(0, 20);

  return (
    <div data-theme="minimal" className="bg-zinc-card/20 border border-white/8">
      <div className="px-5 sm:px-8 py-7 border-b border-white/8">
        <div className="text-[11px] font-semibold tracking-eyebrow text-white/40 uppercase">
          {data.periodLabel} · {data.weekLabel}
        </div>
        <div className="mt-2 flex items-baseline gap-3">
          <h2 className="text-2xl sm:text-3xl font-semibold text-white-body tracking-tight">
            Leaderboard
          </h2>
          <span className="text-sm font-medium text-white/40 tabular-nums">
            {formatUSD(data.prizePool)} pool
          </span>
        </div>
      </div>

      <div className="divide-y divide-white/6">
        {players.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-5 px-5 sm:px-8 py-4"
          >
            <span className="w-10 text-base font-semibold tabular-nums text-white/35">
              {formatPosition(p.position)}
            </span>
            <span className="flex-1 min-w-0 truncate text-base font-medium text-white-body">
              {p.maskedUsername}
            </span>
            <span className="text-base sm:text-lg font-semibold tabular-nums text-white-body">
              {formatUSD(p.wagered)}
            </span>
            <span className="w-24 text-right text-sm font-medium tabular-nums text-white/45">
              {p.prize > 0 ? formatUSD(p.prize) : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Register it**

Edit `src/components/Leaderboard/themes/index.js` to:

```js
import BroadcastTheme from './BroadcastTheme';
import MinimalTheme from './MinimalTheme';

export const DEFAULT_THEME_ID = 'broadcast';

export const THEMES = [
  { id: 'broadcast', label: 'Broadcast', Component: BroadcastTheme },
  { id: 'minimal', label: 'Minimal', Component: MinimalTheme },
];
```

- [ ] **Step 3: Write a smoke test**

Append to `src/components/Leaderboard/__tests__/Leaderboard.test.js` (inside the existing `describe`):

```jsx
  it('renders the minimal theme when ?theme=minimal', () => {
    const { container } = renderAt('/gamba/leaderboard?theme=minimal');
    expect(container.querySelector('[data-theme="minimal"]')).toBeTruthy();
    expect(container.querySelector('[data-theme="broadcast"]')).toBeNull();
  });
```

- [ ] **Step 4: Run tests**

Run: `npm test -- --watchAll=false --testPathPattern=Leaderboard.test`
Expected: PASS (now 4 tests).

- [ ] **Step 5: Lint**

Run: `npx eslint src/components/Leaderboard/themes/MinimalTheme.js`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/Leaderboard/themes/MinimalTheme.js src/components/Leaderboard/themes/index.js src/components/Leaderboard/__tests__/Leaderboard.test.js
git commit -m "feat: add minimal leaderboard theme"
```

---

## Task 9: CasinoTheme (podium + medals, casino-classic register)

Top-3 podium block above a ranked list. Gold/amber register (`amber-rust` tokens), rank medals. Subtle only — no signature motion (per spec, motion lives in broadcast + neon).

**Files:**
- Create: `src/components/Leaderboard/themes/CasinoTheme.js`
- Modify: `src/components/Leaderboard/themes/index.js`

- [ ] **Step 1: Create `CasinoTheme.js`**

`src/components/Leaderboard/themes/CasinoTheme.js`:

```jsx
import { formatUSD, formatPosition } from '../format';

const MEDALS = ['🥇', '🥈', '🥉'];

function PodiumSpot({ player, rank }) {
  if (!player) return null;
  const heights = ['sm:mt-0', 'sm:mt-6', 'sm:mt-10'];
  return (
    <div
      className={`relative flex flex-col items-center text-center px-4 py-5 border border-amber-rust/30 bg-gradient-to-b from-amber-rust/10 to-transparent ${heights[rank]}`}
    >
      <div className="text-3xl leading-none" aria-hidden="true">
        {MEDALS[rank]}
      </div>
      <div className="mt-2 text-xs font-bold tracking-eyebrow text-amber-rust uppercase font-mono">
        {formatPosition(player.position)}
      </div>
      <div className="mt-1 text-lg font-extrabold text-white-body uppercase tracking-tight break-all">
        {player.maskedUsername}
      </div>
      <div className="mt-2 text-base font-extrabold tabular-nums font-mono text-amber-rust">
        {formatUSD(player.wagered)}
      </div>
      <div className="mt-1 text-[11px] font-bold tabular-nums font-mono text-white/50">
        PRIZE {formatUSD(player.prize)}
      </div>
    </div>
  );
}

// Casino-classic register: podium for the top 3, ranked list below. Leans into
// the gold/medal look the house brand normally avoids — intentional, because
// this theme exists to demo that style on request.
export default function CasinoTheme({ data }) {
  const [first, second, third, ...rest] = data.players;
  const list = rest.slice(0, 17);

  return (
    <div
      data-theme="casino"
      className="border border-amber-rust/25 bg-zinc-broadcast/60"
    >
      <div className="px-4 sm:px-6 py-5 border-b border-amber-rust/20 text-center">
        <div className="text-[11px] font-bold tracking-eyebrow-lg text-amber-rust/80 uppercase font-mono">
          {data.periodLabel} — {formatUSD(data.prizePool)} PRIZE POOL
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-4 sm:px-6 py-6">
        {/* Visual podium order: 2nd, 1st, 3rd */}
        <div className="sm:order-1"><PodiumSpot player={second} rank={1} /></div>
        <div className="sm:order-2"><PodiumSpot player={first} rank={0} /></div>
        <div className="sm:order-3"><PodiumSpot player={third} rank={2} /></div>
      </div>

      <div className="divide-y divide-amber-rust/10 border-t border-amber-rust/15">
        {list.map((p) => (
          <div
            key={p.id}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-4 px-4 sm:px-6 py-3"
          >
            <span className="w-12 text-sm font-bold tabular-nums font-mono text-amber-rust/70">
              {formatPosition(p.position)}
            </span>
            <span className="min-w-0 truncate text-sm font-bold text-white-body">
              {p.maskedUsername}
            </span>
            <span className="text-sm sm:text-base font-bold tabular-nums font-mono text-white-body text-right">
              {formatUSD(p.wagered)}
            </span>
            <span className="w-20 sm:w-24 text-right text-sm font-bold tabular-nums font-mono text-amber-rust">
              {p.prize > 0 ? formatUSD(p.prize) : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Register it**

Edit `src/components/Leaderboard/themes/index.js` to:

```js
import BroadcastTheme from './BroadcastTheme';
import CasinoTheme from './CasinoTheme';
import MinimalTheme from './MinimalTheme';

export const DEFAULT_THEME_ID = 'broadcast';

export const THEMES = [
  { id: 'broadcast', label: 'Broadcast', Component: BroadcastTheme },
  { id: 'casino', label: 'Casino', Component: CasinoTheme },
  { id: 'minimal', label: 'Minimal', Component: MinimalTheme },
];
```

- [ ] **Step 3: Smoke test**

Append to `src/components/Leaderboard/__tests__/Leaderboard.test.js`:

```jsx
  it('renders the casino theme when ?theme=casino', () => {
    const { container } = renderAt('/gamba/leaderboard?theme=casino');
    expect(container.querySelector('[data-theme="casino"]')).toBeTruthy();
  });
```

- [ ] **Step 4: Run tests + lint**

Run: `npm test -- --watchAll=false --testPathPattern=Leaderboard.test`
Expected: PASS (now 5 tests).
Run: `npx eslint src/components/Leaderboard/themes/CasinoTheme.js`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/Leaderboard/themes/CasinoTheme.js src/components/Leaderboard/themes/index.js src/components/Leaderboard/__tests__/Leaderboard.test.js
git commit -m "feat: add casino leaderboard theme"
```

---

## Task 10: NeonTheme (arcade/glow, signature motion)

High-contrast neon with glow pulse on the leader and animated bar fills. This theme's motion defines it — and it honors `prefers-reduced-motion` (motion stops, static glow color remains). Adds two keyframes to `tailwind.config.js`.

**Files:**
- Create: `src/components/Leaderboard/themes/NeonTheme.js`
- Modify: `src/components/Leaderboard/themes/index.js`
- Modify: `tailwind.config.js` (add `neon-pulse` keyframe + animation)

- [ ] **Step 1: Add keyframes/animation to Tailwind config**

Edit `tailwind.config.js` — add to `theme.extend.keyframes` (alongside `grain`, `glow`, `slow-zoom`):

```js
        'neon-pulse': {
          '0%, 100%': {
            textShadow:
              '0 0 6px rgba(192,132,252,0.8), 0 0 18px rgba(168,85,247,0.6)',
          },
          '50%': {
            textShadow:
              '0 0 10px rgba(192,132,252,1), 0 0 30px rgba(168,85,247,0.9)',
          },
        },
```

…and add to `theme.extend.animation` (alongside `slow-zoom`):

```js
        'neon-pulse': 'neon-pulse 2.4s ease-in-out infinite',
```

- [ ] **Step 2: Create `NeonTheme.js`**

`src/components/Leaderboard/themes/NeonTheme.js`:

```jsx
import { useEffect, useState } from 'react';
import { formatUSD, formatPosition } from '../format';

// Arcade/neon register. Signature motion: glow pulse on the leader + animated
// bar fills. Motion is gated by motion-reduce:* utilities so reduced-motion
// users keep the static neon glow without movement.
export default function NeonTheme({ data }) {
  const players = data.players.slice(0, 20);
  const leaderWagered = players[0] ? players[0].wagered : 0;

  // Drive the bar fill-in on mount (mirrors RaceBars' pattern).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      data-theme="neon"
      className="relative overflow-hidden border border-purple-gamba/40 bg-zinc-broadcast/80"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-screen motion-reduce:hidden"
        aria-hidden="true"
        style={{
          backgroundImage:
            'repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(192,132,252,0.7) 2px, rgba(192,132,252,0.7) 3px)',
        }}
      />

      <div className="relative px-4 sm:px-6 py-5 border-b border-purple-gamba/30 text-center">
        <div className="text-[11px] font-bold tracking-eyebrow-lg uppercase font-mono text-purple-bright">
          {data.periodLabel} · {formatUSD(data.prizePool)} POOL
        </div>
      </div>

      <div className="relative divide-y divide-purple-gamba/15">
        {players.map((p, i) => {
          const pct =
            leaderWagered > 0
              ? Math.max(2, Math.min(100, (p.wagered / leaderWagered) * 100))
              : 0;
          const isLeader = i === 0;
          return (
            <div
              key={p.id}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-4 px-4 sm:px-6 py-3"
            >
              <span className="w-12 text-sm font-bold tabular-nums font-mono text-purple-bright">
                {formatPosition(p.position)}
              </span>

              <div className="min-w-0">
                <div
                  className={`truncate text-sm font-bold ${
                    isLeader
                      ? 'text-purple-bright animate-neon-pulse motion-reduce:animate-none motion-reduce:[text-shadow:0_0_8px_rgba(192,132,252,0.9)]'
                      : 'text-white-body'
                  }`}
                >
                  {p.maskedUsername}
                </div>
                <div className="mt-1.5 h-2 bg-purple-gamba/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-gamba to-purple-bright shadow-[0_0_8px_rgba(168,85,247,0.8)] transition-[width] duration-700 ease-out motion-reduce:transition-none motion-reduce:duration-0"
                    style={{
                      width: mounted ? `${pct}%` : '0%',
                      transitionDelay: `${i * 60}ms`,
                    }}
                  />
                </div>
              </div>

              <span className="text-sm sm:text-base font-bold tabular-nums font-mono text-white-body text-right">
                {formatUSD(p.wagered)}
              </span>

              <span className="w-20 sm:w-24 text-right text-sm font-bold tabular-nums font-mono text-purple-bright">
                {p.prize > 0 ? formatUSD(p.prize) : '—'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Register it**

Edit `src/components/Leaderboard/themes/index.js` to the final 4-theme set:

```js
import BroadcastTheme from './BroadcastTheme';
import CasinoTheme from './CasinoTheme';
import MinimalTheme from './MinimalTheme';
import NeonTheme from './NeonTheme';

export const DEFAULT_THEME_ID = 'broadcast';

export const THEMES = [
  { id: 'broadcast', label: 'Broadcast', Component: BroadcastTheme },
  { id: 'casino', label: 'Casino', Component: CasinoTheme },
  { id: 'minimal', label: 'Minimal', Component: MinimalTheme },
  { id: 'neon', label: 'Neon', Component: NeonTheme },
];
```

- [ ] **Step 4: Smoke test**

Append to `src/components/Leaderboard/__tests__/Leaderboard.test.js`:

```jsx
  it('renders the neon theme when ?theme=neon', () => {
    const { container } = renderAt('/gamba/leaderboard?theme=neon');
    expect(container.querySelector('[data-theme="neon"]')).toBeTruthy();
  });
```

- [ ] **Step 5: Run tests + lint**

Run: `npm test -- --watchAll=false --testPathPattern=Leaderboard.test`
Expected: PASS (now 6 tests).
Run: `npx eslint src/components/Leaderboard/themes/NeonTheme.js`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/Leaderboard/themes/NeonTheme.js src/components/Leaderboard/themes/index.js tailwind.config.js src/components/Leaderboard/__tests__/Leaderboard.test.js
git commit -m "feat: add neon leaderboard theme with signature motion"
```

---

## Task 11: Final manual verification — all four themes + reduced motion

No code. Confirms the whole feature in the running app.

- [ ] **Step 1: Start the dev server**

Run: `npm start` → `http://localhost:3000/gamba/leaderboard`.

- [ ] **Step 2: Verify all four themes via chips**

Expected:
- Four chips: `Broadcast`, `Casino`, `Minimal`, `Neon`. Clicking each swaps the look and updates the URL (`?theme=casino`, etc.). `Broadcast` clears the param back to bare `/gamba/leaderboard`.
- Reset appears only when off broadcast; clicking it returns to broadcast and clears the param.
- Reload on `?theme=neon` → still neon (URL persistence).
- Direct-link `http://localhost:3000/gamba/leaderboard?theme=minimal` opens straight into minimal.

- [ ] **Step 3: Verify reduced motion**

In DevTools, emulate `prefers-reduced-motion: reduce` (Rendering tab). On the **neon** theme: the leader name's glow no longer pulses but remains a static glow; bars appear at full width without the fill animation. On **broadcast**: existing motion-reduce behavior unchanged.

- [ ] **Step 4: Verify tool routing once more**

From a non-default theme URL, switch gamba channels and back; confirm the leaderboard tool still loads and the theme param doesn't break navigation. Stop the server.

- [ ] **Step 5: No commit (verification only).**

---

## Task 12: Full test sweep

- [ ] **Step 1: Run the entire suite once**

Run: `npm test -- --watchAll=false`
Expected: all leaderboard tests pass (registry 4, Leaderboard 6, ThemeSwitcher 5) plus the pre-existing suites (`useLeaderboardData`, `format`, `mockData`, `useCountdown`, etc.) unchanged.

- [ ] **Step 2: Production build sanity**

Run: `npm run build`
Expected: build completes with no errors (ESLint `react-app` preset runs here; warnings acceptable if pre-existing, no new errors).

- [ ] **Step 3: No commit (verification only).**

---

## Self-Review Notes

- **Spec coverage:** registry + pluggable view (Tasks 3–4), data lifts to wrapper (Task 4), 4 themes (Tasks 2, 8, 9, 10), chips + conditional reset (Task 6), URL `?theme=` set/clear with default→bare-URL (Task 6), unknown-value fallback (Task 4 test), param/tool-routing isolation (Tasks 7, 11), motion on broadcast+neon only with reduced-motion handling (Task 10), minimal stays calm/casino subtle (Tasks 8–9), per-theme `data-theme` markers for tests (all theme tasks). 21st.dev is decided per-theme at build time — neon hand-rolls glow/bars here; if a primitive is later judged worth pulling, that's an additive change, not a plan gap.
- **Type/contract consistency:** every theme is `({ data, now })`; `THEMES` entries are `{ id, label, Component }`; `DEFAULT_THEME_ID === 'broadcast'`; `resolveTheme` falls back to `THEMES[0]`; `onSelect(id)` is the single switcher callback used for both chips and reset.
- **No placeholders:** every code step contains full file or full edit content.

---

## Implementation Addendum (as-built, 2026-05-31)

The plan above was followed through the core architecture (Tasks 1–7) and then
the scope grew during review. This addendum is the authoritative record of what
shipped on `feat/leaderboard-themes`.

### Deviations from the original plan

1. **Jest stub for react-router-dom (Task 4).** react-router v7 ships its core
   as ESM-only, which CRA's Jest resolver can't load. Added
   `src/test/reactRouterDomStub.js` + a `jest.moduleNameMapper` entry in
   `package.json` mapping `^react-router-dom$` to the stub. The wrapper test
   mocks `useSearchParams` per-file. Production webpack build is unaffected.

2. **Information contract (new requirement).** The reference Rainbet leaderboard
   carries a fixed set of facts; the first Minimal build dropped most of them.
   The spec was revised to mandate **7 facts on every theme** (prize headline,
   period, referral code + brand, countdown, top-3 highlight, ranked list,
   last-updated). Only presentation varies between themes; information does not.
   This drove:
   - `LEADERBOARD` constant in `src/constants.js` (`referralCode: 'BEAN'`,
     `brand: 'Rainbet'`) — single source of truth.
   - `useLeaderboardData` now returns `referralCode` + `brand` (overridable via
     options).
   - Shared `formatPrizeHeadline` added to `format.js`.
   - Minimal was rebuilt to the full contract; Casino and Neon built to it.

3. **Neon enrichment (21st.dev, adapted not dropped-in).**
   - `NeonShaderBackground.js` — a fixed full-viewport WebGL aurora/plasma
     shader (three.js, already a project dep). Adapted from a 21st.dev shader:
     retuned to the purple-gamba palette, dimmed for legibility, WebGL-
     unavailable guard, and a **static single-frame fallback under
     `prefers-reduced-motion`**. Mounts only while Neon is active.
   - `NeonPodium.js` — skewed purple gradient top-3 cards with a blurred glow
     clone behind frosted content and a motion-safe hover lift. Mechanics
     adapted from a 21st.dev gradient-card pattern; reskinned to the palette and
     fed real top-3 data. Neon's ranked list now starts at position 4.

4. **Demo disclaimer (legal cover).** A footer line in the wrapper
   (`Leaderboard.js`) renders on every theme: "Demo only — sample data for
   layout preview. Not a real leaderboard or live standings." A regression test
   asserts it is always present regardless of active theme. (An earlier
   top-corner badge was removed because it collided with Broadcast's T-MINUS.)

5. **Fixed, expirable end date + "leaderboard over" state.** `endsAt` now comes
   from a single editable `leaderboardEndsAt()` in `useLeaderboardData.js`
   (currently `2026-06-13 23:59:59`). To reset or expire the demo, edit that
   date. `useCountdown` exposes an `isOver` flag; every theme renders
   "LEADERBOARD OVER" instead of `00d 00h 00m 00s` once the date passes.

6. **Enlarged countdown (hype focal point).** The countdown was promoted to a
   focal element in every theme: Broadcast T-MINUS digits scaled up; Minimal got
   large calm digits with unit labels; Casino got gold flip-style tiles; Neon
   got glowing purple tiles. The over-state scales up too.

### Final file inventory

**Created**
- `src/components/Leaderboard/useNow.js`
- `src/components/Leaderboard/ThemeSwitcher.js`
- `src/components/Leaderboard/themes/index.js` (registry)
- `src/components/Leaderboard/themes/BroadcastTheme.js`
- `src/components/Leaderboard/themes/CasinoTheme.js`
- `src/components/Leaderboard/themes/MinimalTheme.js`
- `src/components/Leaderboard/themes/NeonTheme.js`
- `src/components/Leaderboard/themes/NeonShaderBackground.js`
- `src/components/Leaderboard/themes/NeonPodium.js`
- `src/test/reactRouterDomStub.js`
- Tests: `themes/__tests__/registry.test.js`, `__tests__/Leaderboard.test.js`,
  `__tests__/ThemeSwitcher.test.js`

**Modified**
- `src/components/Leaderboard/Leaderboard.js` (wrapper + disclaimer)
- `src/components/Leaderboard/format.js` (`formatPrizeHeadline`)
- `src/components/Leaderboard/BroadcastHeader.js` (over-state + bigger T-MINUS)
- `src/hooks/useLeaderboardData.js` (`referralCode`/`brand`, `leaderboardEndsAt`)
- `src/hooks/useCountdown.js` (`isOver`)
- `src/constants.js` (`LEADERBOARD`)
- `tailwind.config.js` (`neon-pulse` keyframe/animation)
- `package.json` (Jest `moduleNameMapper`)
- Tests: `useLeaderboardData.test.js`, `useCountdown.test.js`

### Verification at completion

- Full suite: **58 tests across 8 suites passing** (`npm test -- --watchAll=false`).
- `npm run build` compiles successfully.
- Manual verification confirmed by the user: all four themes render the full
  info contract; theme switching + URL `?theme=` behavior; tool-routing
  isolation; Neon reduced-motion (shader freezes, glow stops).

### Still open / not done

- Plan tasks were not literally checkbox-ticked in this file during inline
  execution; this addendum supersedes that tracking.
- A deeper design-led polish pass (further refining each theme's look) was not
  performed — the themes are functional and on-register but can be pushed
  further later.
