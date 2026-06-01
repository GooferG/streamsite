# Leaderboard Theme Rotation — Design

**Date:** 2026-05-31
**Status:** Approved (pending spec review)
**Area:** `src/components/Leaderboard/`, `/gamba/leaderboard`

## Problem / Goal

The gamba leaderboard renders one hardcoded visual style (a broadcast/CRT
"TV bumper" look). The data is intentionally mock — it represents the *idea*
of a real wager-race leaderboard (Rainbet/Stake style), not live values.

We want to use the page to **show off multiple leaderboard styles** using the
same data. A manual toggle lets the user rotate through distinct visual
"setups" (not just recolors) and link someone to a specific one.

Use case: "Go to my leaderboard page and check out some examples."

## Scope

**In scope**

- 4 themes total, sharing one data source:
  - `broadcast` — existing CRT/broadcast look (default). No visual change.
  - `casino` — casino-classic: podium-heavy, rank medals, gold/red register.
  - `minimal` — clean/modern: flat table, big numbers, whitespace. Calm.
  - `neon` — neon/arcade: high-contrast, glow, animated.
- A manual `ThemeSwitcher` (named chips + conditional reset).
- Theme persisted in URL via `?theme=<id>` query param. Shareable. Survives
  reload. Default theme writes no param (bare `/gamba/leaderboard`).
- Motion: `broadcast` (existing) + `neon` (new glow/pulse). All motion honors
  `prefers-reduced-motion`.

**Out of scope (YAGNI — revisit later)**

- Auto-rotate / carousel timer. (Manual only.)
- Per-theme signature motion for `casino` / `minimal`. (They stay calm by
  character. Motion only where it *defines* the theme.)
- Cross-device / shared persistence. (URL is the only persistence.)
- Path-segment routing for theme (`/gamba/leaderboard/neon`). Query param chosen.
- New themes beyond the 4. Registry makes a 5th trivial later.

## Visual approach & sourcing

Themes are built design-led (via the `frontend-design` / `impeccable` skill),
landing as production React + Tailwind in the repo — not Figma mockups. The
goal is four *genuinely distinct* looks, not recolors, so the visual work gets
real art direction rather than being designed incidentally while coding.

**21st.dev usage — per-theme, decided during implementation:**

- Default to **hand-rolling** components in the project's existing tokens.
- Pull a 21st.dev primitive **only** when a specific motion is clearly worth it
  (most likely `neon`'s glow pulse / animated bar fills). When pulled, strip it
  to mechanics and **reskin into project tokens** — nothing ships with its stock
  gradient/shadcn skin.
- **Never** import whole landing-style layouts (hero / bento / gradient-text /
  marquee). Those are `PRODUCT.md` hard anti-references and would make the themes
  read as generic AI-landing default — defeating the distinctiveness goal.
- Likely outcomes: `neon` may borrow motion primitives; `casino` hand-rolled;
  `broadcast` unchanged; `minimal` hand-rolled (its restraint is the point —
  imported flashy components fight it).

Any 21st.dev dependency added is justified at the point of use, not preemptively.

## Architecture

The codebase already separates **data** (`useLeaderboardData` hook) from
**view** (`Leaderboard.js`). We extend that seam: the view becomes pluggable.

### File layout

```
src/components/Leaderboard/
  Leaderboard.js          ← thin wrapper (NEW responsibility, see below)
  ThemeSwitcher.js        ← NEW: the toggle control (chips + reset)
  themes/
    index.js              ← NEW: registry { THEMES[], DEFAULT_THEME_ID }
    BroadcastTheme.js     ← NEW file, holds the CURRENT Leaderboard.js body verbatim
    CasinoTheme.js        ← NEW
    MinimalTheme.js       ← NEW
    NeonTheme.js          ← NEW
  BroadcastFrame.js, RaceBars.js, PodiumCard.js, RosterTable.js,
  TickerCrawl.js, SponsorBanner.js, ... ← UNCHANGED; BroadcastTheme keeps using them
  format.js, mockData.js  ← UNCHANGED
  index.js                ← UNCHANGED (still re-exports default from ./Leaderboard)
```

### Responsibility shift: data lifts to the wrapper

Today `Leaderboard.js` calls `useLeaderboardData()` and `useNow()` itself, then
renders the broadcast layout. After this change:

- **`Leaderboard.js` (wrapper)** calls `useLeaderboardData()` + `useNow()`
  **once**, resolves the active theme from the URL, and renders
  `<ThemeSwitcher>` + the active theme component, passing data down as props.
  Data is fetched once and shared across whatever theme is active.
- **Theme components** are pure presentational. Each receives identical props
  `{ data, now }` and owns only its look. `BroadcastTheme` is the existing body
  moved verbatim (minus the two hook calls, which now arrive as props).

This keeps each theme small, isolated, and independently testable: changing
`NeonTheme` cannot affect `CasinoTheme`.

### Registry (`themes/index.js`)

```js
import BroadcastTheme from './BroadcastTheme';
import CasinoTheme from './CasinoTheme';
import MinimalTheme from './MinimalTheme';
import NeonTheme from './NeonTheme';

export const THEMES = [
  { id: 'broadcast', label: 'Broadcast', Component: BroadcastTheme },
  { id: 'casino',    label: 'Casino',    Component: CasinoTheme },
  { id: 'minimal',   label: 'Minimal',   Component: MinimalTheme },
  { id: 'neon',      label: 'Neon',      Component: NeonTheme },
];

export const DEFAULT_THEME_ID = 'broadcast';
```

The switcher's chips, order, and labels all derive from `THEMES`. Adding a
theme = one entry here + one component file.

### Theme prop contract

Every theme component:

```js
export default function XTheme({ data, now }) { ... }
```

- `data` — the object returned by `useLeaderboardData()`:
  `{ players, prizePool, periodLabel, weekLabel, endsAt, lastUpdatedAt,
  isLoading, error }`.
- `now` — the ticking `Date.now()` value from `useNow()` (for countdowns).

A theme uses whatever subset it needs. It must not call `useLeaderboardData()`
itself (data is shared from the wrapper).

## Data flow

```
useLeaderboardData() ──┐
                       ├─► Leaderboard.js (wrapper)
useNow() ──────────────┘        │
                                ├─ read ?theme= via useSearchParams()
                                ├─ resolve → active theme (default if missing/unknown)
                                ├─ render <ThemeSwitcher active onChange onReset />
                                └─ render <ActiveTheme.Component data now />
```

## Theme switching & URL behavior

Wrapper uses react-router v7 `useSearchParams()` (already a dependency).

**Read**

```js
const [params, setParams] = useSearchParams();
const requested = params.get('theme');
const active = THEMES.find(t => t.id === requested) ?? THEMES[0]; // default broadcast
```

Unknown/garbage (`?theme=banana`) → falls back to default. No crash.

**Switch**

- Selecting a non-default theme → `setParams` sets `theme=<id>`, **merging**
  existing params (do not blow away other query state).
- Selecting the default theme, or hitting **Reset** → **delete** the `theme`
  param → URL returns to bare `/gamba/leaderboard`.
- Default theme is never written to the URL. Keeps the "main" leaderboard at a
  clean URL and makes reset = "remove the param."

**Param isolation (verified):** `GambaPage` selects the active *tool* from the
URL **path** via `useNavigate`/`useLocation` (e.g. `activeTool === 'leaderboard'`),
not from query params. `?theme=` is orthogonal and will not knock the user off
the leaderboard tool. Re-confirm during implementation before wiring `setParams`.

## ThemeSwitcher control

Persistent chrome at the top of the leaderboard surface, **inside the wrapper**
(above the active theme) so it stays consistent regardless of which theme is
active. It is **not** part of any theme's look — styled in the neutral brand
register so it reads the same across all four themes.

```
[ Broadcast ] [ Casino ] [ Minimal ] [ Neon ]      ↺ Reset
```

- Named chips (not arrows / dropdown) so the user can jump straight to a style
  by name when demoing, and the styles are self-documenting. Left-to-right click
  still gives a "rotate through" feel.
- Active chip is visually highlighted.
- **Reset** is shown **only when the active theme is non-default**. No reset
  from default → default.
- Chips, labels, and order come from `THEMES` (registry-driven).
- Keyboard-navigable; chips are real `<button>`s with appropriate
  pressed/selected state. Honors existing a11y conventions.

### Props

```js
<ThemeSwitcher
  themes={THEMES}
  activeId={active.id}
  defaultId={DEFAULT_THEME_ID}
  onSelect={(id) => /* wrapper sets/clears ?theme= */}
/>
```

Reset is internal to the switcher: it renders the reset affordance when
`activeId !== defaultId` and calls `onSelect(defaultId)`.

## Motion & accessibility

- **Broadcast** — unchanged. Existing ticker crawl, race-bar fills, scanline,
  pulsing session dot. Already gates on `motion-reduce:*` / `prefers-reduced-motion`.
- **Neon** — signature motion defines the theme:
  - Glow pulse on leader / top ranks (animated box/text-shadow "breathing").
  - Animated bar fills (grow/slide on update rather than snapping).
  - Subtle ambient scanline/flicker; optional shimmer sweep on top rank.
  - Under `prefers-reduced-motion: reduce`: motion stops, **static glow color
    stays** so the theme still reads as "neon" without movement.
- **Casino** — subtle at most (e.g. medal shine on hover); essentially static.
- **Minimal** — calm by definition; no motion (motion would contradict the
  theme's character).

All new keyframes follow the existing pattern (global `<style jsx>` keyframes in
`App.js` or Tailwind `motion-safe:` / `motion-reduce:` utilities). No motion is
mandatory for comprehension — reduced-motion users get a static but complete view.

## Error handling

- Unknown/missing `?theme=` → default theme (covered above).
- `data.isLoading` / `data.error` — currently always `false` / `null` (mock).
  Each theme should still render gracefully if `players` is short or empty
  (e.g. fewer than 3 for a podium): guard array destructuring / slices, as the
  existing broadcast theme already does (`[leader, runnerUp, third, ...rest]`
  with `.filter(Boolean)`).
- A theme component must never throw on missing optional fields; treat all
  `data` fields as present-but-possibly-empty.

## Testing

- **Existing tests unchanged.** `useLeaderboardData`, `format`, `mockData` tests
  keep passing — data layer is untouched.
- **Registry test** — `THEMES` ids are unique; `DEFAULT_THEME_ID` exists in
  `THEMES`; every entry has `{ id, label, Component }`.
- **Wrapper resolution test** — given `?theme=` of: valid id → that theme;
  missing → default; unknown → default. (Render with a `MemoryRouter` +
  `initialEntries`, assert which theme rendered, e.g. via a `data-theme` attr on
  each theme's root.)
- **ThemeSwitcher test** — reset hidden when `activeId === defaultId`, shown
  otherwise; clicking a chip calls `onSelect` with the right id; clicking reset
  calls `onSelect(defaultId)`.
- New theme components: smoke-render each with mock data, assert no throw and a
  stable root marker. Visual fidelity is reviewed by eye, not asserted.
- Tests are not wired into CI (consistent with repo convention); run locally
  via `npm test -- --watchAll=false`.

## Implementation notes / sequencing

1. Extract current `Leaderboard.js` body → `themes/BroadcastTheme.js`, taking
   `{ data, now }` as props instead of calling the hooks. No visual change.
2. Add `themes/index.js` registry with just `broadcast` wired.
3. Rewrite `Leaderboard.js` as the wrapper (hooks + `useSearchParams` + render
   active theme). Verify broadcast still renders identically at
   `/gamba/leaderboard` and `?theme=broadcast` clears to bare URL.
4. Build `ThemeSwitcher`; wire select/reset to `setParams`.
5. Add `CasinoTheme`, `MinimalTheme`, `NeonTheme` one at a time, each behind its
   registry entry, each consuming the shared `{ data, now }`.
6. Confirm `?theme=` does not disturb `GambaPage` tool routing.

Each theme is added independently — partial progress is always shippable
(unknown ids fall back to broadcast).

## Design register per theme

Per `PRODUCT.md`: `/gamba/*` is a product/utility surface but the leaderboard is
also a showcase. Themes intentionally diverge in register to demonstrate range:

- `broadcast` — house brand (late-night CRT / cable-bumper). The anchor look.
- `casino` — deliberately leans toward the "casino chrome" the brand normally
  *avoids*, because the point is to demo that style on request. Acceptable here
  precisely because it's an opt-in example, not the default.
- `minimal` — modern/clean SaaS-leaderboard register. The "calm" counterpoint.
- `neon` — arcade/neon. High energy.

The `ThemeSwitcher` chrome stays in house brand throughout so the page frame
reads as GooferG regardless of the example on display.
