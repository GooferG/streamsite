# Hunt Tracker UX Redesign — Design

Date: 2026-06-01
Status: Approved (brainstorm)
Component: `src/components/HuntTracker.js` (+ `SuggestionsPanel.js`, `HuntStartScreen.js`, new files)
Register: product (utility surface inside `/gamba` per PRODUCT.md)

## Problem

The bonus hunt tracker is hard for new users to pick up, and its two shareable
links are scattered and behave inconsistently:

- The **live spectator link** (`/live/:shareId`, read-only) is a one-click button
  in the top header button cluster.
- The **suggestion intake link** (`/hunt-suggest/:linkId`, password-gated public
  submissions) is buried in the right column inside `SuggestionsPanel` (section 06).

A host who just created a hunt wants to make both live at once, but they live far
apart and one needs a password. The page is also tall and scroll-heavy because the
right column stacks Financials, Squad split, Soft banned, Suggestions, and Caller
stats vertically. Inputs are small for a tool often used on a phone or second
monitor. New users get no guidance.

## Goals

1. Co-locate the two links so they are created together right after starting a hunt.
2. Restructure the layout so bonus slots + the headline stats are the focus and the
   squad equity sheet sits quietly to the side, cutting page height.
3. A first-time, owner-only, dismissible **coachmark walkthrough** that explains the
   flow, replayable on demand.
4. Targeted enlargement of the high-traffic inputs without bloating the dense tool
   into a marketing surface.

Non-goals: changing link semantics (live stays one-click read-only; suggestion link
keeps its password gate), changing data model / Firestore shape, touching the
`/live` spectator page or `/hunt-suggest` public submission page, reworking the
dense data tables.

## Decisions (from brainstorm)

- **Link flow:** Grouped, each its own button. Live = 1 click; suggestion keeps its
  inline password step. Co-located, not merged.
- **Bar location:** Dedicated full-width "Broadcast & collect" row directly under the
  hunt title header, above the status bar.
- **Layout (Option B):** Full-width overall-stats band on top (under the share bar),
  then bonus list left / quiet right column. Validated via visual companion.
- **Walkthrough trigger:** First visit, logged-in owner only, dismissible,
  localStorage-gated, replayable.
- **Walkthrough style:** Spotlight real elements (coachmarks) with a **hybrid
  fallback** to a centered card + mini-mockup when the target element is absent.
- **Tour button:** `?` icon (HelpCircle) in the header. Fires auto-tour on first
  active-hunt view (not on the start screen).
- **Sizing:** Targeted — primary inputs, add-bonus form, start form, share bar.
  Tables/rows/pills stay dense.

## Architecture

### 1. Broadcast & collect bar

New presentational section rendered in `HuntTracker.js` between the hunt header
(`px-4 py-3 border-b`) and the status bar. Owner-only (`isLoggedIn`), since both
links are already owner-gated.

Full-width strip, `grid grid-cols-1 sm:grid-cols-2 gap-2` (stacks on mobile),
tagged `data-tour="share-bar"`. Two cells:

- **Live cell.** Lifts the existing live-share UI out of the header button cluster.
  Reuses the current `shareId` / `startSharing` / `stopSharing` / `copyShareLink`
  logic verbatim — only the markup location moves. States:
  - Not sharing: "Go live" button (`Radio` icon).
  - Sharing: `● LIVE` pulse dot + read-only `/live/:id` URL field + Copy + Stop.
- **Collect cell.** Reuses the existing `LinkControls` component, moved out of
  `SuggestionsPanel`. No logic change: create-with-password → Collecting/Closed
  status + URL + Copy + Close/Re-open + Kill. Props are the same intake-link props
  `HuntTracker` already passes down (`linkId`, `linkOpen`, `linkBusy`, `linkError`,
  `onCreateLink`, `onToggleLink`, `onDeleteLink`).

`LinkControls` is **exported** from `SuggestionsPanel.js` (or extracted to its own
`src/components/HuntLinkControls.js` — preferred, see Components) so both the bar
and the now-trimmed suggestions panel can import it. After this change,
`SuggestionsPanel` no longer renders `LinkControls`; it keeps RosterSearch, import
flow, and the suggestion pill list.

The header button cluster keeps: phase toggle (Start opening / Edit bonuses),
new `?` tour button, Export split, Complete, Discard. The old `SHARE LIVE` /
live-status block is removed from the header.

### 2. Layout restructure (Option B)

Active-hunt body reorders to:

```
header (title, phase toggle, ?, Export, Complete, Discard)
broadcast & collect bar          [owner only]
status bar (Bonuses / Squad / local-only / error)
overall-stats band (full width)  [Profit · Req X · W/L mult · Total wins + Start/Finish balance]
body grid (lg:grid-cols-2):
  LEFT  — Bonus list (01): add form / opening current-slot / table  [data-tour="add-form" on the form]
  RIGHT — quieter stack:
            Squad split equity (03)   [was 02/03 area]
            Soft banned (04)
            Suggestions (06)          [data-tour="suggestions"; LinkControls removed]
            Caller stats (07)
```

- The **overall-stats band** is a new full-width container under the status bar. It
  hosts the four `StatCell`s (Profit, Req X, W/L Multiplier, Total wins) plus the
  Start/Finish balance inputs (moved out of the old right-column "Financials" §02).
  Visually it leads the body; styled as a band (subtle emerald tint, denser than a
  marketing hero, per register).
- The right column drops "Financials" as a separate section (its stats moved to the
  band; its balance inputs moved to the band). It now reads as the quiet equity +
  context side: Squad split, Soft banned, Suggestions, Caller stats. Section labels
  on the right may dim slightly to signal secondary status.
- Existing computed values (`stats`, `gamblerRows`, `callerStats`, `displayBonuses`,
  `rowList`) are unchanged — only JSX placement moves.

### 3. Coachmark tour

New files:

- `src/hooks/useFirstVisit.js` — tiny hook wrapping `localStorage`. Returns
  `[seen, markSeen]` for a given key (`'huntTourSeen'`). Guards against SSR / disabled
  storage (try/catch, treat failures as "seen" so the tour never hard-blocks).
- `src/components/HuntTour.js` — the overlay + step engine.

**Mechanism (no new dependency).** A fixed full-viewport overlay. For the current
step, look up its target by `document.querySelector('[data-tour="<key>"]')`:

- **Target present:** measure `getBoundingClientRect()`. Render a dimmed overlay
  with a transparent cut-out box (4-rectangle mask or a box-shadow `0 0 0 9999px`
  spotlight) over the element, plus a tooltip card anchored adjacent (auto-flips
  above/below based on available space). Re-measure on resize/scroll.
- **Target absent:** render a centered card with a short mini-mockup illustration
  (small inline JSX, e.g. a fake suggestion pill, a fake stat row) instead of a
  spotlight.

**Steps:**

| # | Title | Target (`data-tour`) | Fallback card |
|---|-------|----------------------|---------------|
| 1 | Welcome — what this does | (none, always card) | intro copy |
| 2 | Your two links | `share-bar` | mini live + collect cells |
| 3 | Where suggestions land | `suggestions` | demo person + pills |
| 4 | Accept / reject a pick | (always card) | animated fake pill: open → in bonus → Got in / Nope |
| 5 | Log & open bonuses | `add-form` | mini add-form / opening note |
| 6 | Finish up | `complete-actions` | Complete + Export note |

Step 4 is always the fallback card (the most important explanation, kept reliable
regardless of whether a real suggestion exists). Header `?` button and the
Complete/Export buttons get `data-tour="..."` attributes; `complete-actions` wraps
the header's Complete + Export buttons.

**Controls.** Skip (top-right, ends + `markSeen`), Back (disabled on step 1), Next
(label "Done" on last step), step counter "n / 6". `Escape` = skip. Buttons are
keyboard-focusable; overlay traps focus while open.

**Triggering.** In `HuntTracker`, when `status === 'active'` and `isLoggedIn` and
`!seen`, open the tour (once). Skip/finish calls `markSeen()`. The `?` button sets
an explicit `tourOpen` state that opens the tour ignoring `seen` (replay). The auto
path and replay path share one `tourOpen` boolean; `seen` only gates the auto-open.

**Motion.** Step 4's pill animation and the spotlight transition are gated behind
`prefers-reduced-motion`; reduced motion shows static end states and no animated
box movement.

### 4. Targeted sizing

- Shared `inputCls` in `HuntTracker.js` and `SuggestionsPanel.js`: `px-3 py-2` →
  `px-3.5 py-2.5`. Keep `text-sm`. (Both files declare the same string; update both.)
- Add-bonus form container (`collecting`): `p-3 space-y-2` → `p-4 space-y-3`;
  "Log bonus" button `py-2` → `py-2.5`; Super / 5-scat toggles `py-2` → `py-2.5`.
- Start-hunt form (`HuntStartScreen`): already roomy (`py-2.5`); nudge Start button
  + outer spacing to match, no big change.
- Share bar: built new at comfortable size — read-only URL fields and copy buttons
  ~`py-2.5`, easy tap targets.
- Left untouched: bonus table rows, squad table, caller leaderboard, suggestion
  pills, the opening-phase win input (already `text-base`).

No color/font token changes. Padding/spacing only on high-traffic inputs.

## Components

- `src/components/HuntTracker.js` — restructure JSX (bar, stats band, column
  reorder), add `?` button + tour state + `data-tour` attributes, sizing tweaks.
  Remove header live-share block (logic moves into the bar cell).
- `src/components/HuntLinkControls.js` — **new**: extract `LinkControls` from
  `SuggestionsPanel.js` into its own file so both the share bar and the panel can
  import it. (`SuggestionsPanel` imports it back if it still needs it — it does not
  after this change, so the panel just stops rendering it.)
- `src/components/SuggestionsPanel.js` — remove inline `LinkControls`, import the
  extracted one only if needed (not needed post-change); keep RosterSearch + import
  + pills; add `data-tour="suggestions"` wrapper; update `inputCls`.
- `src/components/HuntStartScreen.js` — minor sizing parity.
- `src/components/HuntTour.js` — **new**: overlay, spotlight, step cards, controls.
- `src/hooks/useFirstVisit.js` — **new**: localStorage-backed first-visit flag.

## Data flow

No data-model or Firestore changes. The tour reads only `localStorage` and the DOM.
Live-share and intake-link state continue to flow through the existing
`useHuntStore` hook and `authedFetch` calls; only the rendering location of those
controls moves. The stats band consumes the same `computeStats` output already in
the component.

## Error handling

- `useFirstVisit` swallows `localStorage` access errors and treats them as "seen"
  (private-mode / disabled storage never traps the user behind a tour).
- Tour target lookup tolerates `null` (element absent) → fallback card. No throw if
  a `data-tour` element is missing.
- Spotlight re-measurement guards against `0`-size rects (element hidden mid-tour) by
  falling back to the centered card for that step.
- Existing link error states (`linkError`) render unchanged inside the moved
  `LinkControls`.

## Accessibility

- Tour overlay: focusable controls, `Escape` to skip, focus trapped while open,
  `aria-modal` on the dialog card. Honors `prefers-reduced-motion` (per PRODUCT.md,
  best-effort, not a hard gate).
- Bigger inputs improve tap targets (most users on phone / second monitor).
- The bar, forms, and tour stay keyboard-navigable (product-register requirement:
  nav/forms/admin keyboard-sensible).

## Testing

No CI gate exists; tests are best-effort unit tests under `src/**/__tests__/`.

- `useFirstVisit` unit test: returns `false` then `true` after `markSeen`; tolerates
  a throwing `localStorage` mock (returns "seen").
- `HuntTour` smoke test: renders step 1, Next advances, Skip/Done calls `markSeen`,
  Escape closes. Target-present vs target-absent both render without throwing.
- Manual: create a hunt as owner → tour auto-opens once → skip → reload → does not
  reopen → `?` replays. Both links creatable from the bar. Layout matches Option B
  on desktop and stacks on mobile.

## Rollout

Single PR. Pure frontend, no env or serverless changes. Lazy chunk already isolates
`HuntTracker`; new files ride in the same chunk. No migration.
