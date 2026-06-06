# Handoff: Hunt Tracker redesign (CH 02 / `/gamba` hunt tracker)

## Overview
A redesign and feature expansion of the GooferG **Hunt Tracker** (the `/gamba` bonus-hunt tool). It covers:

1. **Tracker shell** — clearer hierarchy: a hero Profit/Loss readout, a two-tier stat grid, the live bonus log as the primary working surface, and a tightened right column (squad split, viewer calls, soft-banned, caller stats).
2. **Opening phase** — a focused, one-bonus-at-a-time "opening mode" for entering payouts, with live multiplier, notes, prev/next, next-game preview, and hotkeys.
3. **Viewer calls** — incoming suggestions grouped by viewer (a viewer can suggest multiple slots), each with **Add** (promote into the hunt) and **Skip** (didn't make the hunt) actions, plus per-viewer **Skip All**. The collect/suggestion link lives in a popover here.
4. **Caller stats + reputation (panel `05`)** — extends the approved `slot-caller-tracking` spec with a **cross-hunt** reputation layer: per-caller accept rate (got in vs skipped), recent X "form", and **HOT / COLD / STEADY** status, plus highlight tiles (on-a-heater, best call, brick of the hunt).
5. **Caller call-log drawer** — clicking any caller name opens their full track record (this hunt + prior hunts).
6. **Hunt history** — completed hunts expand to show their bonus table and a compact caller-stats block (top callers, best call, brick).

## About the Design Files
The files in this bundle are **design references built in HTML** (React via in-browser Babel, plain CSS). They are prototypes showing the intended look and behavior — **not production code to copy directly**. The task is to **recreate these designs inside the existing `streamsite` React app** (CRA, Tailwind, Firebase), using its established components, the `DESIGN.md` token system, and the existing hunt data model. Treat the HTML/CSS as the source of truth for layout, interaction, and visual intent; re-express it in Tailwind + the repo's component conventions.

## Fidelity
**High-fidelity.** Final layout, spacing, type scale, states, and interactions are all specified. Recreate pixel-faithfully using the repo's Tailwind tokens. Note: the prototype's default theme is the **GooferG brand register** (emerald = signal/positive/primary, purple = community/gamba). A "studio" violet theme also exists in the prototype as a Tweak — ignore it for implementation; ship the **GooferG** colors, which already match `DESIGN.md`.

---

## Target files in `streamsite`
- `src/utils/huntCalc.js` — add `computeCallerStats(bonuses, ledger)` and reputation helpers (see Stat Math below).
- `src/components/HuntTracker.js` — tracker shell, opening phase, viewer-calls grouping + Skip/Add, caller-stats panel `05`, caller call-log drawer, share/suggestions popovers.
- `src/components/HuntHistory.js` — caller name per row + compact caller-stats block in the expand.
- `api/hunt-suggest/*`, `api/suggestions/*` — Skip/Add outcome handling and the per-caller aggregate (see State & Persistence).

---

## Data model
The repo's bonus shape (keep it):
```js
{ id, slot, stake, win, super, fiveScat, caller }
```
Prototype field → repo field mapping (the prototype used its own names):
| Prototype | Repo | Notes |
|---|---|---|
| `game` | `slot` | slot name |
| `bet` | `stake` | wager per bonus |
| `payout` | `win` | payout entered when opened; `null`/absent = not yet opened |
| `type: "regular" \| "super" \| "5scatter"` | `super` (bool), `fiveScat` (bool) | regular = both false |
| `caller` | `caller` | trimmed string, optional |
| `opened` (bool) | derive: `win != null` | a bonus is "played" when `stake > 0 && win != null` |

**X multiplier** = `win / stake`. This is the fair pay metric used everywhere (best/worst/avg).

### New: cross-hunt caller ledger
For the reputation layer you need each caller's history beyond the current hunt. Prototype shape:
```js
// per caller, aggregated from prior completed hunts + suggestion outcomes
{ name, gotInPrev, missedPrev, prevX: [<X of played prior calls>] }
```
In production, derive this from the user's completed hunts (each hunt's called bonuses) plus suggestion accept/skip outcomes, or maintain a small aggregate doc per caller (see State & Persistence).

---

## Stat math (`huntCalc.js`)

```
computeCallerStats(bonuses, ledger) => {
  leaderboard,     // [{ name, calls, gotIn, missed, acceptRate, avgX, best, plays, form, status, hotStreak, coldStreak }]
  bestCall,        // { slot, x, caller } | null  — highest X among played called bonuses
  worstCall,       // { slot, x, caller } | null  — lowest X among played called bonuses ("brick of the hunt")
  mostConsistent,  // row with highest avgX, min 2 plays
  hotCaller,       // hot row with highest avgX
  coldCaller,      // cold row with lowest acceptRate
}
```

Rules:
- Seed each caller from `ledger` (gotInPrev, missedPrev, prevX), then layer the current `bonuses`:
  - any non-empty `caller` on a bonus counts as **gotIn += 1** (it made the hunt);
  - if the bonus is **played** (`stake > 0 && win != null`), push `X = win/stake` into that caller's X list.
- Per caller:
  - `calls = gotIn + missed`, `acceptRate = gotIn / calls`
  - `avgX = mean(X list)`, `best = max(X list)`, `plays = X list length`
  - `form` = last 5 X mapped to `win` (X ≥ 20), `ok` (1 ≤ X < 20), `brick` (X < 1)
  - `hotStreak` / `coldStreak` = trailing run of X ≥ 20 / X < 1
  - **status**: `hot` if `hotStreak ≥ 2` OR (`avgX ≥ 25` AND `acceptRate ≥ 0.6`); `cold` if `coldStreak ≥ 2` OR (`acceptRate < 0.35` AND `calls ≥ 3`); else `steady`.
- `leaderboard` sorted by `calls` desc, then name.
- Everything returns `null` / empty when there's no qualifying data (UI shows an em dash).

These thresholds are tuned for a "fun stat," not statistics — keep them adjustable.

---

## Screens / Views

### 1. Tracker (active hunt) — main view
**Layout:** Top channel-tab nav (sticky). Below, a vertical stack at `max-width: 1640px`, centered, `gap: 18px`, side padding `18px`:
- **Hunt header** row: back button (40×40, `rounded-md`), title block (kicker label + `Friday Disc Hunt` at ~30px/600 with an edit pencil), and right-aligned action buttons: **Resume opening** (primary/emerald), Collab, Share (popover), Export split, Complete, overflow `…`.
- **Stat grid**: `grid-template-columns: 360px 1fr`, `gap: 16px`.
  - **Hero P/L card** (left, 360px): label `PROFIT / LOSS` + a pace chip (`BEHIND · need 9.30x avg` / `AHEAD`), a 52px/600 tabular value colored by sign (emerald positive, red negative), and a mono subline (`$792.50 won · $800.00 start · 0.99x recovered`). A faint radial glow tinted by sign, no box-shadow.
  - **Secondary cards** (right): `grid-template-columns: repeat(4, 1fr)`, two rows of: Bonuses (+ "n pending"), Start cost, Winnings, Avg req, Cur avg, Total X, Req X, Cur avg X. Each is a `rounded-lg` card, label (10px/uppercase/tracking-wider, muted) + 24px/600 tabular value. Winnings and Cur-avg-X tint emerald when positive.
- **Assistant tip** (optional, dismissible): inline-blur banner, emerald-tinted, `ASSISTANT` eyebrow + one sentence.
- **Work grid**: `grid-template-columns: 1.35fr 1fr`, `gap: 16px`, `align-items: start`.
  - **Left col — Bonus list (panel `01`)**: header (`01` number chip + "Bonus list" + "7/12 opened" + an `OPENING` flag). A **quick-add** block: slot name + bet inputs, caller input, a 3-way segmented type control (Regular / Super / 5-Scatter), and a full-width primary **Log bonus** button with an `↵` kbd hint. A filter input appears when > 5 logged. Then the **bonus table**: columns `# | GAME (name + provider · caller) | TYPE badge | BET | PAYOUT | MULTI | ✕`. Pending rows are tinted amber and show an **Open** button in the payout cell (click → inline payout input). Played rows show the payout (click to edit) and a color-graded **multiplier tag** (zero=red, low/mid=neutral, big=emerald, huge ≥100x = filled emerald). A footer line shows top multi, count left to open, and "need $X avg to break even." A `cards` layout variant exists (Tweak) but table is the default.
  - **Right col**: **Squad split** (panel), **Viewer calls** (panel), **Soft banned** (panel), **Caller stats** (panel `05`), stacked with `gap: 16px`.
- **Hunt history** panel spans full width below the work grid (see view 4).

**Squad split panel:** header + a "winnings pool / net P/L" basis chip. Add row (name + "in for $" + `+`). Table: `MEMBER | IN FOR (inline-editable) | SHARE % (purple/community) | PAYOUT (emerald)`, with a TOTAL footer. Payout = share × basis; basis is winnings or net profit (Tweak).

**Soft banned panel:** chip list of slots to avoid (red-tinted chips with ✕), plus an inline "add slot to avoid…" input (Enter to add).

### 2. Viewer calls (panel)
**Purpose:** triage incoming viewer slot suggestions.
**Layout:** header ("Viewer calls" + "N pending" + a **Suggestions** popover button holding the collect link). Body is **grouped by caller**:
- Each group: a caller header — the name is a **clickable link** (purple/community) that opens the call-log drawer; if the group has > 1 call, show "N calls" and a **Skip all** text button.
- Each call row (indented under its caller): slot name + timestamp, then two actions: **Skip** (ghost; hover → red; tooltip "Didn't make the hunt — counts against this caller") and **Add** (emerald "open" style; promotes the suggestion into the hunt as a logged bonus with this caller attached).
**Behavior:** Add → append a bonus `{ slot, stake: default, caller, regular }` and remove the call. Skip → remove the call and **increment that caller's `missed`** in the ledger/aggregate. Both must work for any number of calls per viewer.

### 3. Opening mode (focus view)
**Entry:** "Resume opening" / "Start opening" in the header; jumps to the first un-opened bonus. Replaces the work grid (stat grid stays pinned on top).
**Layout:**
- A bar: **Back to hunt** link, an `OPENING · n/total done` label, and a hotkeys hint (`↵` next · `←/→` nav · `esc` exit).
- A centered **focus card** (`max-width: 1040px`): game avatar (placeholder: rounded-square, accent-tinted diagonal stripes + initials) + slot name + type badge + meta ("provider · called by X · bonus 8 of 12") + prev/next arrow buttons.
  - Fields row (`grid 1fr 1fr 1fr`): **Bet size** (read-only display), **Payout** (focused input, `$` prefix), **Multiplier** (computed live; color-graded like the table tag).
  - **Notes** textarea.
  - Footer: **Cancel**, a **Next** preview (avatar + next slot name), and **Save & continue** (becomes **Finish opening** on the last bonus).
**Behavior:** Save writes `win` to the bonus (marks it played) and advances. Hotkeys: Enter = save & next; ←/→ navigate (saving current); Esc = exit. Stats recompute live as payouts are entered.

### 4. Hunt history (panel)
**Purpose:** review completed hunts and their caller performance.
**Layout:** header ("Hunt history" + "N completed"). Each hunt is a clickable row: chevron, name, date (mono), `n bonuses · X.XXx`, and a P/L value (emerald/red). Expanded body is `grid 1.5fr 1fr`:
- **Bonus table**: `GAME | CALLER (clickable) | BET | PAYOUT | MULTI`.
- **Caller block**: "Top callers" mini-leaderboard (rank, name link, "n in", avgX) + two highlight rows: **Best** (emerald, trophy) and **Brick** (red, ban icon), each `slot · X.XXx` + caller.
First hunt expanded by default.

### 5. Caller call-log drawer (modal)
**Trigger:** click any caller name (calls list, caller-stats leaderboard, or history).
**Layout:** centered modal (`width: 480px`) over a blurred scrim. Header: avatar + name + status badge + subline ("15 of 17 calls made the hunt · 88% accept rate") + close ✕. A 4-up stat strip: **Avg X**, **Best X**, **Skipped**, **Form** (the pip strip). Section "**This hunt · n in**": each slot they called with its multiplier tag (or "opening…" / "pending call"). Section "**Prior hunts**": "12 slots in · 2 skipped · 4 played · avg 22.50x".

### Caller stats panel (`05`) — detail
Header (`05` chip + "Caller stats" + "N callers"). Three highlight tiles (1px-gap grid): **On a heater** (hot caller + avg + streak), **Best call** (emerald), **Brick of the hunt** (red). Then a table: `CALLER (rank + name link + status badge) | GOT IN (gotIn/calls, "n missed") | FORM (pip strip) | AVG X (emerald if ≥20, red if <1)`. A footer line names the coldest caller and their accept rate. Em dashes when data is missing.

---

## Interactions & Behavior
- **Add / Skip** (viewer calls), **Open / edit payout** (bonus rows), **inline edit** (squad "in for", caller on a row) — all recompute stats live.
- **Opening hotkeys**: Enter, ←, →, Esc (ignore Enter inside the notes textarea).
- **Popovers** (Share, Suggestions): toggle open, close on outside click (`mousedown`), copy-to-clipboard with a transient "Copied" state, a destructive action (Stop stream / Kill link).
- **Modal** (call log): close on scrim click or ✕; stop propagation inside.
- **Transitions**: color/opacity only on buttons (no transform/scale/shadow per `DESIGN.md` "no-shadow" + hover rules). Popover/modal fade+rise ~140ms.
- **Responsive**: stat grid and work grid collapse to one column < 1180px; opening fields stack < 760px.

## State Management
Current-hunt state (already in `HuntTracker.js` via `updateHunt({ bonuses })`, Firestore for logged-in / localStorage for anon):
- `bonuses[]` (with `caller`), `gamblers[]`/squad, `softBanned[]`.
- New UI state: `openMode` + `openIdx` (opening phase), `logCaller` (drawer target), `callerInput` + `editingCallerId` (per the caller-tracking spec), popover open flags.
- **Suggestions/calls**: pending viewer calls come from the existing `api/hunt-suggest/*` / `api/suggestions/*` flow. **Add** promotes a suggestion to a bonus; **Skip** resolves it as not-played.

### Persistence for the reputation layer (new)
The hot/cold reputation needs cross-hunt aggregates. Options:
- **Derive on read**: when rendering caller stats, aggregate the current user's completed hunts (called bonuses → X) + suggestion outcomes. Simple, no schema change, heavier read.
- **Aggregate doc** (recommended for the leaderboard angle): maintain `callers/{name}` → `{ gotIn, missed, plays: [X…] (or rolling summary) }`, updated when a suggestion is Added/Skipped and when a called bonus is opened. Enables an all-time caller leaderboard later. This is the cross-hunt piece the v1 `slot-caller-tracking` spec listed as out-of-scope — confirm scope before building the write path.

## Design Tokens (use `DESIGN.md`; values below are what the prototype ships)
**Brand register (GooferG):**
- Emerald (signal / positive / primary): `#10b981`, bright `#34d399`, haze `#064e3b`.
- Purple (community / gamba / decorative): `#a855f7`, bright `#c084fc`.
- Destructive red: `#ef4444` (loss, brick, Skip hover, Stop/Kill).
- Surfaces (prototype, tinted dark): bg `oklch(0.165 0.012 280)`, surface `oklch(0.195…)`, elevated `oklch(0.225…)`, border `oklch(0.32…)`. **In the repo use the `DESIGN.md` zinc scale** (`zinc-950/900/800`) on the `from-zinc-950 via-emerald-950 to-purple-950` body gradient — the prototype's emerald→purple tinted backdrop is the same intent.
- Text: `oklch(0.96…)` body, `oklch(0.72…)` dim, `oklch(0.54…)` faint → maps to `white`/`white/60`/`white/40` family.

**Type:** prototype uses Space Grotesk + JetBrains Mono. **Do NOT port the webfonts** — `DESIGN.md` forbids webfonts. Re-map to the system stack: display/headline/title/body → `ui-sans-serif, system-ui`; mono labels/values → `source-code-pro, Menlo, monospace`. Keep the weight discipline (300/400/700/900, no 500/600) and the **chyron rule** (uppercase, tracking-wider) on labels, eyebrows, pills, and stat labels.

**Radii / spacing:** tool surfaces use `rounded-lg` (12px) and 16px padding (the `/gamba` register), not the marketing `rounded-xl`. Stat/hero cards `rounded-lg`. Inputs `rounded-md`/`rounded-lg`.

**Elevation:** no box-shadow. Depth = tonal step-ups + the body gradient + (sparingly) glow. Modal/popover may use a soft shadow only as a last resort; prefer a tonal lift + border.

**Multiplier color thresholds:** 0x red · <20x neutral · 20–99x emerald · ≥100x filled-emerald. Form pips: win `≥20` emerald · ok `1–20` muted · brick `<1` red.

## Assets
- **Icons:** the prototype hand-rolls a small inline SVG stroke set. Replace with the repo's existing icon set / lucide.
- **Game avatars:** placeholder (striped square + initials). In production, wire to the existing `api/game-cover.js` cover art with the initials block as fallback.
- No raster assets are required from this bundle.

## Files in this bundle (design reference)
- `Hunt Tracker.html` — entry; loads React + Babel + the scripts below.
- `data.js` — seed data + stat math (`computeStats`, `computeCallerStats`, `squadWithSplit`, seed ledger & past hunts). **Read this for the exact algorithms.**
- `components.jsx` — shared UI (Icon set, money/X formatters, stat cards, buttons, type/multi badges).
- `app.jsx` — feature components (channel nav, bonus log + quick-add, squad split, viewer calls + popovers, caller stats, caller log drawer, opening flow, hunt history).
- `app-root.jsx` — header, stat grid, root state wiring, Tweaks panel.
- `styles.css` — full design system (tokens, brand register, every component).
- `tweaks-panel.jsx` — prototype-only Tweaks UI; **not for production**.

To run the reference locally: open `Hunt Tracker.html` in a browser (no build step).
