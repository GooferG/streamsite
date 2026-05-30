# Opening Slots Phase — Design

**Date:** 2026-05-30
**Status:** Approved (design)
**Component touched:** `src/components/HuntTracker.js` (+ minor `huntCalc.js` if needed)

## Goal

After all bonuses are logged, let the operator enter an "Opening" phase that
walks through each slot one at a time — showing the current slot and next up —
to enter payouts quickly (Enter advances), with the ability to defer a slot
("come back later", e.g. no-limit slots clicked down to 0) and revisit deferred
slots at the end.

## Decisions (from brainstorming)

- **Flow:** Collecting → Opening → Done. Opening is a distinct phase layered on
  the active hunt, not just a view toggle.
- **Stepping:** Enter on the payout input advances to the next slot; plus
  explicit Next/Prev buttons and click-any-row-to-jump.
- **Defer:** mark a slot deferred → skip it → after the last slot, loop back to
  deferred ones. Clear deferred badge in the list.
- **Opening UI:** large current-slot card + next-up preview + full list below
  with progress (opened / total).
- **Editing:** payouts only during opening (defer/skip + win entry). Add/remove/
  restake requires going "back to collecting".
- **Persistence:** `phase` + `openingIndex` + per-bonus `deferred` persist in the
  hunt doc, so refresh / second device resumes exactly.

## Data Model

Hunt doc gains:
- `phase`: `'collecting'` (default) | `'opening'`. Absent = `'collecting'`
  (backward-compatible).
- `openingIndex`: number — index into the *opening order* of the current slot.
  Default 0.

Each bonus gains:
- `deferred`: boolean — "come back later". Default false/absent.

All persist through the existing `updateHunt` path (Firestore + local). Old
hunts without these read as collecting / not-deferred.

## Opening Order & Navigation

The opening walks bonuses in their saved list order, but **deferred slots are
visited last**:

```
openingOrder = [...nonDeferred in list order, ...deferred in list order]
```

- `openingIndex` points into `openingOrder`.
- "Current slot" = `openingOrder[openingIndex]`. "Next up" =
  `openingOrder[openingIndex + 1]` (or none if last).
- **Advance** (Enter / Next): save current win, `openingIndex++` (clamp to last).
- **Prev:** `openingIndex--` (clamp to 0). Does not unsave.
- **Jump:** clicking a row sets `openingIndex` to that bonus's position in
  `openingOrder`.
- **Defer current:** set the current bonus's `deferred = true`. Because
  `openingOrder` recomputes, the deferred slot moves to the tail; `openingIndex`
  stays (now points at what was the next slot). The deferred slot is revisited
  when the index reaches the tail.
- **Un-defer:** clicking a deferred row (or a small control) clears `deferred`.

Progress = count of bonuses with a win entered (`win > 0`) vs total, shown as
"N / M opened". (Win entry is the signal a slot is "done".)

## UI

### Collecting phase (existing tracker + one button)

- Everything as today (add/edit/remove bonuses, stakes, markers, callers,
  financials, squad, banned, slot calls).
- New **"Start opening"** button in the hunt header (enabled when
  `bonuses.length > 0`). Sets `phase = 'opening'`, `openingIndex = 0`.

### Opening phase

Replaces the left "Bonus list" editing column with an opening view; the right
column (financials / squad / banned / slot calls) stays visible (read-context).

- **Current slot card** (large): slot name, stake, super/5-scat markers, caller.
  A focused **win input** (autoFocus). Enter → save + advance.
  - Buttons: **Prev**, **Next**, **Defer ("come back later")**, and the win
    input.
- **Next-up preview**: smaller card with the next slot's name/stake (or "last
  slot" when none).
- **Bonus list** below: same rows, read-only for stakes/markers, with:
  - current row highlighted,
  - deferred rows badged ("LATER", orange) and clickable to jump/un-defer,
  - per-row win still editable inline (so you can fix an earlier entry),
  - progress header "N / M opened".
- **Header buttons:** "Back to collecting" (sets `phase = 'collecting'`),
  "Export split", "Complete" (existing flow). Complete works from either phase.

## Edge Cases

- Start opening with all-deferred or empty → guarded: "Start opening" disabled
  when no bonuses. Deferring every slot still leaves them in `openingOrder` (tail
  ordering is stable), so navigation never breaks.
- `openingIndex` out of range after removing bonuses in collecting → clamp on
  read (`Math.min(openingIndex, openingOrder.length - 1)`).
- Refresh mid-opening → `phase`/`openingIndex`/`deferred` restored from the hunt
  doc; resumes on the same slot.
- Complete during opening → archives as today; phase fields go with the snapshot
  (harmless in history).
- Backward-compat: hunts created before this read as `collecting`, no deferred.

## Out of Scope (v1)

- Reordering during opening (do it in collecting).
- Auto-advance skipping already-won slots (kept simple: linear with manual jump).
- Per-defer note field (decided: skip + revisit only).

## Files

- `src/components/HuntTracker.js` — phase state machine, opening view, current/
  next cards, defer logic, "Start opening" / "Back to collecting" buttons.
- `src/utils/huntCalc.js` — (optional) a small `openingOrder(bonuses)` helper if
  it keeps the component clean.
