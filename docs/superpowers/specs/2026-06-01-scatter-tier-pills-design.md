# Scatter Tier Pills + Add-Bonus Ergonomics — Design

**Date:** 2026-06-01
**Status:** Approved (pending written-spec review)
**Component(s):** `HuntTracker`, `SlotAutocomplete`, `LiveHuntPage`, `HuntHistory`, `AdminCommunityHuntsPage`

This spec bundles three related improvements to the bonus tracker, all centered on the
add-bonus flow:

1. **Scatter tier pills** — replace cryptic `S`/star markers with readable labels.
2. **Refocus slot input after logging a bonus** — keep the keyboard on the slot field.
3. **Rename "Stake" → "Bet"** in all viewer-facing labels.

---

## Part 1 — Scatter Tier Pills

### Problem

The bonus tracker marks special bonuses with two terse, non-obvious glyphs: an orange
`S` pill ("super") and a bare gold star ("5-scatter"). Viewers and the streamer can't
tell at a glance what they mean. We want labels that read in current slot-meta terms —
`SUPER`, `5 SCATTER`, and the rare `HIDDEN 5 SCATTER` — so the markers are self-explanatory.

## Decisions (locked with user)

- **Tier is a single exclusive choice per bonus:** `regular` / `super` / `5 scatter`.
- **`hidden` is a real, separate boolean flag** that modifies *only* the 5-scatter tier.
  ("Hidden 5 Scatter" = the rarest event.)
- **No Firestore migration.** Keep the existing `super` and `fiveScat` booleans in
  storage; add one new `hidden` boolean. The tier is *derived* at render time, so all
  previously-saved hunts read correctly with zero data changes.
- **Precedence when old data has both flags set:** `5 scatter` wins (`fiveScat` checked
  before `super`). The UI input is exclusive, so new bonuses can't set both.
- **`hidden` input visibility:** the Hidden toggle appears *only* when 5-Scatter is the
  selected tier. It resets when the tier changes away from 5-scatter.
- **Dense table rows abbreviate** the long label: `HIDDEN 5 SCATTER` → `HID 5★`.
  The big opening-phase card uses full text.
- **`HIDDEN 5★` gets a "shocking" treatment:** solid gold fill, dark text, animated
  pulsing glow halo — distinct from the calm gold-outline `5 SCATTER`. Honors
  `prefers-reduced-motion: reduce` by falling back to a static glow (no animation).
  Stays inside the existing gold/orange palette (no new colors).

## Data model

Each bonus object gains one field; the two existing fields are unchanged in storage:

```
{ id, slot, stake, win, super, fiveScat, hidden, caller }
                          ^^^^^^^^^^^^^^  ^^^^^^
                          existing        new boolean (default false)
```

- `super: boolean` — super tier (existing).
- `fiveScat: boolean` — 5-scatter tier (existing).
- `hidden: boolean` — NEW. Only meaningful when `fiveScat` is true; inert otherwise.
- A "regular" bonus has all three false.

Defaults: `addBonus` and `startLanding` set `hidden: false` alongside the existing
`super`/`fiveScat` defaults.

## Derivation helper — `src/utils/scatterTier.js`

Single source of truth for tier + label, so all five render sites agree:

```js
// Returns null for a regular bonus, or a tier descriptor.
export function scatterTier(b) {
  if (b?.fiveScat) {
    return {
      key: 'five',
      hidden: !!b.hidden,
      full: b.hidden ? 'HIDDEN 5 SCATTER' : '5 SCATTER',
      short: b.hidden ? 'HID 5★' : '5 SCAT',
      tone: 'gold',
    };
  }
  if (b?.super) {
    return { key: 'super', hidden: false, full: 'SUPER', short: 'SUPER', tone: 'orange' };
  }
  return null;
}
```

`5 scatter` precedence is enforced by checking `fiveScat` first. (Includes a small unit
test under `src/utils/__tests__/scatterTier.test.js` — pure function, matches the repo's
existing `__tests__` convention.)

## Presentational component — `src/components/ScatterPill.js`

```
<ScatterPill bonus={b} size="sm" />   // sm = dense rows (short label)
<ScatterPill bonus={b} size="md" />   // md = opening card (full label)
```

- Calls `scatterTier(bonus)`; renders nothing if it returns `null` (regular bonus).
- `size="sm"` uses `short`; `size="md"` uses `full`.
- Reuses the established pill classes already on the `S` / `Later` badges:
  `font-bold tracking-eyebrow-md uppercase font-mono border leading-none` with
  `text-[8px]`/`text-[9px]` per size.
- **Tone styling:**
  - `super` → orange outline: `border-orange-admin/60 text-orange-admin` (matches old S pill).
  - `5 scatter` (not hidden) → calm gold outline: `border-gold-scatter/60 text-gold-scatter`.
  - `hidden 5 scatter` → **shocking:** solid fill `bg-gold-scatter text-zinc-broadcast`
    (dark text on gold), plus a pulsing glow halo via a scoped `<style jsx>` block.
- **Motion:** scoped keyframe (e.g. `scatter-hidden-pulse`) animating `box-shadow`/glow.
  Wrapped so that `@media (prefers-reduced-motion: reduce)` disables the animation and
  leaves a static glow — mirrors the pattern in `StatsTicker.js` / `GambaPage.js`.
- Color tokens (confirmed in `tailwind.config.js`): `gold-scatter` `#fbbf24`,
  `orange-admin` `#f97316`, `zinc-broadcast` `#09090b`.

## Input — add-bonus form (HuntTracker)

Replace the two independent toggle `<button>`s (`HuntTracker.js` ~1241–1280) with a
**3-way segmented control**: `Regular` / `Super` / `5 Scatter` (exclusive).

- Replace input state `superInput`/`fiveScatInput` (booleans) with a single
  `tierInput` state (`'regular' | 'super' | 'five'`, default `'regular'`) plus a
  `hiddenInput` boolean (default false).
- When `5 Scatter` is selected, render a small `Hidden` checkbox/toggle beside the
  control. Selecting any other tier hides it and forces `hiddenInput = false`.
- `addBonus` maps `tierInput` → the stored booleans:
  `super: tierInput === 'super'`, `fiveScat: tierInput === 'five'`,
  `hidden: tierInput === 'five' && hiddenInput`. Resets all three input states after add.
- Active-segment styling matches existing toggles: super → `orange-admin`,
  5-scatter → `gold-scatter`. Keyboard-navigable (it's a set of `<button>`s with
  `aria-pressed`, same as today).

## Display sites — swap to `<ScatterPill>`

All inline `super`/`fiveScat` rendering is replaced by `<ScatterPill>`:

| File | Lines (approx) | Size |
|------|----------------|------|
| `HuntTracker.js` — row marker | 149–184 | `sm` |
| `HuntTracker.js` — opening current bonus | 1099–1110 | `md` |
| `LiveHuntPage.js` — current bonus | 188–199 | `md` |
| `LiveHuntPage.js` — table row | 268–273 | `sm` |
| `HuntHistory.js` — row | 160–165 | `sm` |
| `AdminCommunityHuntsPage.js` — row | 67–72 | `sm` |

Note: the row marker in `HuntTracker.js` is currently *two clickable toggles* (an S
button and a star button, each flipping one boolean via `toggleBonusMarker(id, key)`).
This is replaced by a single clickable pill that **cycles the tier**
regular → super → five → regular on click. To keep the booleans mutually exclusive,
`toggleBonusMarker` is replaced by `setBonusTier(id, tier)` which sets all three
booleans atomically (`super`/`fiveScat` per the tier, `hidden` reset to false on any
tier change). A separate small affordance toggles `hidden` when the row is already at the
five tier (e.g. shift-click or a tiny adjacent toggle — implementer's choice, keep it
keyboard-reachable). The other four sites are read-only and render a static
`<ScatterPill>`. The `onToggleMarker` prop on `SortableBonusRow` is renamed/repointed to
`onSetTier` accordingly.

The `Star` import is removed from files where it's now unused
(`HuntHistory.js`, `AdminCommunityHuntsPage.js`, and the read-only `LiveHuntPage` sites
if not used elsewhere — verify per file before removing).

## Drive-by fix

`HuntHistory.js:164` and `AdminCommunityHuntsPage.js:71` currently render the star with
the stale `fill-yellow-400 text-yellow-400` (the rest of the app moved to `gold-scatter`).
Folding them into `<ScatterPill>` removes the drift automatically — no separate change.

---

## Part 2 — Refocus slot input after logging a bonus

### Problem

After logging a bonus (clicking "Log bonus" or pressing Enter), keyboard focus is lost.
The streamer is logging bonuses rapidly during a hunt and wants to type the next slot
name immediately without reaching for the mouse.

### Behavior

After `addBonus()` succeeds, return keyboard focus to the slot-name field. Field
clearing on add:

- **Slot** — always cleared (existing).
- **Bet** (the `stakeInput`) — always cleared (existing).
- **Caller** — cleared **unless** the "caller is hot" toggle is ON (see below).

### "Caller is hot" sticky toggle

A small toggle in the add-bonus form, adjacent to the caller input. Semantics:

- **OFF (default):** caller clears after each add, like today.
- **ON:** the caller value persists across adds — useful when one person is calling
  several slots in a row. The streamer types the caller once, flips it hot, and only
  edits slot + bet for each subsequent bonus.
- **Session-scoped, not persisted.** It's a transient `callerHot` boolean in component
  state (like the other `*Input` state); not written to Firestore, resets on reload.
- Visual register matches the existing form toggles (orange/emerald active state, mono
  uppercase micro-label). Keyboard-reachable `<button aria-pressed>`.

### Implementation — focus mechanics

`SlotAutocomplete` currently does not expose its inner `<input>` (it only accepts
`autoFocus`). Add ref forwarding:

- Convert `SlotAutocomplete` to `forwardRef` + `useImperativeHandle` exposing a
  `focus()` method that calls `.focus()` on the inner input. (Preferred over leaking an
  `inputRef` prop — keeps the component's surface clean and reusable.)
- In `HuntTracker`, create a `slotRef` and pass it to `<SlotAutocomplete ref={slotRef} />`.
- At the end of `addBonus()`, after clearing inputs, call `slotRef.current?.focus()`.
  The existing `autoFocus` on first mount stays.
- `addBonus` caller-clear becomes conditional: `if (!callerHot) setCallerInput('')`.

This focus path serves both the "Log bonus" button click and the Enter-key handlers
already wired on all three inputs (they all call `addBonus()`).

---

## Part 3 — Rename "Stake" → "Bet" (viewer-facing labels only)

### Scope

Rename every **visible** "Stake" string to "Bet". The internal data field stays
`stake` — it's referenced by sort logic, exports, recap/split, and the share data shape,
and renaming it would be a risky, unrelated data-layer change. **Labels only, never the
field name or object keys.**

Visible strings to change (verify exact text at edit time — line numbers drift):

| File | Location | Current | New |
| --- | --- | --- | --- |
| `HuntTracker.js` | add-form input placeholder (~1221) | `Stake ($)` | `Bet ($)` |
| `HuntTracker.js` | row stake `aria-label` (~240) | `Stake` | `Bet` |
| `HuntTracker.js` | bonus-list column header (~1306, ~1324) | `Stake` | `Bet` |
| `HuntTracker.js` | stake-sort `title` tooltips (~1313–1315) | `Sort by stake …` | `Sort by bet …` |
| `HuntTracker.js` | opening-card line (~1121) | `stake {amount}` | `bet {amount}` |
| `LiveHuntPage.js` | any "Stake" table header / label | `Stake` | `Bet` |
| `HuntHistory.js` | any "Stake" table header / label | `Stake` | `Bet` |
| `AdminCommunityHuntsPage.js` | any "Stake" table header / label | `Stake` | `Bet` |

Also rename the stake-prompt label when promoting a suggestion (`landStakeInput`'s
visible label, ~1728 "Bonus landed — add to hunt" panel) if it shows "Stake".

**Do NOT rename:** `stake` object keys, `stakeInput`/`landStakeInput`/`bonusSort`
`'stake-asc'`/`'stake-desc'` state values, `onStake`/`updateBonusStake` handlers,
`totalStakes`, or any IGDB/Firestore field. Internal-only identifiers are untouched.

---

## Files

**New:**
- `src/utils/scatterTier.js`
- `src/utils/__tests__/scatterTier.test.js`
- `src/components/ScatterPill.js`

**Edited:**
- `src/components/HuntTracker.js` — (P1) tier segmented control + hidden toggle, 2 pill render sites, `addBonus`/`startLanding` defaults, tier-cycling row click, input state; (P2) `slotRef` + refocus in `addBonus`, `callerHot` toggle + conditional caller clear; (P3) "Stake"→"Bet" labels.
- `src/components/SlotAutocomplete.js` — (P2) `forwardRef` + `useImperativeHandle` exposing `focus()`.
- `src/pages/LiveHuntPage.js` — (P1) 2 pill render sites; (P3) labels.
- `src/components/HuntHistory.js` — (P1) 1 pill render site; (P3) labels.
- `src/pages/AdminCommunityHuntsPage.js` — (P1) 1 pill render site; (P3) labels.

## Testing / verification

- **P1** `scatterTier` unit test: regular → null; super → SUPER; fiveScat → 5 SCATTER;
  fiveScat+hidden → HIDDEN 5 SCATTER / HID 5★; both flags → 5-scatter wins.
- `npm run build` clean.
- `npm start`: open a hunt and exercise all three:
  - **P1** — log bonuses of each tier; confirm pills render in the row, opening card,
    and (via share) live page + history + admin. Hidden toggle only appears for
    5-Scatter; the hidden pill pulses and goes static under OS reduced-motion.
  - **P2** — after logging a bonus (button and Enter), focus is back on the slot field;
    type the next slot with no mouse. With "caller is hot" OFF the caller clears; with
    it ON the caller persists across adds; slot + bet always clear.
  - **P3** — no visible "Stake" text remains in the tracker, add-form, opening card,
    sort tooltips, or the live/history/admin tables; sorting by bet still works
    (internal `stake` field unchanged).

## Out of scope

- No change to Firestore documents, export/recap/split logic, or the share data shape
  beyond the additive `hidden` field.
- No rename of the internal `stake` data field or any `*-stake` state/handler identifier
  (P3 is viewer-facing labels only).
- The `callerHot` toggle is session-only — not persisted per-hunt.
- No new palette colors.
