# Leaderboard Themes HiFi Upgrade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the four existing leaderboard themes (broadcast/casino/minimal/neon) up to the hifi design handoff — exact palettes, self-hosted fonts, CRT/gold-foil/grid-horizon effects, leader count-up, and a wager-to-climb hover callout — without touching the data layer, switcher, or routing.

**Architecture:** Theme components stay pure-presentational `({ data, now })`. Two shared helpers are added: a `useCountUp` hook (leader total) and an inline gap-to-climb derivation (per row). Fonts self-hosted via `@fontsource`; new Tailwind color tokens + keyframes are additive. Effects that don't map to utilities go in per-theme inline `<style>` blocks (existing codebase pattern, see `SponsorBanner.js`). Build foundation → hook → one theme at a time, eyeballing each in the running app before commit.

**Tech Stack:** React 19, Tailwind (custom tokens in `tailwind.config.js`), `@fontsource/*` fonts, Jest + `@testing-library/react` (jsdom). No new runtime deps beyond fonts; `three` is retained (used by `TVStaticIntro.js`).

Spec: [docs/superpowers/specs/2026-06-01-leaderboard-themes-hifi-design.md](../specs/2026-06-01-leaderboard-themes-hifi-design.md)

---

## File Structure

**Create**
- `src/components/Leaderboard/useCountUp.js` — count-up animation hook (leader total only)
- `src/components/Leaderboard/__tests__/useCountUp.test.js` — hook unit test
- `src/components/Leaderboard/gap.js` — `gapToClimb(players, index)` derivation helper (shared by themes)

**Modify**
- `package.json` — 4 `@fontsource` deps
- `src/index.js` — `@fontsource` imports
- `tailwind.config.js` — fonts, colors, keyframes, animations
- `src/components/Leaderboard/BroadcastFrame.js` — vignette + sweep + flicker CRT layers
- `src/components/Leaderboard/BroadcastHeader.js` — phosphor accent + chromatic-aberration title
- `src/components/Leaderboard/LeaderTakeover.js` — phosphor accent + leader count-up
- `src/components/Leaderboard/RaceBars.js` — phosphor accent + gap-to-climb hover
- `src/components/Leaderboard/RosterTable.js` — phosphor accent + gap-to-climb hover
- `src/components/Leaderboard/themes/BroadcastTheme.js` — (no change expected; composition stays)
- `src/components/Leaderboard/themes/CasinoTheme.js` — full hifi rebuild
- `src/components/Leaderboard/themes/MinimalTheme.js` — full hifi rebuild
- `src/components/Leaderboard/themes/NeonTheme.js` — full hifi rebuild (+ shader removal)
- `src/components/Leaderboard/themes/NeonPodium.js` — pink/cyan rework

**Delete**
- `src/components/Leaderboard/themes/NeonShaderBackground.js`

---

## Task 1: Self-host fonts

Adds the four handoff fonts to the build pipeline via `@fontsource` and imports them at the CRA entry so every theme can reference them through Tailwind.

**Files:**
- Modify: `package.json`
- Modify: `src/index.js`

- [ ] **Step 1: Install the font packages**

Run:

```bash
npm install @fontsource/cormorant-garamond @fontsource/space-grotesk @fontsource/orbitron @fontsource/rajdhani
```

Expected: four packages added to `dependencies` in `package.json`, no peer-dep errors.

- [ ] **Step 2: Import the needed weights in `src/index.js`**

Open `src/index.js`. After the existing import block (find the line importing `./index.css`), add these imports immediately **above** the `./index.css` import (so app CSS can still override):

```js
// Self-hosted leaderboard-theme fonts (Anton + mono already loaded elsewhere).
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/700.css';
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/orbitron/500.css';
import '@fontsource/orbitron/700.css';
import '@fontsource/orbitron/800.css';
import '@fontsource/orbitron/900.css';
import '@fontsource/rajdhani/400.css';
import '@fontsource/rajdhani/500.css';
import '@fontsource/rajdhani/600.css';
import '@fontsource/rajdhani/700.css';
```

If `src/index.js` does not import `./index.css`, place these imports after the React/ReactDOM imports and before `ReactDOM.createRoot`.

- [ ] **Step 3: Verify the dev server boots with fonts**

Run: `npm start`
Expected: compiles with no module-not-found errors for `@fontsource/*`. (Visual check happens in later theme tasks.) Stop the server.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/index.js
git commit -m "build: self-host leaderboard theme fonts via fontsource"
```

---

## Task 2: Tailwind tokens, fonts, keyframes

Adds the handoff palettes, font families, and ambient keyframes. All additive — existing tokens/keyframes are untouched.

**Files:**
- Modify: `tailwind.config.js`

- [ ] **Step 1: Add font families**

In `tailwind.config.js`, replace the `fontFamily` block with (keeps `mono` + `display`, adds four):

```js
      fontFamily: {
        mono: ['source-code-pro', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        display: ['Anton', 'Impact', 'Haettenschweiler', 'sans-serif'],
        'serif-luxe': ['"Cormorant Garamond"', 'Georgia', 'serif'],
        grotesk: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        orbitron: ['Orbitron', 'sans-serif'],
        rajdhani: ['Rajdhani', 'sans-serif'],
      },
```

- [ ] **Step 2: Add color tokens**

In the `colors` object (after `'white-muted': '#a1a1aa',`), add:

```js
        // Broadcast hifi (phosphor CRT)
        phosphor: '#1ff39a',
        'phosphor-dim': '#0e7d54',
        'crt-amber': '#ffb24d',
        'crt-cyan': '#46e6ff',
        // Casino hifi (gold)
        'gold-lite': '#f8e7b0',
        gold: '#e7c267',
        'gold-deep': '#a9812f',
        'gold-edge': '#6f5520',
        cream: '#f4ecd8',
        // Minimal hifi (cool-blue accent)
        'mn-acc': '#8fb3ff',
        'mn-acc-deep': '#5b80d8',
        // Neon hifi (synthwave)
        'nn-pink': '#ff2d95',
        'nn-pink-lite': '#ff7ac4',
        'nn-cyan': '#21e6ff',
        'nn-cyan-lite': '#8af6ff',
        'nn-violet': '#7a3dff',
        'nn-purple': '#b14dff',
        'nn-orange': '#ff8a3d',
```

- [ ] **Step 3: Add keyframes**

In `theme.extend.keyframes` (after the existing `'neon-pulse'` block), add:

```js
        'bc-sweep': {
          '0%': { transform: 'translateY(-160px)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        'bc-flicker': {
          '0%, 96%, 100%': { opacity: '1' },
          '97%': { opacity: '0.86' },
          '98%': { opacity: '1' },
          '99%': { opacity: '0.92' },
        },
        'cs-foil': {
          '0%': { backgroundPosition: '0% 0' },
          '100%': { backgroundPosition: '250% 0' },
        },
        'nn-grid': {
          '0%': { backgroundPosition: '0 0, 0 0' },
          '100%': { backgroundPosition: '0 46px, 0 46px' },
        },
        'nn-flicker': {
          '0%, 93%, 100%': { opacity: '1' },
          '94%': { opacity: '0.7' },
          '95%': { opacity: '1' },
          '97%': { opacity: '0.85' },
        },
```

- [ ] **Step 4: Add animations**

In `theme.extend.animation` (after `'neon-pulse': ...`), add:

```js
        'bc-sweep': 'bc-sweep 7s linear infinite',
        'bc-flicker': 'bc-flicker 5.5s steps(60) infinite',
        'cs-foil': 'cs-foil 6s linear infinite',
        'nn-grid': 'nn-grid 1.6s linear infinite',
        'nn-flicker': 'nn-flicker 6s steps(50) infinite',
```

(Note: `nn-streak` is per-element with varying duration/delay, so it's defined as an inline keyframe in the Neon theme's `<style>` block, not here.)

- [ ] **Step 5: Verify the config parses**

Run: `node -e "require('./tailwind.config.js'); console.log('ok')"`
Expected: prints `ok` (no syntax error).

- [ ] **Step 6: Commit**

```bash
git add tailwind.config.js
git commit -m "feat: add hifi leaderboard theme tokens, fonts, keyframes"
```

---

## Task 3: `useCountUp` hook (TDD)

The leader's wager total ramps from 0 → total on first mount (easeOutCubic, ~1.5s, 200ms delay). On a later target change (45s live poll), it ramps prev → new, not 0 → new. Under `prefers-reduced-motion`, it returns the target immediately.

**Files:**
- Create: `src/components/Leaderboard/useCountUp.js`
- Test: `src/components/Leaderboard/__tests__/useCountUp.test.js`

- [ ] **Step 1: Write the failing test**

`src/components/Leaderboard/__tests__/useCountUp.test.js`:

```jsx
import { renderHook, act } from '@testing-library/react';
import useCountUp from '../useCountUp';

// jsdom has no rAF timing or matchMedia by default; stub both.
beforeEach(() => {
  let t = 0;
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    t += 16;
    return setTimeout(() => cb(t), 0);
  });
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => clearTimeout(id));
});

afterEach(() => {
  jest.restoreAllMocks();
});

function mockReducedMotion(reduce) {
  window.matchMedia = jest.fn().mockImplementation((q) => ({
    matches: reduce,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  }));
}

describe('useCountUp', () => {
  it('returns the target immediately under prefers-reduced-motion', () => {
    mockReducedMotion(true);
    const { result } = renderHook(() => useCountUp(1000, { durationMs: 1500, delayMs: 0 }));
    expect(result.current).toBe(1000);
  });

  it('starts below target and settles at exactly the target when motion is allowed', async () => {
    mockReducedMotion(false);
    jest.useFakeTimers();
    const { result } = renderHook(() => useCountUp(1000, { durationMs: 200, delayMs: 0 }));
    // Initial value before the ramp completes is below the target.
    expect(result.current).toBeLessThan(1000);
    // Advance well past duration + delay so the ramp settles.
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(1000);
    jest.useRealTimers();
  });

  it('guards undefined/null target to 0 (no NaN)', () => {
    mockReducedMotion(true);
    const { result } = renderHook(() => useCountUp(undefined));
    expect(result.current).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --watchAll=false --testPathPattern=useCountUp`
Expected: FAIL — cannot find module `../useCountUp`.

- [ ] **Step 3: Implement the hook**

`src/components/Leaderboard/useCountUp.js`:

```js
import { useEffect, useRef, useState } from 'react';

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Ramps a number toward `target` with easeOutCubic. First mount ramps 0 →
// target; subsequent target changes ramp the previous settled value → target,
// so the periodic data re-poll reads as a tick-up rather than a re-sweep from 0.
// Under prefers-reduced-motion, jumps straight to target (no animation).
export default function useCountUp(target, { durationMs = 1500, delayMs = 200 } = {}) {
  const safeTarget = Number.isFinite(target) ? target : 0;
  const [val, setVal] = useState(safeTarget && prefersReducedMotion() ? safeTarget : 0);
  const prevRef = useRef(prefersReducedMotion() ? safeTarget : 0);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setVal(safeTarget);
      prevRef.current = safeTarget;
      return undefined;
    }

    const from = prevRef.current;
    const delta = safeTarget - from;
    let raf;
    let start;
    let delayTimer;

    const tick = (now) => {
      if (start == null) start = now;
      const p = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setVal(from + delta * eased);
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setVal(safeTarget);
        prevRef.current = safeTarget;
      }
    };

    delayTimer = setTimeout(() => {
      raf = requestAnimationFrame(tick);
    }, delayMs);

    return () => {
      clearTimeout(delayTimer);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [safeTarget, durationMs, delayMs]);

  return val;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --watchAll=false --testPathPattern=useCountUp`
Expected: PASS (3 tests).

- [ ] **Step 5: Lint**

Run: `npx eslint src/components/Leaderboard/useCountUp.js`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/Leaderboard/useCountUp.js src/components/Leaderboard/__tests__/useCountUp.test.js
git commit -m "feat: add useCountUp hook for leader wager count-up"
```

---

## Task 4: `gapToClimb` helper

Pure derivation of the "wager to climb" amount for the row above. `data.players` is already sorted descending by `wagered`, so the gap for the player at index `i` is `players[i-1].wagered - players[i].wagered`.

**Files:**
- Create: `src/components/Leaderboard/gap.js`
- Test: `src/components/Leaderboard/__tests__/gap.test.js`

- [ ] **Step 1: Write the failing test**

`src/components/Leaderboard/__tests__/gap.test.js`:

```js
import { gapToClimb } from '../gap';

const players = [
  { position: 1, wagered: 1000 },
  { position: 2, wagered: 600 },
  { position: 3, wagered: 550 },
];

describe('gapToClimb', () => {
  it('returns 0 for the leader (index 0)', () => {
    expect(gapToClimb(players, 0)).toBe(0);
  });

  it('returns the wager difference to the player directly above', () => {
    expect(gapToClimb(players, 1)).toBe(400);
    expect(gapToClimb(players, 2)).toBe(50);
  });

  it('returns 0 when the player above is missing or out of range', () => {
    expect(gapToClimb(players, 99)).toBe(0);
    expect(gapToClimb([], 0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --watchAll=false --testPathPattern=gap.test`
Expected: FAIL — cannot find module `../gap`.

- [ ] **Step 3: Implement the helper**

`src/components/Leaderboard/gap.js`:

```js
// "Wager to climb" — how much more this player needs to pass the player directly
// above. `players` must be sorted descending by wagered (the feed already is).
// Returns 0 for the leader or any out-of-range/missing neighbor.
export function gapToClimb(players, index) {
  if (!Array.isArray(players) || index <= 0) return 0;
  const above = players[index - 1];
  const self = players[index];
  if (!above || !self) return 0;
  const diff = above.wagered - self.wagered;
  return diff > 0 ? diff : 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --watchAll=false --testPathPattern=gap.test`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Leaderboard/gap.js src/components/Leaderboard/__tests__/gap.test.js
git commit -m "feat: add gapToClimb derivation helper for leaderboard rows"
```

---

## Task 5: Broadcast — phosphor accent + CRT layers + count-up + gap

Broadcast keeps its composition. This task: swap emerald→phosphor in its broadcast-only subcomponents, add the missing CRT overlays (vignette/sweep/flicker), give the title a chromatic-aberration ghost, wire the leader count-up, and add the gap-to-climb hover to the race/roster rows.

**Files:**
- Modify: `src/components/Leaderboard/BroadcastFrame.js`
- Modify: `src/components/Leaderboard/BroadcastHeader.js`
- Modify: `src/components/Leaderboard/LeaderTakeover.js`
- Modify: `src/components/Leaderboard/RaceBars.js`
- Modify: `src/components/Leaderboard/RosterTable.js`

- [ ] **Step 1: Add CRT vignette + sweep + flicker to `BroadcastFrame.js`**

Replace the file body's outer wrapper. The current root is:
`<div className="relative overflow-hidden border border-white/10 bg-zinc-card/40">`

Change it to add the flicker animation class and insert vignette + sweep overlays right after the existing scanline overlay div. Full updated `BroadcastFrame.js`:

```jsx
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
    <div className="relative overflow-hidden border border-phosphor/20 bg-zinc-card/40 motion-safe:animate-bc-flicker">
      {/* Scanlines */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-screen motion-reduce:hidden"
        aria-hidden="true"
        style={{
          backgroundImage:
            'repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(255,255,255,0.6) 2px, rgba(255,255,255,0.6) 3px)',
        }}
      />
      {/* Vignette */}
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(120% 120% at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)',
        }}
      />
      {/* CRT light sweep */}
      <div
        className="pointer-events-none absolute left-0 right-0 z-[2] h-36 motion-reduce:hidden motion-safe:animate-bc-sweep"
        aria-hidden="true"
        style={{
          top: '-160px',
          background:
            'linear-gradient(180deg, transparent, rgba(31,243,154,0.05), transparent)',
        }}
      />

      {CORNERS.map(({ pos, glyph }) => (
        <span
          key={pos}
          className={`pointer-events-none absolute ${pos} z-10 text-phosphor/70 text-xs font-bold leading-none select-none`}
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

      <div className="relative z-[3]">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Phosphor accent + chromatic-aberration title in `BroadcastHeader.js`**

In `BroadcastHeader.js`, change the BTC up-color and the title. Two edits:

(a) The BTC change `<span>` uses `text-emerald-signal` for the up case — change to `text-phosphor`:

```jsx
                <span className={btcUp ? 'text-phosphor' : 'text-red-destructive'}>
                  {btcChangeText}
                </span>
```

(b) Replace the title `<h1>` block (the one with `font-display ... MONTHLY LEADERBOARD`) with a phosphor + chromatic-aberration version:

```jsx
        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-none mt-1 uppercase">
          <span
            className="relative text-phosphor"
            style={{
              textShadow:
                '0 0 18px rgba(31,243,154,0.6), 0 0 4px rgba(31,243,154,0.9)',
            }}
          >
            {formatPrizeHeadline(prizePool)}
            <span
              aria-hidden="true"
              className="absolute left-[1.5px] top-0 text-[#ff3b6b] mix-blend-screen opacity-40"
            >
              {formatPrizeHeadline(prizePool)}
            </span>
          </span>{' '}
          <span className="text-white-body">MONTHLY LEADERBOARD</span>
        </h1>
```

- [ ] **Step 3: Phosphor accent + leader count-up in `LeaderTakeover.js`**

In `LeaderTakeover.js`:

(a) Add the import at the top (after the existing imports):

```jsx
import useCountUp from './useCountUp';
```

(b) At the top of the component body (after `const lead = ...`), add:

```jsx
  const animatedWagered = useCountUp(leader.wagered, { durationMs: 1600, delayMs: 250 });
```

(c) Replace every `emerald-signal` class in the file with `phosphor` (there are several: border, glow blur, LIVE dot + text, the P-number ghost/solid, TOTAL WAGERED number, PRIZE label + number). Use find/replace within the file: `emerald-signal` → `phosphor`.

(d) Change the TOTAL WAGERED value to use the animated number — replace
`{formatUSD(leader.wagered)}` (the one under the `TOTAL WAGERED` label) with:

```jsx
              {formatUSD(animatedWagered)}
```

- [ ] **Step 4: Phosphor accent + gap-to-climb hover in `RaceBars.js`**

In `RaceBars.js`:

(a) Add import (after existing imports):

```jsx
import { gapToClimb } from './gap';
```

(b) The bar fill `<div>` currently uses `bg-white/35`. Change it to phosphor:

```jsx
                <div
                  className="h-full bg-gradient-to-r from-phosphor/30 to-phosphor shadow-[0_0_12px_rgba(31,243,154,0.4)] transition-[width] duration-700 ease-out motion-reduce:transition-none motion-reduce:duration-0"
                  style={{
                    width: mounted ? `${pct}%` : '0%',
                    transitionDelay: `${i * 80}ms`,
                  }}
                />
```

(c) The PRIZE label/value use `emerald-signal` — change both to `phosphor`.

(d) Make the row a hover group and add the gap callout. Change the row container to add `group relative`:

```jsx
          <div
            key={p.id}
            className="group relative grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-4 px-4 sm:px-6 py-3"
          >
```

Inside the name cell (the `<div className="min-w-0">`), after the bar `<div>`, add:

```jsx
              {gapToClimb(players, i) > 0 && (
                <div className="pointer-events-none absolute left-[118px] -bottom-0.5 hidden sm:block text-[10px] tracking-eyebrow-xs text-crt-amber opacity-0 transition-opacity duration-150 group-hover:opacity-100 font-mono">
                  +{formatUSD(gapToClimb(players, i))} TO {formatPosition(p.position - 1)}
                </div>
              )}
```

Note: `players` here is the array passed to `RaceBars` (already sorted, indices align with rank order within this slice). The gap is relative to the previous racer in the list. `formatPosition` is already imported.

- [ ] **Step 5: Phosphor accent + gap-to-climb hover in `RosterTable.js`**

Apply the **same** four sub-edits as Step 4 to `RosterTable.js` (same import, same bar gradient, same PRIZE phosphor swap, same `group relative` row + gap callout). The roster's `players` prop is the lower slice; the gap is "to the player above within this slice", which is the correct relative climb target for adjacent rows.

The roster row already has `hover:bg-white/3` — keep it and add `group relative`:

```jsx
            <div
              key={p.id}
              className="group relative grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-4 px-4 sm:px-6 py-3 hover:bg-white/3 transition-colors motion-reduce:transition-none"
            >
```

- [ ] **Step 6: Lint the changed files**

Run: `npx eslint src/components/Leaderboard/BroadcastFrame.js src/components/Leaderboard/BroadcastHeader.js src/components/Leaderboard/LeaderTakeover.js src/components/Leaderboard/RaceBars.js src/components/Leaderboard/RosterTable.js`
Expected: no errors.

- [ ] **Step 7: Run the leaderboard tests (no regression)**

Run: `npm test -- --watchAll=false --testPathPattern=Leaderboard`
Expected: PASS — resolution + ThemeSwitcher tests unaffected (`data-theme="broadcast"` still present).

- [ ] **Step 8: VERIFY IN APP — pause for user review**

Run: `npm start` → `http://localhost:3000/gamba/leaderboard`.
Confirm: phosphor-green accents throughout; CRT vignette + a slow light sweep + faint whole-frame flicker; title is phosphor with a faint red ghost offset; the leader's TOTAL WAGERED counts up on load; hovering a race/roster row reveals `+$X TO P0N` in amber. Toggle `prefers-reduced-motion` (DevTools → Rendering): sweep/flicker stop, count-up is instant, glow color remains. **Stop and let the user eyeball before committing.**

- [ ] **Step 9: Commit (after user approval)**

```bash
git add src/components/Leaderboard/BroadcastFrame.js src/components/Leaderboard/BroadcastHeader.js src/components/Leaderboard/LeaderTakeover.js src/components/Leaderboard/RaceBars.js src/components/Leaderboard/RosterTable.js
git commit -m "feat: upgrade broadcast theme to hifi phosphor CRT look"
```

---

## Task 6: Casino — engraved gold seals, foil title, guilloché, count-up, gap

Full rebuild of `CasinoTheme.js` to the gold Monte-Carlo look: remove emoji medals → CSS engraved seals + crown, Cormorant Garamond serif, animated gold-foil headline, guilloché texture + double-framed plaque, zebra table, gap-to-climb hover, leader count-up. Renders all 7 facts.

**Files:**
- Modify: `src/components/Leaderboard/themes/CasinoTheme.js` (full replace)

- [ ] **Step 1: Replace `CasinoTheme.js`**

`src/components/Leaderboard/themes/CasinoTheme.js` (full file):

```jsx
import { useCountdown } from '../../../hooks/useCountdown';
import { formatUSD, formatPosition, formatPrizeHeadline } from '../format';
import { gapToClimb } from '../gap';
import useCountUp from '../useCountUp';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function freshness(now, lastUpdatedAt) {
  const ms = Math.max(0, now - lastUpdatedAt);
  if (ms < 60_000) return `${Math.floor(ms / 1000)}S AGO`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}M AGO`;
  return `${Math.floor(ms / 3_600_000)}H AGO`;
}

function deltaInfo(player) {
  const d = (player.previousPosition || player.position) - player.position;
  if (d > 0) return { glyph: '▲', cls: 'text-emerald-bright' };
  if (d < 0) return { glyph: '▼', cls: 'text-red-destructive' };
  return { glyph: '–', cls: 'text-white/35' };
}

// CSS engraved gold seal — radial metal disc, dashed inner ring, embossed rank
// numeral. Replaces emoji medals (handoff: do not use emoji). 1st gets a larger
// seal + crown glyph.
function Seal({ position, first }) {
  return (
    <div className="relative mx-auto mb-3" aria-hidden="true">
      {first && (
        <span
          className="absolute left-1/2 -top-4 -translate-x-1/2 text-xl text-gold-lite"
          style={{ filter: 'drop-shadow(0 0 8px rgba(231,194,103,0.7))' }}
        >
          ♔
        </span>
      )}
      <div
        className={`relative rounded-full flex items-center justify-center ${
          first ? 'w-[78px] h-[78px]' : 'w-[62px] h-[62px]'
        }`}
        style={{
          background:
            'radial-gradient(circle at 35% 30%, #f8e7b0, #e7c267 45%, #a9812f 100%)',
          boxShadow:
            '0 4px 14px rgba(0,0,0,0.5), inset 0 2px 3px rgba(255,255,255,0.5), inset 0 -3px 6px rgba(90,60,15,0.7)',
        }}
      >
        <span
          className="absolute rounded-full border border-dashed"
          style={{ inset: '5px', borderColor: 'rgba(110,80,25,0.6)' }}
        />
        <span
          className={`font-serif-luxe font-bold ${first ? 'text-[34px]' : 'text-[26px]'}`}
          style={{ color: '#3a2a08', textShadow: '0 1px 0 rgba(255,255,255,0.4)' }}
        >
          {position}
        </span>
      </div>
    </div>
  );
}

function PodiumCard({ player, first, animatedWagered }) {
  if (!player) return null;
  const wag = first && animatedWagered != null ? animatedWagered : player.wagered;
  return (
    <div
      className={`relative text-center px-5 ${
        first
          ? 'pt-10 pb-8 border border-gold-deep'
          : 'pt-7 pb-6 border border-gold/20'
      }`}
      style={
        first
          ? {
              background:
                'linear-gradient(180deg, rgba(40,28,12,0.8), rgba(14,10,5,0.6))',
              boxShadow:
                '0 0 50px rgba(231,194,103,0.16), inset 0 1px 0 rgba(231,194,103,0.3)',
            }
          : {
              background:
                'linear-gradient(180deg, rgba(24,17,9,0.65), rgba(10,7,4,0.5))',
            }
      }
    >
      <Seal position={player.position} first={first} />
      <div className="text-[11px] tracking-eyebrow text-cream/45 uppercase font-mono">
        {formatPosition(player.position)}
      </div>
      <div className="mt-1.5 font-serif-luxe font-bold text-2xl sm:text-3xl text-cream tracking-wide break-all">
        {player.maskedUsername}
      </div>
      <div className="mt-2 font-serif-luxe font-bold text-2xl sm:text-[34px] tabular-nums text-gold-lite">
        {formatUSD(wag)}
      </div>
      <div className="mt-2 text-xs tracking-eyebrow text-gold uppercase">
        Prize {formatUSD(player.prize)}
      </div>
    </div>
  );
}

// Casino-classic: black + gold Monte-Carlo luxe. Renders the full info contract;
// restrained motion (gold-foil shimmer only). Replaces emoji medals with CSS
// engraved seals.
export default function CasinoTheme({ data, now }) {
  const remaining = useCountdown(data.endsAt);
  const [first, second, third, ...rest] = data.players;
  const list = rest.slice(0, 17);
  const animatedWagered = useCountUp(first ? first.wagered : 0, {
    durationMs: 1500,
    delayMs: 200,
  });

  return (
    <div data-theme="casino" className="relative overflow-hidden">
      {/* Guilloché texture + gold glow */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-50"
        aria-hidden="true"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, rgba(231,194,103,0.025) 0 2px, transparent 2px 9px), repeating-linear-gradient(-45deg, rgba(231,194,103,0.02) 0 2px, transparent 2px 9px)',
        }}
      />
      <div
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-32 w-[700px] h-[440px] z-0"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(circle, rgba(231,194,103,0.16), transparent 65%)',
          filter: 'blur(10px)',
        }}
      />

      {/* Double-framed plaque */}
      <div
        className="relative z-[1] border border-gold/20"
        style={{
          background:
            'linear-gradient(180deg, rgba(20,14,8,0.5), rgba(8,6,4,0.2))',
          boxShadow:
            '0 0 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(231,194,103,0.12)',
        }}
      >
        <div className="m-2.5 border border-gold/10">
          {/* Header */}
          <div className="px-4 sm:px-6 py-6 border-b border-gold/20 text-center">
            <div className="text-[11px] tracking-eyebrow-lg text-gold uppercase font-mono">
              {data.periodLabel}
            </div>
            <h2 className="mt-1 font-serif-luxe font-bold text-4xl sm:text-6xl leading-none tracking-wide">
              <span
                className="motion-safe:animate-cs-foil"
                style={{
                  backgroundImage:
                    'linear-gradient(100deg, #a9812f 0%, #f8e7b0 25%, #fff7e0 38%, #f8e7b0 52%, #e7c267 70%, #a9812f 100%)',
                  backgroundSize: '250% 100%',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                {formatPrizeHeadline(data.prizePool)}
              </span>{' '}
              <span className="text-cream">Prize Pool</span>
            </h2>

            {/* Diamond rule */}
            <div className="flex items-center justify-center gap-3.5 mx-auto mt-3.5 max-w-[320px]">
              <span className="h-px flex-1" style={{ background: 'linear-gradient(90deg,transparent,#a9812f)' }} />
              <span className="w-1.5 h-1.5 rotate-45 bg-gold" style={{ boxShadow: '0 0 10px rgba(231,194,103,0.7)' }} />
              <span className="h-px flex-1" style={{ background: 'linear-gradient(90deg,#a9812f,transparent)' }} />
            </div>

            <div className="mt-3 text-[11px] tracking-eyebrow-sm uppercase font-mono text-cream/60">
              Join code <span className="text-gold">{data.referralCode}</span> on{' '}
              <span className="text-gold">{data.brand}</span>
            </div>

            {/* Countdown — engraved tiles */}
            {remaining.isOver ? (
              <div className="mt-6 font-serif-luxe font-bold text-3xl sm:text-4xl uppercase text-red-destructive">
                Leaderboard Over
              </div>
            ) : (
              <div className="mt-6 flex justify-center gap-3.5">
                {[
                  ['Days', remaining.days],
                  ['Hrs', remaining.hours],
                  ['Min', remaining.minutes],
                  ['Sec', remaining.seconds],
                ].map(([label, value]) => (
                  <div key={label} className="text-center">
                    <div
                      className="relative w-14 sm:w-20 py-3.5 border border-gold-deep font-serif-luxe font-bold text-3xl sm:text-5xl tabular-nums text-gold-lite"
                      style={{
                        background:
                          'linear-gradient(180deg, rgba(30,22,10,0.9), rgba(12,9,5,0.9))',
                        boxShadow:
                          'inset 0 1px 0 rgba(231,194,103,0.25), inset 0 -10px 20px rgba(0,0,0,0.5)',
                      }}
                    >
                      {pad2(value)}
                      <span
                        className="absolute left-1.5 right-1.5 top-1/2 h-px"
                        style={{ background: 'rgba(0,0,0,0.6)' }}
                      />
                    </div>
                    <div className="mt-2 text-[10px] tracking-eyebrow-md text-cream/45 uppercase font-mono">
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Podium — order 2nd · 1st · 3rd */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.15fr_1fr] gap-4 items-end px-4 sm:px-6 py-8">
            <div className="sm:order-1">
              <PodiumCard player={second} />
            </div>
            <div className="sm:order-2">
              <PodiumCard player={first} first animatedWagered={animatedWagered} />
            </div>
            <div className="sm:order-3">
              <PodiumCard player={third} />
            </div>
          </div>

          {/* Table header */}
          <div className="grid grid-cols-[80px_minmax(0,1fr)_auto_auto] gap-3 px-5 sm:px-6 pb-3 text-[11px] tracking-eyebrow uppercase text-cream/45 font-mono">
            <span>Rank</span>
            <span>Player</span>
            <span className="text-right">Wagered</span>
            <span className="w-24 text-right">Prize</span>
          </div>

          {/* Table (4–20) — zebra, hover lift, gap-to-climb */}
          <div className="border-t border-gold/15">
            {list.map((p, idx) => {
              // idx in `list` maps to overall players index idx + 3.
              const overallIndex = idx + 3;
              const climb = gapToClimb(data.players, overallIndex);
              const d = deltaInfo(p);
              return (
                <div
                  key={p.id}
                  className={`group grid grid-cols-[80px_minmax(0,1fr)_auto_auto] gap-3 items-center px-5 sm:px-6 py-4 border-b border-gold/8 transition-colors ${
                    idx % 2 === 0 ? 'bg-gold/[0.022]' : ''
                  } hover:bg-gold/[0.07]`}
                >
                  <span className="flex items-center gap-2 font-serif-luxe font-bold text-xl text-gold">
                    {p.position}
                    <span className={`text-[9px] ${d.cls}`} aria-hidden="true">
                      {d.glyph}
                    </span>
                  </span>
                  <span className="min-w-0 truncate text-base text-cream">
                    {p.maskedUsername}
                    {climb > 0 && (
                      <span className="ml-2.5 text-[11px] text-gold opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        +{formatUSD(climb)} to climb
                      </span>
                    )}
                  </span>
                  <span className="text-right text-base sm:text-lg font-semibold tabular-nums text-cream">
                    {formatUSD(p.wagered)}
                  </span>
                  <span className="w-24 text-right text-base font-semibold tabular-nums text-gold">
                    {p.prize > 0 ? formatUSD(p.prize) : '—'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Last-updated */}
          <div className="px-4 sm:px-6 py-4 border-t border-gold/15 text-center text-[10px] tracking-eyebrow-md uppercase font-mono text-cream/40 tabular-nums">
            Standings updated {freshness(now, data.lastUpdatedAt)}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Lint**

Run: `npx eslint src/components/Leaderboard/themes/CasinoTheme.js`
Expected: no errors.

- [ ] **Step 3: Run leaderboard tests**

Run: `npm test -- --watchAll=false --testPathPattern=Leaderboard`
Expected: PASS (`data-theme="casino"` still rendered for the `?theme=casino` test).

- [ ] **Step 4: VERIFY IN APP — pause for user review**

`npm start` → `http://localhost:3000/gamba/leaderboard?theme=casino`.
Confirm: NO emoji medals — engraved gold seals with embossed numerals + a crown over 1st; serif (Cormorant) title with shimmering gold-foil prize amount; guilloché texture + double-frame plaque; engraved countdown tiles; zebra-striped table; hover a row → `+$X to climb` in gold; 1st-place wager counts up. **Stop for user eyeball.**

- [ ] **Step 5: Commit (after approval)**

```bash
git add src/components/Leaderboard/themes/CasinoTheme.js
git commit -m "feat: upgrade casino theme to hifi gold engraved-seal look"
```

---

## Task 7: Minimal — Space Grotesk + cool-blue accent + layered surfaces + count-up + gap

Full rebuild of `MinimalTheme.js`: Space Grotesk throughout, a single cool-blue accent used sparingly (leader card border/glow/top-bar, accent wager, accent code pill, accent gap callout), layered card surfaces with long shadows, countdown with vertical-rule separators, all-20 table with hover gap slide-in, leader count-up. Stays motion-free otherwise.

**Files:**
- Modify: `src/components/Leaderboard/themes/MinimalTheme.js` (full replace)

- [ ] **Step 1: Replace `MinimalTheme.js`**

`src/components/Leaderboard/themes/MinimalTheme.js` (full file):

```jsx
import { useCountdown } from '../../../hooks/useCountdown';
import { formatUSD, formatPosition, formatPrizeHeadline } from '../format';
import { gapToClimb } from '../gap';
import useCountUp from '../useCountUp';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function freshness(now, lastUpdatedAt) {
  const ms = Math.max(0, now - lastUpdatedAt);
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  return `${Math.floor(ms / 3_600_000)}h ago`;
}

function deltaInfo(player) {
  const d = (player.previousPosition || player.position) - player.position;
  if (d > 0) return { glyph: '▲', cls: 'text-emerald-bright' };
  if (d < 0) return { glyph: '▼', cls: 'text-red-destructive' };
  return { glyph: '–', cls: 'text-white/25' };
}

// Sleek premium-fintech: clean with depth (layered surfaces, soft shadows, one
// confident cool-blue accent used sparingly). Renders the full info contract.
// No ambient motion — restraint is the point (only the leader count-up moves).
export default function MinimalTheme({ data, now }) {
  const remaining = useCountdown(data.endsAt);
  const [first, second, third] = data.players;
  const top3 = [first, second, third].filter(Boolean);
  const players = data.players.slice(0, 20);
  const labels = ['1st', '2nd', '3rd'];
  const animatedWagered = useCountUp(first ? first.wagered : 0, {
    durationMs: 1500,
    delayMs: 200,
  });

  return (
    <div data-theme="minimal" className="font-grotesk text-white-body">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5 px-5 sm:px-8 py-7 border-b border-white/8">
        <div>
          <div className="text-[12px] tracking-eyebrow-md text-white/30 uppercase mb-3">
            {data.periodLabel}
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight leading-none">
            <span className="text-white-body">{formatPrizeHeadline(data.prizePool)}</span>{' '}
            <span className="font-medium text-white/50">Leaderboard</span>
          </h2>
          <div className="mt-4 text-sm text-white/50">
            Play on <span className="font-semibold text-white-body">{data.brand}</span> with code{' '}
            <span className="font-semibold text-mn-acc bg-mn-acc/[0.14] px-2.5 py-0.5 rounded-md">
              {data.referralCode}
            </span>
          </div>
        </div>

        {/* Countdown — large tabular numerals + vertical rules */}
        <div className="text-left sm:text-right">
          {remaining.isOver ? (
            <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-white/70">
              Leaderboard over
            </div>
          ) : (
            <>
              <div className="text-[11px] tracking-eyebrow text-white/30 uppercase mb-3">
                Ends in
              </div>
              <div className="flex items-start gap-4 sm:gap-5">
                {[
                  ['Days', remaining.days],
                  ['Hours', remaining.hours],
                  ['Min', remaining.minutes],
                  ['Sec', remaining.seconds],
                ].map(([label, value], i) => (
                  <div
                    key={label}
                    className={`flex flex-col items-center ${
                      i > 0 ? 'pl-4 sm:pl-5 border-l border-white/8' : ''
                    }`}
                  >
                    <span className="text-4xl sm:text-5xl font-semibold tabular-nums leading-none tracking-tight">
                      {pad2(value)}
                    </span>
                    <span className="mt-2 text-[10px] tracking-eyebrow text-white/30 uppercase">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Top 3 cards */}
      {top3.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 px-5 sm:px-8 py-7">
          {top3.map((p, i) => {
            const lead = i === 0;
            const wag = lead ? animatedWagered : p.wagered;
            return (
              <div
                key={p.id}
                className={`group relative rounded-2xl p-5 sm:p-6 border transition-transform duration-200 motion-safe:hover:-translate-y-[3px] ${
                  lead ? 'border-mn-acc/40' : 'border-white/8'
                }`}
                style={{
                  background:
                    'linear-gradient(180deg, #16161a, #101013)',
                  boxShadow: lead
                    ? 'inset 0 1px 0 rgba(255,255,255,0.04), 0 0 0 1px rgba(143,179,255,0.18), 0 20px 50px -24px rgba(91,128,216,0.6)'
                    : 'inset 0 1px 0 rgba(255,255,255,0.03), 0 12px 30px -18px rgba(0,0,0,0.8)',
                }}
              >
                {lead && (
                  <span
                    aria-hidden="true"
                    className="absolute left-6 right-6 top-0 h-0.5 rounded"
                    style={{
                      background:
                        'linear-gradient(90deg, #8fb3ff, transparent)',
                    }}
                  />
                )}
                <div className="flex items-center justify-between mb-4">
                  <span
                    className={`text-[12px] tracking-eyebrow uppercase ${
                      lead ? 'text-mn-acc' : 'text-white/30'
                    }`}
                  >
                    {labels[i]} place
                  </span>
                  <span className="text-[11px] font-semibold text-white/40 border border-white/8 rounded-full px-2.5 py-0.5">
                    {formatPosition(p.position)}
                  </span>
                </div>
                <div className="text-xl font-semibold truncate">{p.maskedUsername}</div>
                <div
                  className={`mt-3.5 text-2xl sm:text-[32px] font-bold tabular-nums tracking-tight leading-none ${
                    lead ? 'text-mn-acc' : 'text-white-body'
                  }`}
                >
                  {formatUSD(wag)}
                </div>
                <div className="mt-1.5 text-sm text-white/45">{formatUSD(p.prize)} prize</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table header */}
      <div className="grid grid-cols-[64px_minmax(0,1fr)_auto_auto] gap-4 px-5 sm:px-8 pb-3.5 text-[11px] tracking-eyebrow text-white/30 uppercase">
        <span>#</span>
        <span>Player</span>
        <span className="text-right">Wagered</span>
        <span className="w-24 text-right">Prize</span>
      </div>

      {/* Table (all 20) */}
      <div className="rounded-2xl border border-white/8 overflow-hidden bg-surf" style={{ background: '#101013' }}>
        {players.map((p, i) => {
          const climb = gapToClimb(data.players, i);
          const d = deltaInfo(p);
          return (
            <div
              key={p.id}
              className="group grid grid-cols-[64px_minmax(0,1fr)_auto_auto] gap-4 items-center px-5 sm:px-8 py-4 border-b border-white/8 last:border-b-0 transition-colors hover:bg-white/[0.03]"
            >
              <span className="flex items-center gap-2 text-sm font-semibold tabular-nums text-white/35">
                {formatPosition(p.position)}
                <span className={`text-[8px] ${d.cls}`} aria-hidden="true">
                  {d.glyph}
                </span>
              </span>
              <span className="min-w-0 flex items-center text-base font-medium">
                <span className="truncate">{p.maskedUsername}</span>
                {climb > 0 && (
                  <span className="ml-3 whitespace-nowrap text-[11px] text-mn-acc opacity-0 -translate-x-1.5 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0">
                    +{formatUSD(climb)} to climb
                  </span>
                )}
              </span>
              <span className="text-right text-base sm:text-lg font-semibold tabular-nums">
                {formatUSD(p.wagered)}
              </span>
              <span className="w-24 text-right text-sm font-medium tabular-nums text-white/45">
                {p.prize > 0 ? formatUSD(p.prize) : '—'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Last-updated */}
      <div className="px-5 sm:px-8 py-4 text-xs text-white/35 tabular-nums">
        Updated {freshness(now, data.lastUpdatedAt)}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Lint**

Run: `npx eslint src/components/Leaderboard/themes/MinimalTheme.js`
Expected: no errors.

- [ ] **Step 3: Run leaderboard tests**

Run: `npm test -- --watchAll=false --testPathPattern=Leaderboard`
Expected: PASS (`data-theme="minimal"` present).

- [ ] **Step 4: VERIFY IN APP — pause for user review**

`npm start` → `?theme=minimal`.
Confirm: Space Grotesk type; one cool-blue accent only on the leader card (border + glow + top bar + wager number), the code pill, and the hover gap; layered card surfaces with soft long shadows; countdown numerals separated by thin vertical rules; hover a row → `+$X to climb` slides in (blue); leader wager counts up; otherwise calm/no ambient motion. Reduced-motion: count-up instant, hover-lift disabled. **Stop for user eyeball.**

- [ ] **Step 5: Commit (after approval)**

```bash
git add src/components/Leaderboard/themes/MinimalTheme.js
git commit -m "feat: upgrade minimal theme to hifi layered cool-blue look"
```

---

## Task 8: Neon — synthwave pink/cyan, CSS grid horizon, count-up, gap (+ remove shader)

Full rebuild of `NeonTheme.js` to the Miami-sunset synthwave look using pure CSS (no WebGL): sunset disc, 3D grid horizon, light streaks, faint scanline, glass card, Orbitron gradient title with flicker, pink-bordered countdown tiles, pink→violet→cyan bars, gap-to-climb hover, leader count-up. Reworks `NeonPodium.js` to pink/cyan with a gradient-border #1 card. Deletes `NeonShaderBackground.js`.

**Files:**
- Modify: `src/components/Leaderboard/themes/NeonTheme.js` (full replace)
- Modify: `src/components/Leaderboard/themes/NeonPodium.js` (full replace)
- Delete: `src/components/Leaderboard/themes/NeonShaderBackground.js`

- [ ] **Step 1: Replace `NeonPodium.js`**

`src/components/Leaderboard/themes/NeonPodium.js` (full file):

```jsx
import { formatUSD, formatPosition } from '../format';

// Top-3 cards for the Neon theme — synthwave pink/cyan glass. Order 2nd · 1st ·
// 3rd; 1st is taller with a gradient pink→cyan border (mask technique) and a
// stronger glow. Carries real top-3 data + an optional animated wager for 1st.
const RANKS = {
  1: { label: '1ST', order: 'sm:order-2' },
  2: { label: '2ND', order: 'sm:order-1' },
  3: { label: '3RD', order: 'sm:order-3' },
};

function PodiumCard({ player, animatedWagered }) {
  if (!player) return null;
  const cfg = RANKS[player.position] || { label: formatPosition(player.position), order: '' };
  const first = player.position === 1;
  const wag = first && animatedWagered != null ? animatedWagered : player.wagered;

  return (
    <div
      className={`relative rounded-2xl overflow-hidden ${cfg.order} ${
        first ? 'p-7 sm:-translate-y-2' : 'p-5'
      }`}
      style={{
        border: first ? '1px solid #ff2d95' : '1px solid rgba(177,77,255,0.4)',
        background: first
          ? 'linear-gradient(165deg, rgba(120,30,110,0.55), rgba(30,10,60,0.5))'
          : 'linear-gradient(165deg, rgba(60,20,90,0.5), rgba(20,8,48,0.4))',
        boxShadow: first
          ? '0 0 46px rgba(255,45,149,0.35), inset 0 0 30px rgba(255,45,149,0.12)'
          : '0 10px 40px -18px rgba(122,61,255,0.7)',
      }}
    >
      {/* Gradient pink→cyan border on 1st (mask technique) */}
      {first && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-80"
          style={{
            padding: '1px',
            background: 'linear-gradient(120deg, #ff2d95, #21e6ff)',
            WebkitMask:
              'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
          }}
        />
      )}

      <div className="relative flex items-center justify-between mb-3.5">
        <span
          className={`font-orbitron font-extrabold text-2xl sm:text-3xl tracking-wide ${
            first ? '' : 'text-white-body'
          }`}
          style={
            first
              ? {
                  backgroundImage: 'linear-gradient(90deg, #ff7ac4, #8af6ff)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                }
              : { textShadow: '0 0 14px rgba(255,122,196,0.7)' }
          }
        >
          {cfg.label}
        </span>
        <span
          className="text-[12px] tracking-eyebrow text-nn-cyan"
          style={{ textShadow: '0 0 8px rgba(33,230,255,0.5)' }}
        >
          {formatPosition(player.position)}
        </span>
      </div>

      <div className="relative font-orbitron font-bold text-base sm:text-lg tracking-wide text-white truncate">
        {player.maskedUsername}
      </div>
      <div
        className="relative mt-1.5 text-2xl sm:text-[36px] font-bold tabular-nums text-nn-cyan-lite leading-none"
        style={{ textShadow: '0 0 14px rgba(33,230,255,0.5)' }}
      >
        {formatUSD(wag)}
      </div>

      <div className="relative flex items-center justify-between mt-4 pt-3 border-t border-nn-purple/25 text-[13px] tracking-eyebrow-sm uppercase text-white/55">
        <span>Prize</span>
        <span
          className="text-nn-pink-lite font-bold"
          style={{ textShadow: '0 0 10px rgba(255,45,149,0.5)' }}
        >
          {formatUSD(player.prize)}
        </span>
      </div>
    </div>
  );
}

export default function NeonPodium({ players, animatedWagered }) {
  const [first, second, third] = players;
  if (!first) return null;

  return (
    <div className="relative grid grid-cols-1 sm:grid-cols-[1fr_1.12fr_1fr] gap-4 items-end px-4 sm:px-6 py-8 border-b border-nn-purple/25">
      <PodiumCard player={first} animatedWagered={animatedWagered} />
      <PodiumCard player={second} />
      <PodiumCard player={third} />
    </div>
  );
}
```

- [ ] **Step 2: Replace `NeonTheme.js`**

`src/components/Leaderboard/themes/NeonTheme.js` (full file):

```jsx
import { useEffect, useState } from 'react';
import { useCountdown } from '../../../hooks/useCountdown';
import { formatUSD, formatPosition, formatPrizeHeadline } from '../format';
import { gapToClimb } from '../gap';
import useCountUp from '../useCountUp';
import NeonPodium from './NeonPodium';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function freshness(now, lastUpdatedAt) {
  const ms = Math.max(0, now - lastUpdatedAt);
  if (ms < 60_000) return `${Math.floor(ms / 1000)}S AGO`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}M AGO`;
  return `${Math.floor(ms / 3_600_000)}H AGO`;
}

function deltaInfo(player) {
  const d = (player.previousPosition || player.position) - player.position;
  if (d > 0) return { glyph: '▲', cls: 'text-nn-cyan' };
  if (d < 0) return { glyph: '▼', cls: 'text-nn-pink-lite' };
  return { glyph: '–', cls: 'text-white/30' };
}

const STREAKS = [
  { left: '12%', dur: '5.5s', delay: '0s' },
  { left: '48%', dur: '7s', delay: '2s' },
  { left: '78%', dur: '6s', delay: '4s' },
];

// Synthwave / Miami-sunset nightlife. Pure-CSS signature elements (sunset disc,
// 3D grid horizon, light streaks) — no WebGL. Renders the full info contract.
// Motion is the theme; all ambient motion gates on motion-reduce.
export default function NeonTheme({ data, now }) {
  const remaining = useCountdown(data.endsAt);
  const players = data.players.slice(0, 20);
  const rest = players.slice(3);
  const leaderWagered = players[0] ? players[0].wagered : 0;
  const animatedWagered = useCountUp(leaderWagered, { durationMs: 1500, delayMs: 200 });

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      data-theme="neon"
      className="relative overflow-hidden font-rajdhani text-white-body rounded-2xl"
      style={{
        background:
          'radial-gradient(80% 50% at 50% 8%, rgba(255,45,149,0.18), transparent 60%), radial-gradient(70% 60% at 50% 20%, rgba(122,61,255,0.18), transparent 60%), linear-gradient(180deg, #0a0420 0%, #120636 45%, #1a0a3e 70%, #2a0f4a 100%)',
      }}
    >
      <style>{`
        @keyframes nn-streak {
          0% { transform: translate(0, -200px) rotate(35deg); opacity: 0; }
          10% { opacity: 0.6; }
          100% { transform: translate(60vw, 110vh) rotate(35deg); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .nn-streak, .nn-grid-plane { animation: none !important; }
        }
      `}</style>

      {/* Sunset disc */}
      <div
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 z-0"
        aria-hidden="true"
        style={{
          top: '-90px',
          width: '560px',
          height: '560px',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(255,138,61,0.2), rgba(255,45,149,0.12) 45%, transparent 68%)',
          filter: 'blur(8px)',
        }}
      />

      {/* Grid horizon */}
      <div
        className="pointer-events-none absolute bottom-0 z-0 overflow-hidden"
        aria-hidden="true"
        style={{
          left: '-20%',
          right: '-20%',
          height: '42%',
          perspective: '340px',
          perspectiveOrigin: '50% 0%',
          opacity: 0.6,
          WebkitMaskImage: 'linear-gradient(180deg, transparent, #000 35%)',
          maskImage: 'linear-gradient(180deg, transparent, #000 35%)',
        }}
      >
        <div
          className="nn-grid-plane absolute inset-0 motion-safe:animate-nn-grid"
          style={{
            top: '-50%',
            transform: 'rotateX(72deg)',
            transformOrigin: '50% 0',
            backgroundImage:
              'linear-gradient(90deg, rgba(33,230,255,0.5) 1px, transparent 1px), linear-gradient(0deg, rgba(255,45,149,0.5) 1px, transparent 1px)',
            backgroundSize: '46px 46px',
          }}
        />
      </div>

      {/* Light streaks */}
      {STREAKS.map((s, i) => (
        <span
          key={i}
          className="nn-streak pointer-events-none absolute z-[1] motion-reduce:hidden"
          aria-hidden="true"
          style={{
            left: s.left,
            width: '2px',
            height: '160px',
            borderRadius: '2px',
            background: 'linear-gradient(180deg, transparent, #21e6ff, transparent)',
            filter: 'blur(0.5px)',
            opacity: 0.5,
            animationName: 'nn-streak',
            animationTimingFunction: 'linear',
            animationIterationCount: 'infinite',
            animationDuration: s.dur,
            animationDelay: s.delay,
          }}
        />
      ))}

      {/* Faint scanline */}
      <div
        className="pointer-events-none absolute inset-0 z-[2] opacity-40 motion-reduce:hidden"
        aria-hidden="true"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent 0 2px, rgba(10,4,32,0.4) 3px, transparent 4px)',
        }}
      />

      {/* Glass card */}
      <div
        className="relative z-[5] rounded-2xl border border-nn-purple/25"
        style={{
          background:
            'linear-gradient(180deg, rgba(20,8,48,0.55), rgba(10,4,32,0.35))',
          boxShadow:
            '0 0 60px rgba(122,61,255,0.18), inset 0 1px 0 rgba(177,77,255,0.18)',
          backdropFilter: 'blur(2px)',
        }}
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-6 border-b border-nn-purple/25 text-center">
          <div
            className="text-[13px] tracking-eyebrow-lg text-nn-cyan-lite"
            style={{ textShadow: '0 0 12px rgba(33,230,255,0.6)' }}
          >
            {data.periodLabel}
          </div>
          <h2
            className="mt-1.5 font-orbitron font-extrabold text-4xl sm:text-6xl leading-none tracking-wide motion-safe:animate-nn-flicker"
            style={{
              backgroundImage: 'linear-gradient(180deg, #fff 0%, #ff7ac4 60%, #ff2d95 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              filter:
                'drop-shadow(0 0 18px rgba(255,45,149,0.65)) drop-shadow(0 0 4px rgba(255,255,255,0.5))',
            }}
          >
            {formatPrizeHeadline(data.prizePool)} LEADERBOARD
          </h2>
          <div className="mt-2 text-[15px] tracking-eyebrow-md text-white/55 uppercase">
            Code{' '}
            <span className="text-nn-cyan" style={{ textShadow: '0 0 10px rgba(33,230,255,0.6)' }}>
              {data.referralCode}
            </span>{' '}
            on{' '}
            <span className="text-nn-cyan" style={{ textShadow: '0 0 10px rgba(33,230,255,0.6)' }}>
              {data.brand}
            </span>
          </div>

          {/* Countdown — neon tiles */}
          {remaining.isOver ? (
            <div
              className="mt-6 font-orbitron font-extrabold text-3xl sm:text-4xl uppercase text-nn-pink"
              style={{ textShadow: '0 0 16px rgba(255,45,149,0.8)' }}
            >
              LEADERBOARD OVER
            </div>
          ) : (
            <div className="mt-6 flex justify-center gap-3">
              {[
                ['Days', remaining.days],
                ['Hrs', remaining.hours],
                ['Min', remaining.minutes],
                ['Sec', remaining.seconds],
              ].map(([label, value]) => (
                <div key={label} className="text-center">
                  <div
                    className="min-w-14 sm:min-w-20 py-2.5 rounded-xl border font-orbitron font-bold text-2xl sm:text-4xl tabular-nums text-nn-pink-lite"
                    style={{
                      borderColor: 'rgba(255,45,149,0.5)',
                      background:
                        'linear-gradient(180deg, rgba(40,12,70,0.7), rgba(16,6,40,0.7))',
                      boxShadow:
                        '0 0 18px rgba(255,45,149,0.3), inset 0 0 14px rgba(177,77,255,0.18)',
                      textShadow: '0 0 12px rgba(255,45,149,0.7)',
                    }}
                  >
                    {pad2(value)}
                  </div>
                  <div className="mt-2 text-[11px] tracking-eyebrow-md text-white/35 uppercase">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Podium */}
        <NeonPodium players={players} animatedWagered={animatedWagered} />

        {/* Table header */}
        <div className="grid grid-cols-[74px_minmax(0,1fr)_auto_auto] gap-4 px-4 sm:px-6 pt-4 pb-2 text-[11px] tracking-eyebrow uppercase text-white/30">
          <span>Pos</span>
          <span>Player</span>
          <span className="text-right">Wagered</span>
          <span className="w-24 text-right">Prize</span>
        </div>

        {/* Table (4–20) — gradient bars + gap-to-climb */}
        <div className="relative">
          {rest.map((p, idx) => {
            const overallIndex = idx + 3;
            const climb = gapToClimb(data.players, overallIndex);
            const d = deltaInfo(p);
            const pct =
              leaderWagered > 0
                ? Math.max(7, Math.min(100, (p.wagered / leaderWagered) * 100))
                : 0;
            return (
              <div
                key={p.id}
                className="group grid grid-cols-[74px_minmax(0,1fr)_auto_auto] gap-4 items-center px-4 sm:px-6 py-3 border-t border-nn-purple/15 relative transition-colors hover:bg-nn-purple/[0.08]"
              >
                <span className="flex items-center gap-2 font-orbitron font-bold text-sm text-nn-pink-lite">
                  {formatPosition(p.position)}
                  <span className={`text-[8px] ${d.cls}`} aria-hidden="true">
                    {d.glyph}
                  </span>
                </span>

                <div className="min-w-0">
                  <div className="truncate text-base font-semibold text-white">{p.maskedUsername}</div>
                  <div className="mt-1.5 h-1.5 rounded bg-nn-purple/10 overflow-hidden">
                    <div
                      className="h-full rounded transition-[width] duration-700 ease-out motion-reduce:transition-none motion-reduce:duration-0"
                      style={{
                        width: mounted ? `${pct}%` : '0%',
                        transitionDelay: `${idx * 60}ms`,
                        background: 'linear-gradient(90deg, #ff2d95, #7a3dff 55%, #21e6ff)',
                        boxShadow: '0 0 12px rgba(255,45,149,0.6)',
                      }}
                    />
                  </div>
                  {climb > 0 && (
                    <div className="pointer-events-none absolute left-[90px] -bottom-0.5 hidden sm:block text-[11px] text-nn-cyan opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                      +{formatUSD(climb)} to climb
                    </div>
                  )}
                </div>

                <span className="text-right text-base font-bold tabular-nums text-white">
                  {formatUSD(p.wagered)}
                </span>
                <span
                  className="w-24 text-right text-sm font-bold tabular-nums text-nn-pink-lite"
                  style={{ textShadow: '0 0 8px rgba(255,45,149,0.4)' }}
                >
                  {p.prize > 0 ? formatUSD(p.prize) : '—'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Last-updated */}
        <div className="px-4 sm:px-6 py-4 border-t border-nn-purple/25 text-center text-[11px] tracking-eyebrow-md uppercase text-white/40 tabular-nums">
          Signal updated {freshness(now, data.lastUpdatedAt)}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Delete the obsolete shader**

Run:

```bash
git rm src/components/Leaderboard/themes/NeonShaderBackground.js
```

Expected: file staged for deletion. (Confirmed safe: only `NeonTheme.js` imported it, and the new `NeonTheme.js` no longer does. `three` stays installed for `TVStaticIntro.js`.)

- [ ] **Step 4: Lint**

Run: `npx eslint src/components/Leaderboard/themes/NeonTheme.js src/components/Leaderboard/themes/NeonPodium.js`
Expected: no errors (no unused `NeonShaderBackground` import remains).

- [ ] **Step 5: Run leaderboard tests**

Run: `npm test -- --watchAll=false --testPathPattern=Leaderboard`
Expected: PASS (`data-theme="neon"` present).

- [ ] **Step 6: VERIFY IN APP — pause for user review**

`npm start` → `?theme=neon`.
Confirm: pink/cyan synthwave; a sunset disc behind the title; a 3D grid horizon scrolling toward the viewer at the bottom; drifting cyan light streaks; Orbitron gradient title with occasional flicker; pink-bordered glowing countdown tiles; podium with a gradient pink→cyan border on the #1 card; ranked bars are pink→violet→cyan and fill on mount; hover a row → `+$X to climb` in cyan; leader wager counts up. Reduced-motion: grid/streaks/flicker stop, glow + static grid remain, count-up instant, bars at full width. **Stop for user eyeball.**

- [ ] **Step 7: Commit (after approval)**

```bash
git add src/components/Leaderboard/themes/NeonTheme.js src/components/Leaderboard/themes/NeonPodium.js src/components/Leaderboard/themes/NeonShaderBackground.js
git commit -m "feat: upgrade neon theme to hifi synthwave grid-horizon look"
```

---

## Task 9: Full sweep + production build

- [ ] **Step 1: Run the entire test suite**

Run: `npm test -- --watchAll=false`
Expected: all pre-existing leaderboard suites pass (registry, Leaderboard resolution, ThemeSwitcher, data-layer) plus the two new ones (`useCountUp`, `gap`). No regressions.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: compiles successfully. The ESLint `react-app` preset runs here — no new errors (pre-existing warnings acceptable). Confirms fonts, new Tailwind tokens, and all four themes build for production.

- [ ] **Step 3: Final all-theme spot check (optional but recommended)**

`npm start`, click through all four chips, reload on each `?theme=`, toggle reduced-motion once more. Confirm switching is instant and no console errors.

- [ ] **Step 4: No commit (verification only).**

---

## Self-Review Notes

- **Spec coverage:** fonts (Task 1), tokens/keyframes (Task 2), `useCountUp` (Task 3), gap-to-climb (Task 4 + wired in Tasks 5–8), Broadcast phosphor+CRT+chromatic+count-up+gap (Task 5), Casino seals/crown/foil/guilloché/zebra/count-up/gap (Task 6), Minimal Space-Grotesk/accent/layered/count-up/gap (Task 7), Neon synthwave/grid-horizon/gradient-border/bars/count-up/gap + shader removal (Task 8), full sweep + build (Task 9). All 7 info-contract facts remain in every rebuilt theme (period, prize headline, code+brand, countdown w/ isOver, top-3, full list, last-updated). Reduced-motion handled per theme.
- **Type/contract consistency:** every theme stays `({ data, now })`; `data-theme` markers preserved (resolution tests unaffected); `useCountUp(target, { durationMs, delayMs })` signature identical across all call sites; `gapToClimb(players, index)` identical across all call sites; `NeonPodium` gains an `animatedWagered` prop (additive, optional).
- **No placeholders:** every code step contains full file or full edit content; the only find/replace instruction (Task 5 Step 3c `emerald-signal → phosphor`) is explicit and scoped to one broadcast-only file.
- **Removal safety:** `NeonShaderBackground.js` deletion is gated on the new `NeonTheme.js` (Task 8 Step 2) no longer importing it; `three` retained (grep-confirmed used by `TVStaticIntro.js`).
```
