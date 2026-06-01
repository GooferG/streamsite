# Leaderboard Themes — HiFi Visual Upgrade — Design

**Date:** 2026-06-01
**Status:** Approved (pending spec review)
**Area:** `src/components/Leaderboard/themes/`, fonts, `tailwind.config.js`
**Branch:** `feat/leaderboard-themes`

## Problem / Goal

The four leaderboard themes (`broadcast`, `casino`, `minimal`, `neon`) are
functional and on-register but are a low-fidelity pass. A new **hifi design
handoff** (HTML + in-browser React prototypes, see `README.md` in the handoff
bundle) defines pixel-level looks for all four: final palettes, fonts, spacing,
motion timing, and two cross-theme features the current build lacks.

Goal: **bring the existing themes up to the handoff's hifi spec** while keeping
the established architecture untouched. The handoff's CSS values are the source
of truth for *look*; the existing `useLeaderboardData` feed stays the source of
truth for *content*.

## Non-negotiable constraints (do not change)

The prior feature ([2026-05-31 theme rotation](./2026-05-31-leaderboard-theme-rotation-design.md))
established an architecture that this upgrade preserves verbatim:

- **Theme prop contract** — every theme is `export default function XTheme({ data, now })`.
- **Registry** (`themes/index.js`), **URL `?theme=`** persistence, **ThemeSwitcher**
  chrome, **`DEFAULT_THEME_ID = 'broadcast'`** — all unchanged.
- **Information contract (7 facts)** — every theme still renders all seven:
  prize headline, period/title, referral code + brand, countdown, top-3
  highlight, full ranked list, last-updated freshness. Presentation changes;
  inclusion does not.
- **Demo disclaimer** in `Leaderboard.js` — unchanged.
- **Data layer** (`useLeaderboardData`, `mockData`, `format`, `useCountdown`,
  `useNow`) — **untouched**. `endsAt` / `isOver` / prize table / masking all stay.
- **Reduced-motion** — every new effect gates on `motion-safe:`/`motion-reduce:`
  or `prefers-reduced-motion`; reduced-motion users get a static but complete view.
- **`data-theme="<id>"`** root marker on each theme (test assertions depend on it).

### Do NOT port from the handoff

Per the handoff README: the prototype's `core.jsx` mock data and `App.jsx`
switcher exist only to make the demo standalone. **Neither is ported.** We bind
the handoff visuals to the existing `data` props. The handoff's masked names
(`NI****M`), `$120K` pool, `MAY 2026`, and code `BEAN`/`RAINBET` already match
the existing feed's shape (same $120K prize split, same `LEADERBOARD` constant),
so the content is already correct — only presentation changes.

## Scope

**In scope**

- Two new shared helpers (see Shared Additions): `useCountUp` hook + an inline
  `gap-to-climb` derivation.
- Self-hosted fonts via `@fontsource`: Cormorant Garamond, Space Grotesk,
  Orbitron, Rajdhani (Anton + mono already present).
- New additive Tailwind color tokens + keyframes/animations per theme.
- Full hifi rebuild of all four theme components to the handoff look.
- Removal of `NeonShaderBackground.js` (replaced by pure-CSS grid horizon).

**Out of scope (YAGNI)**

- Any data-layer / switching / routing change.
- Removing the `three` dependency (still used by `TVStaticIntro.js`).
- New themes beyond the four.
- Porting the handoff's count-down *duration-from-load* model — the existing
  fixed-`endsAt` + `isOver` model is kept (it's better: a real deadline, not a
  per-load timer).
- Animating *all* totals on count-up — only the leader animates (handoff says
  "prototype only animates the leader to keep it tasteful").

## Shared Additions

### `useCountUp` hook — `src/components/Leaderboard/useCountUp.js` (NEW)

```js
// Ramps a number from a start value to `target` with easeOutCubic.
// First mount ramps 0 → target; later target changes ramp prevValue → target
// (so the 45s live-poll re-render reads as a tick-up, not a re-sweep from 0).
// Under prefers-reduced-motion, returns target immediately (no animation).
export default function useCountUp(target, { durationMs = 1500, delayMs = 200 } = {}) { ... }
```

- easeOutCubic: `1 - (1 - p)^3`, matches handoff `core.jsx`.
- Uses `requestAnimationFrame`; cleans up on unmount / target change.
- Reduced-motion: read `window.matchMedia('(prefers-reduced-motion: reduce)')`
  once; if reduced, `setVal(target)` and skip the rAF loop.
- A `prevRef` holds the last settled value so re-runs start from `prev`, not 0.
- **Only the leader's wager total uses this** (one call per theme).

### Gap-to-climb — inline derivation (NO data-layer change)

`data.players` is already sorted descending by `wagered`. For a row at index
`i > 0`, the gap to the player above is `players[i-1].wagered - players[i].wagered`.
Computed inline in each theme's row map (or a tiny local helper). Rendered as a
hover-revealed callout:

- Broadcast / Neon / Casino: `+$X TO P0N` (uppercase, where `P0N` =
  `formatPosition(position - 1)`).
- Minimal: `+$X to climb` (sentence case, slides in on hover).
- Rank 1: no callout.

Reuses `formatUSD`. The callout is hover-only (`group-hover` / row `:hover`),
hidden under the responsive breakpoint that drops the Prize column (matches
handoff: gap hidden on narrow).

## Fonts & Tailwind tokens

### Fonts — self-hosted via `@fontsource`

Add deps and import in `src/index.js` (CRA entry, matches how the app loads
global CSS):

```
@fontsource/cormorant-garamond  (500,600,700)
@fontsource/space-grotesk       (400,500,600,700)
@fontsource/orbitron            (500,700,800,900)
@fontsource/rajdhani            (400,500,600,700)
```

`tailwind.config.js` `fontFamily` additions (existing `mono`, `display` stay):

```js
'serif-luxe': ['"Cormorant Garamond"', 'Georgia', 'serif'],   // Casino
'grotesk':    ['"Space Grotesk"', 'system-ui', 'sans-serif'], // Minimal
'orbitron':   ['Orbitron', 'sans-serif'],                     // Neon display
'rajdhani':   ['Rajdhani', 'sans-serif'],                     // Neon UI
```

### Tailwind color tokens — additive (existing tokens untouched)

```js
// Broadcast (phosphor CRT)
'phosphor': '#1ff39a', 'phosphor-dim': '#0e7d54',
'crt-amber': '#ffb24d', 'crt-cyan': '#46e6ff',
// Casino (gold)
'gold-lite': '#f8e7b0', 'gold': '#e7c267', 'gold-deep': '#a9812f',
'gold-edge': '#6f5520', 'cream': '#f4ecd8',
// Minimal (cool-blue accent)
'mn-acc': '#8fb3ff', 'mn-acc-deep': '#5b80d8',
// Neon (synthwave)
'nn-pink': '#ff2d95', 'nn-pink-lite': '#ff7ac4',
'nn-cyan': '#21e6ff', 'nn-cyan-lite': '#8af6ff',
'nn-violet': '#7a3dff', 'nn-purple': '#b14dff', 'nn-orange': '#ff8a3d',
```

### Keyframes / animations — additive

```
bc-sweep   (7s linear)         CRT light sweep, top→bottom
bc-flicker (5.5s steps)        whole-frame opacity flicker
cs-foil    (6s linear)         gold-foil background-position shimmer
nn-grid    (1.6s linear)       grid-horizon background-position scroll
nn-streak  (5.5–7s linear)     diagonal light streaks
nn-flicker (6s steps)          neon title flicker
```

Existing `neon-pulse`, `grain`, `glow`, `slow-zoom` are kept (neon-pulse still
used for glow breathing). Each animation is applied via `motion-safe:` so
reduced-motion drops it; the static glow/color stays.

### Inline `<style>` blocks

Effects that don't map cleanly to utilities live in a per-theme inline `<style>`
block (the codebase already does this — see `SponsorBanner.js`): CRT scanline +
vignette + sweep overlays, Casino guilloché crossed gradients + gold-foil
`background-clip:text`, Neon grid-horizon 3D `perspective`/`rotateX` plane +
sunset disc + streaks. Scoped by the theme's `data-theme` / a root class.

## Per-theme design

### Broadcast — `themes/BroadcastTheme.js` (+ shared subcomponents)

Keeps its composition (`BroadcastFrame`, `BroadcastHeader`, `LeaderTakeover`,
`PodiumCard`, `RaceBars`, `RosterTable`, `SponsorBanner`, `TickerCrawl`,
`StationID`). Changes are accenting + CRT layering + the two shared features:

- **Accent swap** emerald → **phosphor `#1ff39a`** across the theme's own
  classes. (Shared subcomponents that hardcode `emerald-signal` — `LeaderTakeover`,
  `RaceBars`, `RosterTable`, `BroadcastHeader` — are updated to phosphor *for the
  broadcast context*. These components are broadcast-only, so this is safe.)
- **CRT overlays** added inside `BroadcastFrame` (it already has the scanline):
  radial **vignette**, a vertical **light sweep** (`bc-sweep` 7s), and a
  whole-frame **flicker** (`bc-flicker` 5.5s). All `motion-safe:`.
- **Corner ticks** — refine the existing corner glyphs toward the handoff's
  hairline L-shaped ticks (keep glyphs if cleaner; visual parity is the bar).
- **Title** (`BroadcastHeader`) — phosphor glow on the prize amount + a faint
  **red chromatic-aberration ghost** (`::after` offset 1.5px, screen blend) via
  inline style.
- **Leader count-up** — `LeaderTakeover`'s TOTAL WAGERED uses `useCountUp`.
- **Gap-to-climb** — `RaceBars` + `RosterTable` rows reveal `+$X TO P0N` on hover
  (they already receive sorted players with positions).

### Casino — `themes/CasinoTheme.js`

- **Remove emoji medals** (`🥇🥈🥉`). Replace with CSS **engraved gold seals**:
  radial-gradient metal disc, dashed inner ring (`::before`), embossed rank
  numeral (text-shadow bevel). 1st place: larger seal + **crown glyph `♔`**
  floating above. (Per handoff: "do not use emoji.")
- **Cormorant Garamond** serif for title, seals, podium names/wagers, countdown
  numerals (`font-serif-luxe`).
- **Animated gold-foil** prize headline — moving gradient through the text via
  `background-clip:text` + `cs-foil` 6s (`motion-safe:`).
- **Guilloché texture** bg (crossed ±45° `repeating-linear-gradient`s, opacity
  ~.5) + **double-framed plaque** (outer border + inner hairline w/ margin).
- **Countdown** — refine existing tiles toward beveled engraved boxes with gold
  top-highlight, inset shadow, center seam. Keep `isOver` → "LEADERBOARD OVER".
- **Podium** — 3-up, order 2nd · 1st · 3rd, 1st centered & elevated. Replaces
  current `PodiumSpot`.
- **Table (4–20)** — zebra striping (`nth-child(odd)` ~`rgba(231,194,103,.022)`),
  hover lift, serif rank numeral + ▲▼ arrow, gap-to-climb hover in gold.
- **Leader count-up** on 1st-place seal card wager.
- Palette → gold tokens; `cream` body text; near-black `#080604`-ish bg via
  existing dark tokens + gold radial glow.

### Minimal — `themes/MinimalTheme.js`

- **Space Grotesk** throughout (`font-grotesk`).
- Introduce the single **cool-blue accent `#8fb3ff` (`mn-acc`)**, used sparingly:
  leader card accent border + glow shadow + accent top-edge bar, accent position
  label, accent wager number; the code pill becomes an accent-tinted pill; the
  gap callout is accent and **slides in** on hover.
- **Layered surfaces** — top-3 cards on a `surf2→surf` gradient with inset
  top-highlight + long shadow; cards lift `translateY(-3px)` on hover
  (`motion-safe:`).
- **Countdown** — large tabular numerals separated by thin vertical rules, unit
  labels beneath (refine existing). Keep `isOver` → "Leaderboard over".
- **Table (all 20)** — rounded bordered list container, row hover = `surf2`,
  small ▲▼ arrows, gap-to-climb hover.
- **Leader count-up** on the lead card wager.
- Stays otherwise **motion-free** (restraint is the theme).

### Neon — `themes/NeonTheme.js` (+ `NeonPodium.js`, − `NeonShaderBackground.js`)

- **Palette shift** purple-gamba → **pink/cyan synthwave** (`nn-*` tokens). Body
  bg: vertical gradient `#0a0420 → #120636 → #1a0a3e → #2a0f4a` + pink/violet
  radial glows.
- **Replace WebGL shader** with the handoff's pure-CSS signature elements
  (lighter, fewer moving parts, matches handoff):
  - **Sunset disc** — large blurred radial (orange→pink→transparent) behind title.
  - **Grid horizon** — fixed bottom band, CSS 3D `perspective` plane `rotateX(72deg)`
    with cyan vertical + pink horizontal gridlines (46px), scrolling toward
    viewer (`nn-grid` 1.6s), masked to fade upward. **Signature element.**
  - **Light streaks** — three thin cyan diagonal streaks drifting (`nn-streak`,
    staggered).
  - Faint **scanline** overlay (keep existing approach).
  - **Delete `NeonShaderBackground.js`** + its import (only NeonTheme uses it;
    `three` stays for `TVStaticIntro`).
- **Glass card** wrapper — translucent purple, neon border, blur, violet glow.
- **Title** — Orbitron 800, white→pink vertical gradient fill + heavy pink glow +
  occasional `nn-flicker` (`motion-safe:`).
- **Countdown** — pink-bordered rounded tiles, inner glow, Orbitron numerals,
  glowing pink. Keep `isOver` state.
- **Podium** (`NeonPodium.js`) — reworked to pink/cyan: 3-up, order 2nd · 1st ·
  3rd, 1st taller with a **gradient pink→cyan border** (mask technique) + stronger
  glow + pink→cyan gradient label text. Cyan wagers, pink prizes.
- **Table (4–20)** — Orbitron pink positions, ▲▼ (up=cyan / down=pink), **gradient
  bar pink→violet→cyan** with pink glow (animate width on mount — keep existing
  mount pattern), gap-to-climb hover in cyan, pink glowing prize.
- **Leader count-up** on 1st-place podium wager.
- Keep `neon-pulse` for glow breathing where the handoff calls for it.

## Data flow (unchanged)

```
useLeaderboardData() ──┐
                       ├─► Leaderboard.js (wrapper, UNCHANGED)
useNow() ──────────────┘        ├─ ?theme= → active theme
                                └─ <ActiveTheme data now /> + disclaimer
```

Each theme additionally calls `useCountUp(leader.wagered)` locally for the leader
total and `useCountdown(data.endsAt)` (already does). No new props.

## Error handling

- All existing guards kept: short/empty `players`, missing optional fields,
  `isOver` state. Themes never throw on missing data.
- `useCountUp(undefined)` guards to `0`. Gap derivation guards `players[i-1]`
  existence (rank 1 → no callout).
- Reduced-motion: count-up returns target instantly; all ambient motion drops.

## Testing

- **Existing tests unchanged** and must keep passing: registry (4), Leaderboard
  resolution (6 incl. each `data-theme`), ThemeSwitcher (5), data-layer suites,
  disclaimer regression. The `data-theme` markers are preserved, so resolution
  tests don't change.
- **New:** `useCountUp` unit test — ramps toward target; returns target
  immediately under mocked reduced-motion; settles at exactly target.
- New theme visuals are reviewed **by eye in the running app** (per repo
  convention — visual fidelity is not asserted). Each theme smoke-renders with
  mock data without throwing (covered by existing resolution tests hitting each
  `?theme=`).
- Run locally: `npm test -- --watchAll=false`. Then `npm run build` for the
  ESLint `react-app` gate + production sanity.

## Sequencing (build order)

Per the verification choice (spec → plan → implement, user reviews each theme
live in the app before commit):

1. Fonts + Tailwind tokens/keyframes (foundation; no visual change yet).
2. `useCountUp` hook + test.
3. **Broadcast** upgrade → user eyeballs → commit.
4. **Casino** upgrade → user eyeballs → commit.
5. **Minimal** upgrade → user eyeballs → commit.
6. **Neon** upgrade (incl. shader removal) → user eyeballs → commit.
7. Full test sweep + `npm run build`.

Each theme is independent and shippable on its own (unknown `?theme=` still falls
back to broadcast; a half-finished later theme can't break an earlier one).

## File inventory

**Create**
- `src/components/Leaderboard/useCountUp.js`
- `src/components/Leaderboard/__tests__/useCountUp.test.js`

**Modify**
- `tailwind.config.js` (fonts, colors, keyframes, animations)
- `src/index.js` (`@fontsource` imports)
- `package.json` (4 `@fontsource` deps)
- `src/components/Leaderboard/themes/BroadcastTheme.js`
- `src/components/Leaderboard/themes/CasinoTheme.js`
- `src/components/Leaderboard/themes/MinimalTheme.js`
- `src/components/Leaderboard/themes/NeonTheme.js`
- `src/components/Leaderboard/themes/NeonPodium.js`
- `src/components/Leaderboard/BroadcastHeader.js` (phosphor + chromatic title)
- `src/components/Leaderboard/BroadcastFrame.js` (vignette/sweep/flicker)
- `src/components/Leaderboard/LeaderTakeover.js` (phosphor + count-up)
- `src/components/Leaderboard/RaceBars.js` (phosphor + gap-to-climb)
- `src/components/Leaderboard/RosterTable.js` (phosphor + gap-to-climb)

**Delete**
- `src/components/Leaderboard/themes/NeonShaderBackground.js`

## Design register note (per PRODUCT.md)

Unchanged from the prior feature: `broadcast` = house brand, `casino` = opt-in
casino-chrome example, `minimal` = calm SaaS counterpoint, `neon` = arcade. The
ThemeSwitcher chrome stays house-brand throughout. The hifi handoff deepens each
look but does not change which register each theme targets.
