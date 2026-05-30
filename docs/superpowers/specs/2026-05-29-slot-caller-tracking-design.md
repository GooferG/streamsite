# Slot Caller Tracking — Design

**Date:** 2026-05-29
**Status:** Approved (design)
**Components touched:** `src/utils/huntCalc.js`, `src/components/HuntTracker.js`, `src/components/HuntHistory.js`

## Goal

Let the streamer optionally attribute each logged bonus to a "slot caller" (the
community member who called that slot), then surface fun leaderboard-style stats:
how many slots each person called, the best call, the worst call ("brick of the
hunt"), and the most consistent caller. Builds a track record of the community's
calls across hunts.

## Decisions (from brainstorming)

- **Caller identity:** per-bonus `caller` string. Input is a combobox — a
  datalist of current squad-member names for quick pick, with free-typing any
  name allowed (chat callers who aren't squad members). Optional per bonus.
- **Editing:** caller editable on existing bonus rows (click-to-edit inline,
  same pattern as squad "in for" cells) so a missed caller can be assigned later.
- **Stats location:** a new "Caller stats" panel (`05`) in the active tracker,
  computed live. Also a compact version in the completed-hunt history expand.
- **Pay metric:** X multiplier (win ÷ stake) — fair across stake sizes.
- **Stats shown:** calls per person (leaderboard), best call, worst call
  (playful "brick of the hunt", red accent), best average caller.

## Data Model

Add an optional `caller` field to each bonus object:

```js
{ id, slot, stake, win, super, fiveScat, caller }
```

- `caller`: trimmed string, or `''`/absent when none.
- Persists through the existing `updateHunt({ bonuses })` path (Firestore for
  logged-in, localStorage for anon). No hook, rules, or export changes.
- Backward-compatible: old bonuses without `caller` read as caller-less.

## Stat Computation

New pure function in `src/utils/huntCalc.js`:

```js
computeCallerStats(bonuses) => {
  leaderboard,   // [{ caller, calls }] desc by calls, then name
  bestCall,      // { caller, slot, x } highest X among played called bonuses, or null
  worstCall,     // { caller, slot, x } lowest X among played called bonuses, or null
  bestAvgCaller, // { caller, avgX, calls } highest mean X (min 1 played call), or null
}
```

Rules:
- Only bonuses with a non-empty `caller` are considered.
- **leaderboard** counts ALL called bonuses (played or not) — "who called the
  most".
- **bestCall / worstCall / bestAvgCaller** consider only called bonuses that are
  *played* (`stake > 0 && win > 0`), so un-entered wins (0) don't all tie for
  worst or drag averages to zero. X = `win / stake`.
- `bestAvgCaller`: group played called bonuses by caller, mean their X, pick the
  highest; requires ≥1 played call to qualify.
- All return `null` when there's no qualifying data (empty/early hunt) — the UI
  shows an em dash.

## Input — add-bonus form

A caller combobox joins the add-bonus panel (after the 5-scat/super toggles,
before "Log bonus"):

- `<input list="hunt-callers" ...>` bound to a transient `callerInput` state.
- A `<datalist id="hunt-callers">` populated from current squad member names
  (`gamblers.map(g => g.name)`) — gives a dropdown of known names while still
  allowing free text.
- Optional. `addBonus()` includes `caller: callerInput.trim()` and resets the
  field after logging.

## Editing caller on existing rows

`SortableBonusRow` gains an inline-editable caller display:

- A small caller line/cell (e.g. under or beside the slot name) shows the caller
  name, or a faint "+ caller" affordance when empty.
- Click → becomes a text input (combobox with the same datalist) → blur/Enter
  saves via a new `updateBonusCaller(id, value)` handler → Escape cancels.
- Mirrors the existing `editingGamblerId` click-to-edit pattern; tracked with a
  new `editingCallerId` state.

## Caller stats panel (active tracker)

New panel `05` "Caller calls" in the right column (after Soft banned), purple
accent (community/squad register):

- **Leaderboard** — rows of `caller · N calls`, ranked desc. Shows the top
  callers; full list (it's small).
- **Best call** — emerald accent: `{slot} · {x}x · {caller}`.
- **Brick of the hunt** (worst call) — red accent, playful label:
  `{slot} · {x}x · {caller}`.
- **Most consistent** (best avg caller) — `{caller} · avg {x}x · N calls`.
- Each stat shows an em dash when its value is `null`.
- Computed via `computeCallerStats(bonuses)` on every render (cheap; list is
  small — no memo needed, consistent with how `gamblerRows` is computed).

## History (completed hunts)

`HuntHistory` expand gains:
- Caller name shown on each past bonus row (alongside the existing super/5-scat
  markers).
- A compact caller-stats block under the bonus/split tables: leaderboard +
  best call + brick of the hunt, using the same `computeCallerStats`.

## Edge Cases

- No callers entered → panel shows leaderboard empty state ("No calls tagged")
  and em dashes for best/worst/avg.
- Caller with only un-played bonuses → appears in leaderboard (call count) but
  not in best/worst/avg until a win is entered.
- Ties in best/worst X → first encountered wins (deterministic by list order);
  acceptable for a fun stat.
- Caller name casing/whitespace → trimmed on entry; names are compared as-is
  (so "Bob" and "bob" are distinct — acceptable; the datalist nudges consistency).

## Out of Scope (v1)

- Caller stats on the exported recap image (could add later).
- Cross-hunt aggregate leaderboards (all-time caller rankings across all hunts).
- Twitch-account-linked callers.
- Case-insensitive caller merging / fuzzy matching.

## Files

- `src/utils/huntCalc.js` — add `computeCallerStats(bonuses)`.
- `src/components/HuntTracker.js` — caller combobox in add form; `caller` in
  `addBonus`; `updateBonusCaller` + inline edit in `SortableBonusRow`; caller
  stats panel `05`; `callerInput` + `editingCallerId` state; datalist.
- `src/components/HuntHistory.js` — show caller per row; compact caller-stats
  block in expand.
