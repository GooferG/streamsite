# Gamba nav dropdown + login redirect — design

**Date:** 2026-05-31
**Status:** Approved (design)

## Goals

1. **Gamba nav dropdown.** Hovering (or clicking / keyboard-focusing) the "Gamba"
   nav item reveals a dropdown of its tools (Leaderboard, Hunt Tracker, Bonus Hunts,
   Slot Picker, Suggestions) so users can jump straight to a tool. Built generic so
   Gaming can reuse it later.
2. **Login redirect.** Every Twitch login lands the user on `/me` (their account
   page) instead of `/suggest`.

## Part 1 — Gamba nav dropdown

### Scope decisions (locked)

- **Desktop trigger:** hover **and** click **and** keyboard. Hover opens for mouse
  users; a chevron toggle opens on click/Enter; `Esc` and outside-click close;
  `↑/↓` move focus through items. No one is locked out.
- **Label click:** the "Gamba" label still navigates to `/gamba` (current behavior).
  The chevron is the menu trigger, distinct from the label.
- **Mobile drawer:** the Gamba row becomes an accordion — tapping it expands an
  indented sub-list of the 5 tools.
- **Reuse:** a generic `children`-driven dropdown nav item. Wire Gamba now; Gaming
  plugs in later by adding its own children list + `hasDropdown` flag.
- **Tools source:** lift the existing `TOOLS` array out of `GambaPage.js` into a
  shared module `src/data/gambaTools.js`. One source of truth for both the in-page
  tool tabs and the nav dropdown.

### Components

#### New file `src/data/gambaTools.js`

The canonical Gamba tool list, moved verbatim from `GambaPage.js` (same ids, labels,
icons). Routes are `/gamba/${id}`.

```js
import { Target, Gamepad2, MessageSquarePlus, Layers, Radio } from 'lucide-react';

export const GAMBA_TOOLS = [
  { id: 'leaderboard', label: 'Leaderboard', icon: Radio },
  { id: 'hunt-tracker', label: 'Hunt Tracker', icon: Target },
  { id: 'bonus-hunts', label: 'Bonus Hunts', icon: Layers },
  { id: 'wheel', label: 'Slot Picker', icon: Gamepad2 },
  { id: 'suggest', label: 'Suggestions', icon: MessageSquarePlus },
];
```

#### `src/pages/GambaPage.js`

Replace the local `const TOOLS = [...]` with `import { GAMBA_TOOLS } from '../data/gambaTools'`
and rename internal references `TOOLS` → `GAMBA_TOOLS`. Behavior identical; the icon
imports that were only used by `TOOLS` move to the new module (drop now-unused icon
imports from GambaPage if they are not referenced elsewhere in the file).

#### `src/components/Navigation.js`

- **`NAV_ITEMS`:** give the Gamba entry a `dropdown: GAMBA_TOOLS` field. (Generic: any
  item with a `dropdown` list opts in and carries its own tools — the flag and the data
  are the same field, so the nav map needs no second lookup. The implementation plan uses
  this `dropdown:` form rather than a separate `hasDropdown` flag.)
- **New `NavDropdown` component** (desktop), wrapping the existing `NavLink`:
  - A relatively-positioned wrapper with `onMouseEnter` → open, `onMouseLeave` → close
    after a short delay (~120ms) so diagonal mouse travel into the menu doesn't dismiss it.
  - The label is a `NavLink` (`onClick` → `setPage('gamba')` → `/gamba`), unchanged.
  - A chevron toggle button beside the label: `onClick` toggles the menu;
    `aria-haspopup="menu"`, `aria-expanded={open}`. Keyboard: Enter/Space toggles,
    `Esc` closes and returns focus to the chevron, `↑/↓` move focus among items.
  - Outside-click closes via the `document` `mousedown` listener pattern already used
    in `ViewerAuthControl` (add listener only while open).
  - Menu panel: `role="menu"`, styled like the `ViewerAuthControl` dropdown
    (`absolute … mt-2 border border-white/10 bg-zinc-card shadow-lg z-50`). Each item
    is `role="menuitem"`, renders the tool's lucide icon + label, and calls
    `setPage('gamba/' + tool.id)` then closes.
  - Respect `prefers-reduced-motion`: skip the fade/slide animation when set (matches
    the codebase convention, e.g. the gamba sheet keyframes).
- **Desktop nav map:** when an item has a `dropdown` list, render `<NavDropdown item={item}
  items={item.dropdown} setPage={setPage} active={currentPage === item.id} />`
  (prop is named `items`, not `children` — `children` is reserved in React);
  otherwise render the plain `NavLink` as today. `currentPage` already resolves to the
  first path segment, so "Gamba" shows active for any `/gamba/*` route.
- **Mobile drawer:** for the Gamba row, render an accordion. Tapping the row toggles a
  local `expanded` state (chevron rotates). When expanded, render the 5 tools as
  indented sub-rows; each calls `handleNavClick('gamba/' + tool.id)` (which navigates
  and closes the drawer). The parent row stays active-styled for any `/gamba/*`; the
  exact-match sub-row highlights. Keep the existing tap-to-navigate for non-dropdown rows.

### Routing correctness

`setPage` in `App.js` is `(id) => navigate(id === 'home' ? '/' : '/' + id)`, so
`setPage('gamba/leaderboard')` navigates to `/gamba/leaderboard`. `GambaPage` reads its
active tool from `pathname.split('/')[2]` and its tabs from `GAMBA_TOOLS`, so dropdown
destinations and in-page tabs are guaranteed consistent — both keyed off the same ids.

### Error handling

- Dropdown is presentational; no async, no failure modes. If the children list is
  empty, render the plain `NavLink` (no chevron, no menu).
- Outside-click / `Esc` always close. Listener is removed on unmount and when closed.

## Part 2 — Login redirect → /me

Every Twitch login (new or returning) lands on `/me`. No server change; no `isNewUser`
plumbing. `twitch-auth.js` and `TwitchAuthContext` are untouched.

### Component

#### `src/pages/TwitchCallbackPage.js`

- Success redirect: `navigate('/suggest', { replace: true })` → `navigate('/me', { replace: true })`.
- Error-fallback button: `onClick={() => navigate('/suggest')}` → `navigate('/me')`,
  and its label "Back to Suggest" → "Back to My Account".

## Testing

Manual (no test harness for nav/page code in this repo):

- **Desktop dropdown:** hover Gamba → menu appears; move into menu → stays open; click
  a tool → routes to that `/gamba/<id>` and menu closes. Click the "Gamba" label →
  goes to `/gamba`. Tab to the chevron, Enter → opens; `↑/↓` move; `Esc` closes.
  Click outside → closes.
- **Mobile drawer:** open drawer, tap Gamba → sub-list expands; tap a tool → navigates
  and drawer closes; tap Gamba again → collapses.
- **Active state:** on any `/gamba/*` route, the Gamba nav item shows its active dot.
- **Reduced motion:** with OS reduced-motion on, the menu appears without animation.
- **Redirect:** sign in with Twitch → land on `/me` (both a brand-new account and an
  existing one). Trigger the error path (bad code) → "Back to My Account" button goes
  to `/me`.
- **Build:** `npm run build` succeeds with no new ESLint errors.

## Out of scope (explicit)

- Gaming dropdown (this pass builds the generic component but wires only Gamba).
- Large-screen / fullscreen UI scaling (separate pass).
- Call-to-action for gamba tools (separate pass).
- `isNewUser` server signal (not needed — everyone goes to `/me`).
- Removing or hiding the Suggestions section (left as-is; revisit later).
