# Gamba hub landing — design

**Date:** 2026-05-31
**Status:** Approved (design)
**Branch:** opt/qol-updates

## Goal

Bare `/gamba` currently redirects straight into the leaderboard tool. Replace that with a
**hub landing**: a leaderboard hero on top, then a grid of the gamba tools, so a visitor
picks where to go instead of being dropped into one tool. Reuse existing on-brand
components (`HomeLeaderboardCallout`, `HomeGambaTools`) so the hub inherits the CRT register
and shares visual language with the home-page tool strip.

## Current behavior (for reference)

- `App.js`: the `/gamba` parent route has an `index` child that
  `<Navigate to="/gamba/leaderboard" replace />`. The other children
  (`leaderboard`, `wheel`, `hunt`, `suggest`, `bonus-hunts`, `hunt-tracker`, `equity`)
  render `null` — they exist only so the router matches the path; `GambaPage` (the parent
  `element`) reads the URL and renders the actual tool surface.
- `GambaPage.js`: `activeTool = location.pathname.split('/')[2] || 'leaderboard'`. It renders
  a channel-tab strip (desktop) / tuner sheet (mobile), then the tool surface for
  `activeTool`. Container is `max-w-7xl 2xl:max-w-[1600px] mx-auto`.
- Tools come from the shared `GAMBA_TOOLS` list (`src/data/gambaTools.js`).

## Decisions (locked)

- **Routing:** `/gamba` = hub; `/gamba/<tool>` = that tool (unchanged). Remove the index
  redirect. The nav "Gamba" label lands on the hub; nav dropdown items still go to
  `/gamba/<tool>`.
- **No "remember last tool" logic.** Bare `/gamba` always shows the hub.
- **Back to hub from a tool:** top-nav "Gamba" returns to `/gamba`, **plus** a hub
  affordance at the start of the tab strip (and in the mobile tuner sheet).
- **Layout A:** leaderboard hero on top, tool grid below.
- **Hero:** reuse `HomeLeaderboardCallout`, with a small configurable-CTA prop (default
  preserves today's home behavior).
- **Tool grid:** reuse `HomeGambaTools`, generalized with optional heading props (defaults
  preserve today's home values).

## Section 1 — Routing

### App.js

Remove the index redirect child of the `/gamba` route:

```jsx
// DELETE this child:
<Route index element={<Navigate to="/gamba/leaderboard" replace />} />
```

Leave the `/gamba` parent route and the other `null` children as-is. With the index
redirect gone, bare `/gamba` matches the parent with no tool segment, and `GambaPage`
renders the hub. (If `Navigate` becomes an unused import after this, remove it; verify
other routes don't still use it before deleting the import.)

### GambaPage.js

- Change the active-tool fallback so bare `/gamba` means "no tool" — replace the current
  `|| 'leaderboard'` with `|| null`:

```js
const activeTool = location.pathname.split('/')[2] || null;
```

- When `activeTool` is `null`, render `<GambaHub />` (Section 2) and **do not** render the
  channel-tab strip or tuner trigger (the hub is a landing, not a tab surface).
- When `activeTool` is set, render exactly as today: the tab strip / tuner sheet + the tool
  surface. The `activeIndex` computation (`GAMBA_TOOLS.findIndex`) and the
  `scrollIntoView` effect must guard against `activeTool === null` (skip when null) so they
  don't mis-highlight or throw.
- **Hub affordance in the tab strip:** add a leading control at the start of the desktop
  strip and the mobile tuner sheet, labeled "Hub" with a grid/back icon, that routes to
  `/gamba`. Note: `setActiveTool` builds `/gamba/<tool>` and cannot produce bare `/gamba`,
  so the hub control must call `navigate('/gamba')` directly (not `setActiveTool`). Styled
  consistently with the existing `ChannelTab`s but visually distinct as a "leave the tools"
  control (not a tool tab).

## Section 2 — The hub view

### New `src/components/GambaHub.js`

A small presentational component that composes the two reused pieces. Keeps GambaPage from
growing a large inline hub block.

- Renders inside GambaPage's existing container (so it inherits `2xl:max-w-[1600px]`).
- **Hero:** `<HomeLeaderboardCallout />` (reused). On the hub it routes to
  `/gamba/leaderboard` (today's behavior), which is correct here.
- **Tool grid:** `<HomeGambaTools />` (reused, generalized — see below) with hub-appropriate
  heading props and the navigation callback that routes cards to `/gamba/<id>`.
- Vertical rhythm between hero and grid matches the home page (the components already carry
  their own section padding).

### HomeLeaderboardCallout — configurable CTA

Today it hardcodes navigating to `/gamba/leaderboard` and its CTA copy. Add small optional
props so the hub instance can override later without forking:

- `ctaTarget` (default `'/gamba/leaderboard'`) — where the callout navigates on click.
- `ctaLabel` (default the current "View standings" text) — the CTA label.

Defaults preserve the existing home-page behavior exactly. The hub passes the defaults for
now (no behavior change), but the seam exists. **Verify** the component has no other
home-only assumption (e.g. width); it currently sits in a `max-w-7xl 2xl:max-w-[1440px]`
wrapper on the home page but renders its own inner layout, so dropping it in the hub's wider
container is fine — confirm during implementation.

### HomeGambaTools — generalized heading

Today it hardcodes the `SectionHeader` (`segment="05"`, eyebrow `Back of house · The gamba
wing`, title `The gamba tools`). Generalize with optional props, defaulting to today's home
values so the home page is unchanged:

- `segment` (default `'05'`)
- `eyebrow` (default `'Back of house · The gamba wing'`)
- `title` (default `'The gamba tools'`)
- `showSegment` (default `true`) — lets the hub omit the segment number if it reads oddly
  as a standalone page heading.

The hub passes a plainer heading (it is the whole page, not one feed segment), e.g.
`title="Pick a tool"` and no segment. The home page calls `HomeGambaTools` with no new props
and behaves exactly as before.

## Error handling

- Routing: removing the redirect is safe; bare `/gamba` falls through to the parent. No
  failure mode.
- `activeTool === null` guards in GambaPage prevent the `activeIndex`/`scrollIntoView`
  logic from running on the hub.
- Hub composes components that already handle their own data/loading
  (`HomeLeaderboardCallout` via `useLeaderboardData`) and reduced-motion. No new data fetch.

## Testing

Manual (no test harness for this UI):

- Visit `/gamba` → hub renders: leaderboard hero on top, tool grid below, **no** tab strip.
- Click each tool card → routes to `/gamba/<id>` and that tool loads with the tab strip.
- On a tool page, the tab strip shows a leading "Hub" control; click it → back to `/gamba`
  hub. Top-nav "Gamba" also returns to the hub. Mobile tuner sheet has the same hub control.
- Direct-load `/gamba/leaderboard` (and each other tool URL) → loads that tool directly,
  unchanged from today.
- Nav dropdown items still route to `/gamba/<tool>` (prior pass) — unchanged.
- Home page: `HomeGambaTools` strip and `HomeLeaderboardCallout` look exactly as before (no
  prop regressions).
- Reduced-motion: hero animations honor it (already handled).
- `npm run build` succeeds with no new ESLint errors.

## Out of scope

- "Remember last tool" / skip-the-hub behavior.
- Restructuring the tool surfaces themselves.
- The `equity`/`hunt` legacy `null` route stubs in App.js (left as-is unless they break;
  not part of this change).
- Per-tool live status or previews on the hub cards (cards stay as the shared
  `HomeGambaTools` cards).
