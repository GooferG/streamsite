# Large-screen width + gamba tools strip + welcome sign-on — design

**Date:** 2026-05-31
**Status:** Approved (design)
**Branch:** opt/qol-updates

## Goals

Three quality-of-life changes, grounded in PRODUCT.md / DESIGN.md (late-night CRT
register, atmosphere over density, anti-reference = SaaS landing, voice rules: no em
dashes, sentence case, no superlatives, no rule-of-three cadence):

1. **Large-screen width.** On wide monitors content sits in a 1280px column with big
   empty gutters. Widen the caps, with tools going wider than marketing.
2. **Gamba tools strip.** A home-page channel segment that surfaces the gamba tools
   (hunt tracker, slot picker, bonus hunts, leaderboard) for discovery, especially for
   first-time visitors. Today the home page only points to the leaderboard (via
   `HomeLeaderboardCallout`).
3. **Welcome sign-on card.** A single dismissible "first time on the channel?" card on
   first visit, in the channel-ident idiom (not a SaaS stepped tour).

## Part 1 — Large-screen width split

### Decisions (locked)

- Primary problem is **empty gutter** (content too narrow), not tiny elements.
- **Split** the caps: tools wider than marketing (PRODUCT principle 4, "tools earn their
  visual weight").
- Marketing → **1440px**, tools → **1600px**.
- Only applies at **2xl (≥1536px)**. Below that, today's layout is unchanged (zero
  regression risk on laptops/tablets).

### Mechanism

Every affected container already uses `max-w-7xl mx-auto` (1280px). Append a `2xl:`
override. Tailwind's default `2xl` breakpoint (1536px) is currently unused, and arbitrary
values (`max-w-[1440px]`) work without a config change.

- **Marketing surfaces** → add `2xl:max-w-[1440px]` to the `max-w-7xl` container:
  - `src/pages/HomePage.js` (multiple section containers)
  - `src/pages/VodsPage.js`
  - `src/pages/GamingPage.js`
  - `src/pages/GearInteractive.js`
  - `src/components/StatsTicker.js`
  - `src/components/HomeLeaderboardCallout.js`
- **Tools** → add `2xl:max-w-[1600px]`:
  - `src/pages/GambaPage.js`

No Tailwind config change. No new breakpoints defined.

## Part 2 — Gamba tools strip (CH 05) on the home page

A new home section in the numbered "channel segment" idiom, placed directly below
`HomeLeaderboardCallout`. The leaderboard callout keeps its job (prize/standings, Rainbet
code); this strip is about **tool discovery**.

### Component — HomeGambaTools

**New `src/components/HomeGambaTools.js`:**

- A `<section>` with the home page's `id="gamba-tools"` anchor (the welcome card scrolls
  here).
- Uses the existing `SectionHeader` component (`src/components/SectionHeader.js`, props
  `{ segment, eyebrow, title, accent, action }`): segment `05`, eyebrow `Back of house ·
  The gamba wing`, title `The gamba tools`. **Note:** `SectionHeader.accent` only supports
  `'emerald'` | `'white'` (no purple). Use `accent="white"` for the header and carry the
  gamba-purple identity on the cards (purple icon + purple-tinted hover border). Do not
  pass `accent="purple"` — it silently falls back to emerald. (If a purple header is later
  wanted, extend `SectionHeader` to add a `'purple'` branch; out of scope here.)
- A responsive grid of channel cards built from the shared `GAMBA_TOOLS` list
  (`src/data/gambaTools.js`) — the same source the nav dropdown uses, so the tool set
  never drifts. Order/labels/icons come from that list.
- Each card: the tool's lucide icon + label + one short in-register line of copy, wrapped
  in a button that calls `setPage('gamba/' + tool.id)` → `/gamba/<id>`.
- **Per-tool copy** (sentence case, voice-rule-compliant):
  - Leaderboard — "See who's climbing the monthly standings."
  - Hunt Tracker — "Follow the bonus hunt live, bonus by bonus."
  - Bonus Hunts — "Browse past hunts and how they paid out."
  - Slot Picker — "Spin up a random slot to play next."
  - Suggestions — "Drop a slot for the next hunt." (the 5th tool in GAMBA_TOOLS)
  (If GAMBA_TOOLS gains tools later, render a generic fallback line so new tools still
  display; copy map is keyed by tool id with a default.)
- **Styling** (DESIGN.md tool register): `bg-zinc-card`, `rounded-lg` (12px), 16px
  padding, `border border-white/8` with purple-tinted hover (`hover:border-purple-gamba/40`),
  color/border transitions only — no shadow, no transform, no gradient text.
- `setPage` is passed from `HomePage.js` (already available there).

### Mount

In `src/pages/HomePage.js`, render `<HomeGambaTools setPage={setPage} />` immediately
after `<HomeLeaderboardCallout />`.

## Part 3 — Welcome sign-on card

A single dismissible card, channel-ident styled, shown once ever, on the home page after
the cold-open intro.

### Component — WelcomeSignOn

**New `src/components/WelcomeSignOn.js`:**

- A centered overlay card (not a blocking modal). Channel-ident styling: subtle scanline
  texture, emerald sign-on eyebrow (`▶ Channel sign-on`), `bg-zinc-card` with emerald
  border, no shadow.
- Heading: "First time on the channel?"
- Body: a couple of short lines on what's here. Draft (voice-rule-compliant, no
  rule-of-three cadence): "Watch live, dig through the tape, follow the bonus hunts, and
  climb the leaderboard. The gamba tools are part of the show."
- Two actions:
  - **Got it** — dismiss.
  - **Show me the gamba tools →** — dismiss, then smooth-scroll to `#gamba-tools` (the
    Part 2 strip). Uses `scrollIntoView({ behavior: 'smooth' })`, or instant scroll under
    `prefers-reduced-motion`.

### Trigger & persistence

- **Trigger:** home page only. Mounted in `HomePage.js`. Appears **after** the TV static
  cold-open resolves, keyed off the intro-complete state HomePage already tracks
  (`showTVIntro` / `handleIntroComplete`), so the card and the cold-open never stack.
  Does not fire on deep links to `/gamba`, `/schedule`, etc.
- **Persistence:** `localStorage` flag `gg_welcome_seen`, set on first dismissal or action.
  Never shows again on that device. (Rationale: the card is one-time *information* for a
  first-timer, unlike the cold-open which is per-session *atmosphere*. Low risk if
  dismissed by accident — the same info lives in the CH 05 strip and nav. One constant
  flip to `sessionStorage` if we later want it more forgiving.)

### A11y

- `role="dialog"`, `aria-label`, `aria-modal="false"` (non-blocking).
- Focus moves to the card on open; `Esc` dismisses; both buttons keyboard-focusable.
- Honors `prefers-reduced-motion`: no scanline animation, instant scroll on the secondary
  action.

## Error handling

- Width changes are pure CSS; no failure modes.
- `HomeGambaTools` renders from a static list; no async, no error states.
- `WelcomeSignOn`: guard `localStorage` access in a try/catch (private-mode browsers can
  throw); if storage is unavailable, fall back to showing the card and not persisting
  (acceptable — better to show than to crash). The `#gamba-tools` scroll target is
  guarded: if the element is missing, the action still dismisses cleanly.

## Testing

Manual (no test harness for nav/page UI in this repo):

- **Width:** at ≥1536px wide, marketing pages fill to ~1440px and GambaPage to ~1600px,
  with noticeably less gutter; at <1536px everything looks exactly as before. Check
  HomePage, VodsPage, GamingPage, GearInteractive, GambaPage.
- **Tools strip:** the CH 05 section renders below the leaderboard callout with all
  GAMBA_TOOLS cards; clicking each routes to the matching `/gamba/<id>`.
- **Welcome card:** in a fresh browser profile (or after clearing `gg_welcome_seen`),
  load `/` → card appears after the static intro. "Got it" dismisses; reload → it does
  not reappear. Clear the flag, reload, click "Show me the gamba tools" → dismisses and
  scrolls to the CH 05 strip. Deep-link to `/gamba` → card does not appear. With
  reduced-motion on → no scanline animation, instant scroll.
- **Build:** `npm run build` succeeds with no new ESLint errors.

## Out of scope (this pass)

- **Gamba hub (next pass).** Replace the current "`/gamba` index redirects straight into
  the leaderboard tool" behavior (`App.js` index route → `<Navigate to="/gamba/leaderboard">`)
  with a **gamba hub landing**: a leaderboard hero/info section at the top, then a grid of
  the tools so a visitor picks where to go instead of being dropped into one tool. Should
  reuse `GAMBA_TOOLS` and share visual language with the Part 2 home strip (the strip is
  effectively a preview of the hub). Touches GambaPage's layout, the index redirect, and a
  new hub component. Deserves its own brainstorm → spec → plan.
- Large-screen *element* scaling (bigger type/controls) — this pass only widens
  containers; it does not bump font/control sizes.
- Gaming nav dropdown (the generic NavDropdown from the prior pass supports it; not wired
  here).
- Removing/hiding the Suggestions section.
