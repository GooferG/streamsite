# Spec A — Hunt Tracker redesign (layout + caller reputation)

**Date:** 2026-06-05
**Tool:** `/gamba` Hunt Tracker (CH 02) — `src/components/HuntTracker.js`
**Source of truth for visuals:** `docs/redesign/design_handoff_hunt_tracker/` (HTML/CSS/JSX prototype + `README.md`)
**Related:** Spec B — Collab (`2026-06-05-hunt-tracker-collab-design.md`) builds on this.

## Goal
Re-express the existing Hunt Tracker in the redesign's layout and hierarchy, **faithfully to the prototype**, while preserving every capability the repo already has (which exceeds the prototype on several axes). Adopt the one genuinely-new feature in the handoff: a **cross-hunt caller reputation layer**.

This spec is the **visual + stats** effort. It introduces **no data-model risk** — no Firestore rules changes, no cross-user writes. The only persistence additions are two additive fields on the existing hunt doc (`notes` per bonus, `skippedCalls[]` on the hunt).

## Non-negotiable: preserve existing capabilities
The current `HuntTracker.js` is ahead of the prototype. These MUST survive the redesign, folded **into** the new structure (not bolted beside it):

| Capability | Where it lives in the new layout |
|---|---|
| Drag-to-reorder (dnd-kit) | drag handle in the `#`/index column of the bonus table |
| Scatter tiers (regular/super/5-scatter + hidden modifier) | the **TYPE** column — `ScatterPill` replaces the prototype's flat TypeBadge |
| Deferred "Later" slots | row affordance + opening-order handling, as today |
| Hot-caller persistence (`callerHot`) | quick-add caller field keeps its 🔥 Hot toggle |
| Password-gated intake link (`HuntLinkControls`) | lives in the viewer-calls / collect surface |
| Stake sort lens (none→desc→asc) | bonus table BET header, as today |
| Coachmark tour (`HuntTour`), share/live mirror | header actions + share bar |
| Anon localStorage / logged-in Firestore split | unchanged (`useHuntStore`) |

If a prototype element and a repo capability conflict, **keep the repo capability** and house it in the prototype's visual slot.

## A1 — Layout reorganization
Recreate the handoff layout in Tailwind + repo tokens (`DESIGN.md`, `/gamba` register: emerald=signal/positive, purple=community, `rounded-lg`, 16px padding, no box-shadow, system font stack, chyron-uppercase labels). Do **not** port webfonts or the prototype's violet "studio" theme.

### Header row
Back/identity block (kicker + editable hunt name w/ pencil), right-aligned actions: **Resume/Start opening** (purple, primary mode switch), **Collab** (Spec B — present as disabled/"soon" placeholder in A), **Share** (existing share bar / popover), **Export split**, **Complete**, overflow `…` (tour replay + discard). Keep existing confirm-inline patterns for Complete/Discard.

### Stat grid (`360px 1fr`)
- **Hero P/L card** (left, 360px): `PROFIT / LOSS` label + pace chip (`BEHIND · need {avgReqRemaining} avg` / `AHEAD`), 52px tabular sign-tinted value (emerald +, red −), mono subline (`{totalWins} won · {start} start · {wlMultiplier} recovered`). Faint sign-tinted radial glow, no shadow. Values from existing `computeStats` (`profit ?? runningProfit`, `reqX`, `avgReqRemaining`, `wlMultiplier`).
- **Secondary 4-up grid** (right, `repeat(4,1fr)`, two rows): Bonuses (+ n pending), Start cost, Winnings, Avg req, Cur avg, Total X, Req X, Cur avg X — all already computed. Winnings + Cur-avg-X tint emerald when positive. Reuse `StatCell`, regrouped.
- Start/Finish balance inputs stay (in the grid or a compact sub-row).

### Work grid (`1.35fr 1fr`, align-start)
- **Left — Bonus list (panel `01`)**: header (`01` chip + "Bonus list" + "{opened}/{count} opened" + `OPENING` flag when mid-open). **Quick-add** block: `SlotAutocomplete` (slot) + bet, caller (+ 🔥 Hot), 3-way segmented type (Regular/Super/5-Scatter, with the hidden-5-scatter modifier surfacing on "five"), full-width **Log bonus** + `↵` kbd. Filter input appears when >5 logged (already conditional). **Bonus table** columns: `# (drag handle) | SLOT (name + provider · caller) | TYPE (ScatterPill) | BET | PAYOUT | MULTI | ✕`. Pending rows tinted amber w/ **Open** button in payout cell → inline payout input. Played rows show payout (click to edit) + color-graded `MultiTag` (0=red, <20=neutral, 20–99=emerald, ≥100=filled emerald). Footer: top multi · count left · "need $X avg to break even". `CappedScroll` + sticky header/totals stay.
- **Right column** (stack, `gap:16px`): **Squad split**, **Viewer calls**, **Soft banned**, **Caller stats (panel `05`)**.

### Squad split panel
Basis chip (winnings pool / net P/L), add row (name + in-for + `+`), table `MEMBER | IN FOR (inline edit) | SHARE % (purple) | PAYOUT (emerald)` + TOTAL footer. This is the existing gambler-split logic restyled. Basis = finishBalance-driven payout, as today.

### Soft banned panel
Keep as-is functionally (`bannedSlots` textarea), optionally restyle toward the prototype's chip list — **textarea is acceptable for v1**; chips are a nice-to-have.

### Opening mode (focus view) — A1 upgrade
Replace the inline current/next card with the prototype's **centered focus card** (`max-w-1040px`); stat grid stays pinned above.
- Bar: **Back to hunt**, `OPENING · n/total done`, hotkeys hint.
- Focus card: game avatar (initials placeholder; wire to `api/game-cover.js` cover art with initials fallback — cover art is a nice-to-have, initials ship), slot name + ScatterPill + meta (`provider · called by X · bonus i of n`), prev/next arrows.
- Fields row (`1fr 1fr 1fr`): **Bet** (read-only), **Payout** (focused `$` input), **Multiplier** (live, color-graded).
- **Notes** textarea → persists to a new `note` field on the bonus.
- Footer: Cancel · Next preview (avatar + next slot) · **Save & continue** (→ **Finish opening** on last, which opens the existing wrap-up modal).
- **Hotkeys**: Enter = save & next (ignored inside textarea), ←/→ = nav (saving current), Esc = exit. Keep existing deferred/"Later" handling in opening order.

### Responsive
Stat grid + work grid collapse to one column < 1180px; opening fields stack < 760px. Preserve existing mobile behavior of the broader tool.

## A2 — Caller reputation layer
Extend `computeCallerStats` in `src/utils/huntCalc.js` from current-hunt-only to **cross-hunt reputation**, sourced by **derive-on-read** (no new collection).

### Data sources (all already in memory or additive)
- **Current hunt** `bonuses[]` (with `caller`, stake, win).
- **Completed hunts** — the store's `history` array (`users/{uid}/hunts/*`), each with `bonuses[]`. Fold per-caller played X across history.
- **Skips** — new additive field `skippedCalls[]` on the hunt doc: `{ caller, slot, ts }` pushed when a viewer call is **Skipped**. Enables real accept-rate (gotIn vs missed). No rules change (writes via existing owner/`updateHunt` path).

### New `computeCallerStats(bonuses, history, skippedCalls)` →
```
{
  leaderboard: [{ name, calls, gotIn, missed, acceptRate, avgX, best, plays, form, status, hotStreak, coldStreak }],
  bestCall, worstCall,          // highest/lowest X among played called bonuses (current hunt)
  mostConsistent,               // highest avgX, min 2 plays
  hotCaller, coldCaller,
}
```
Rules (from handoff, thresholds kept adjustable in one place):
- Seed each caller from history (prior gotIn / played X), layer current hunt: non-empty `caller` ⇒ `gotIn += 1`; played (`stake>0 && win>0`) ⇒ push `X=win/stake`. `skippedCalls` ⇒ `missed += 1`.
- `calls = gotIn + missed`; `acceptRate = gotIn/calls`; `avgX = mean(X)`; `best = max(X)`; `plays = X.length`.
- `form` = last 5 X → `win` (≥20) / `ok` (1–20) / `brick` (<1).
- `hotStreak`/`coldStreak` = trailing run of X≥20 / X<1.
- `status`: `hot` if hotStreak≥2 OR (avgX≥25 && acceptRate≥0.6); `cold` if coldStreak≥2 OR (acceptRate<0.35 && calls≥3); else `steady`.
- Everything `null`/empty when no qualifying data (UI em-dash).
- **Backward-compat:** keep current return keys (`bestAvgCaller`) or update the one call site. Unit tests exist under `src/**/__tests__` for huntCalc — extend them.

### Caller-stats panel (`05`) UI
Header (`05` chip + "Caller stats" + n callers). Three highlight tiles: **On a heater** (hotCaller + avg + streak), **Best call** (emerald), **Brick of the hunt** (red). Table: `CALLER (rank + name link + status badge) | GOT IN (gotIn/calls, n missed) | FORM (pip strip) | AVG X (emerald ≥20, red <1)`. Footer names the coldest caller + accept rate. Name is a **link** → call-log drawer.

### Caller call-log drawer (modal)
Reuse the existing `Modal`. Trigger: any caller name (calls list, panel 05, history). Header: avatar + name + status + subline (`{gotIn} of {calls} made the hunt · {acceptRate}%`) + close. 4-up stat strip (Avg X, Best X, Skipped, Form). Section **This hunt · n in** (each called slot + multi tag, or "opening…"/"pending call"). Section **Prior hunts** (`{gotInPrev} in · {missedPrev} skipped · {plays} played · avg {x}`) — derived from `history`.

### Viewer calls — Add / Skip reconciliation
Reconcile the prototype's grouped Add/Skip with the existing `SuggestionsPanel` intake flow:
- **Group by caller** (prototype layout). Each call row: **Skip** (ghost→red; pushes to `skippedCalls[]`, removes the suggestion) + **Add** (promotes to a bonus via existing `startLanding`/`confirmLanding` stake prompt). Per-caller **Skip all**.
- Keep the password-gated intake link (`HuntLinkControls`) in the panel header popover.

## Target files
- `src/utils/huntCalc.js` — extend `computeCallerStats(bonuses, history, skippedCalls)` + reputation helpers; keep `computeStats`, `openingOrder`, `bestWorstSlot`.
- `src/components/HuntTracker.js` — relayout (header, stat grid w/ hero, work grid), opening focus mode + hotkeys + notes, panel 05, viewer-calls grouping, drawer wiring. This file is ~1850 lines; **extract** sub-surfaces into components to keep it navigable:
  - `HuntHero.js` (P/L hero card), `HuntStatGrid.js` (4-up), `BonusTable.js` (rows + DnD + scatter), `OpeningFocus.js` (focus card + hotkeys), `CallerStatsPanel.js` (panel 05), `CallerLogDrawer.js`, `ViewerCalls.js` (grouped Add/Skip). HuntTracker becomes the orchestrator holding store state.
- `src/components/HuntHistory.js` — caller name per row (link → drawer) + compact caller-stats block in the expand.
- `src/hooks/useHuntStore.js` — include `skippedCalls` in the hunt shape (additive; flows through existing `updateHunt`).
- Tests: extend huntCalc `__tests__` for reputation math.

## Out of scope (Spec A)
- Any cross-user write / collab (Spec B).
- Aggregate `callers/{name}` collection / all-time cross-owner leaderboard (future; derive-on-read chosen for v1).
- Game cover art in the avatar (initials fallback ships; cover art optional follow-up).

## Build order
1. `computeCallerStats` extension + tests (pure, no UI) — derisks the math first.
2. Component extraction of current behavior (no visual change) — safe refactor, keeps tests green.
3. Relayout into the redesign structure (hero, stat grid, work grid, panels).
4. Opening focus mode + hotkeys + notes.
5. Caller panel 05 + call-log drawer + history wiring.
6. Viewer-calls grouped Add/Skip + `skippedCalls[]`.
