# Scatter Tier Pills + Add-Bonus Ergonomics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace cryptic `S`/star bonus markers with readable scatter-tier pills (`SUPER` / `5 SCATTER` / shocking `HIDDEN 5★`), refocus the slot input after logging a bonus (with a sticky "caller is hot" toggle), and rename viewer-facing "Stake" labels to "Bet".

**Architecture:** A pure `scatterTier(bonus)` helper derives a single tier + labels from the existing `super`/`fiveScat` booleans plus a new additive `hidden` boolean — no Firestore migration. A presentational `<ScatterPill>` component renders the tier consistently across all five sites. `SlotAutocomplete` gains `forwardRef` so `HuntTracker` can refocus the slot field after `addBonus()`. "Stake"→"Bet" is a labels-only rename; the internal `stake` field and all `*-stake` identifiers stay.

**Tech Stack:** React 19, CRA/react-scripts, Jest (react-scripts), Tailwind, lucide-react icons.

**Spec:** [docs/superpowers/specs/2026-06-01-scatter-tier-pills-design.md](../specs/2026-06-01-scatter-tier-pills-design.md)

---

## File Structure

**New files:**
- `src/utils/scatterTier.js` — pure helper: `scatterTier(bonus)` → tier descriptor or `null`.
- `src/utils/__tests__/scatterTier.test.js` — unit tests for the helper.
- `src/components/ScatterPill.js` — presentational pill, calls `scatterTier`, renders tone + size variants incl. the animated hidden-5 glow.

**Modified files:**
- `src/components/SlotAutocomplete.js` — `forwardRef` + `useImperativeHandle({ focus })`.
- `src/components/HuntTracker.js` — tier segmented control + hidden toggle, pill render sites, `setBonusTier`, refocus + `callerHot` in `addBonus`, `startLanding`/`addBonus` defaults, "Stake"→"Bet" labels.
- `src/pages/LiveHuntPage.js` — pill render sites (2), "Stake"/"staked" labels.
- `src/components/HuntHistory.js` — pill render site (1), "Stake" header.
- `src/pages/AdminCommunityHuntsPage.js` — pill render site (1), "Stake" header.

---

## Part 1 — Scatter Tier Pills

### Task 1: `scatterTier` helper + tests

**Files:**
- Create: `src/utils/scatterTier.js`
- Test: `src/utils/__tests__/scatterTier.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/utils/__tests__/scatterTier.test.js`:

```js
import { scatterTier } from '../scatterTier';

describe('scatterTier', () => {
  it('returns null for a regular bonus', () => {
    expect(scatterTier({})).toBeNull();
    expect(scatterTier({ super: false, fiveScat: false })).toBeNull();
    expect(scatterTier(null)).toBeNull();
  });

  it('returns the super tier', () => {
    const t = scatterTier({ super: true });
    expect(t.key).toBe('super');
    expect(t.full).toBe('SUPER');
    expect(t.short).toBe('SUPER');
    expect(t.tone).toBe('orange');
    expect(t.hidden).toBe(false);
  });

  it('returns the five-scatter tier (not hidden)', () => {
    const t = scatterTier({ fiveScat: true });
    expect(t.key).toBe('five');
    expect(t.full).toBe('5 SCATTER');
    expect(t.short).toBe('5 SCAT');
    expect(t.tone).toBe('gold');
    expect(t.hidden).toBe(false);
  });

  it('returns the hidden five-scatter tier', () => {
    const t = scatterTier({ fiveScat: true, hidden: true });
    expect(t.key).toBe('five');
    expect(t.full).toBe('HIDDEN 5 SCATTER');
    expect(t.short).toBe('HID 5★');
    expect(t.tone).toBe('gold');
    expect(t.hidden).toBe(true);
  });

  it('lets five-scatter win when both legacy flags are set', () => {
    const t = scatterTier({ super: true, fiveScat: true });
    expect(t.key).toBe('five');
  });

  it('ignores hidden on a non-five bonus', () => {
    const t = scatterTier({ super: true, hidden: true });
    expect(t.key).toBe('super');
    expect(t.hidden).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --watchAll=false --testPathPattern=scatterTier`
Expected: FAIL — `Cannot find module '../scatterTier'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/utils/scatterTier.js`:

```js
// Derives a single exclusive scatter tier from a bonus's legacy booleans.
// Storage keeps `super` + `fiveScat` (+ additive `hidden`); the tier is derived
// here so all render sites agree and no Firestore migration is needed.
// Five-scatter wins when both legacy flags are set on old data.
export function scatterTier(b) {
  if (b && b.fiveScat) {
    const hidden = !!b.hidden;
    return {
      key: 'five',
      hidden,
      full: hidden ? 'HIDDEN 5 SCATTER' : '5 SCATTER',
      short: hidden ? 'HID 5★' : '5 SCAT',
      tone: 'gold',
    };
  }
  if (b && b.super) {
    return { key: 'super', hidden: false, full: 'SUPER', short: 'SUPER', tone: 'orange' };
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --watchAll=false --testPathPattern=scatterTier`
Expected: PASS — 6 passing.

- [ ] **Step 5: Commit**

```bash
git add src/utils/scatterTier.js src/utils/__tests__/scatterTier.test.js
git commit -m "feat: add scatterTier helper for bonus tier derivation"
```

---

### Task 2: `<ScatterPill>` component

**Files:**
- Create: `src/components/ScatterPill.js`

The hidden-5 pill needs an animated glow that respects reduced motion. The codebase
convention is a scoped `<style jsx>` block per component plus a
`@media (prefers-reduced-motion: reduce)` override (see `src/components/StatsTicker.js`
lines ~166-172). Mirror that.

- [ ] **Step 1: Write the component**

Create `src/components/ScatterPill.js`:

```js
import { scatterTier } from '../utils/scatterTier';

// Presentational tier pill. Renders nothing for a regular bonus.
// size="sm" → dense rows (short label); size="md" → opening card (full label).
export default function ScatterPill({ bonus, size = 'sm' }) {
  const tier = scatterTier(bonus);
  if (!tier) return null;

  const text = size === 'md' ? tier.full : tier.short;
  const base =
    'shrink-0 inline-flex items-center font-bold tracking-eyebrow-md uppercase font-mono border leading-none';
  const pad = size === 'md' ? 'px-1.5 py-0.5 text-[9px]' : 'px-1 py-0.5 text-[8px]';

  if (tier.tone === 'orange') {
    return (
      <span className={`${base} ${pad} border-orange-admin/60 text-orange-admin`}>
        {text}
      </span>
    );
  }

  // gold — 5 scatter
  if (!tier.hidden) {
    return (
      <span className={`${base} ${pad} border-gold-scatter/60 text-gold-scatter`}>
        {text}
      </span>
    );
  }

  // hidden 5 scatter — shocking: solid gold fill, dark text, pulsing glow halo.
  return (
    <span
      className={`scatter-hidden-pulse ${base} ${pad} border-gold-scatter bg-gold-scatter text-zinc-broadcast`}
    >
      {text}
      <style jsx>{`
        .scatter-hidden-pulse {
          box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.7);
          animation: scatter-hidden-pulse 1.4s ease-in-out infinite;
        }
        @keyframes scatter-hidden-pulse {
          0% {
            box-shadow: 0 0 4px 1px rgba(251, 191, 36, 0.5);
          }
          50% {
            box-shadow: 0 0 12px 4px rgba(251, 191, 36, 0.9);
          }
          100% {
            box-shadow: 0 0 4px 1px rgba(251, 191, 36, 0.5);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .scatter-hidden-pulse {
            animation: none;
            box-shadow: 0 0 8px 2px rgba(251, 191, 36, 0.7);
          }
        }
      `}</style>
    </span>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: build completes with no errors referencing `ScatterPill`. (Warnings about
unused vars elsewhere are pre-existing.)

- [ ] **Step 3: Commit**

```bash
git add src/components/ScatterPill.js
git commit -m "feat: add ScatterPill component with hidden-5 glow"
```

---

### Task 3: Swap read-only render sites to `<ScatterPill>`

These four sites are read-only displays. Replace the inline `super`/`fiveScat` markup
with `<ScatterPill>` and remove now-unused `Star` imports.

**Files:**
- Modify: `src/pages/LiveHuntPage.js` (current bonus ~188-199, table row ~268-273)
- Modify: `src/components/HuntHistory.js` (row ~160-165)
- Modify: `src/pages/AdminCommunityHuntsPage.js` (row ~67-72)

- [ ] **Step 1: LiveHuntPage — add import**

In `src/pages/LiveHuntPage.js`, add near the other imports:

```js
import ScatterPill from '../components/ScatterPill';
```

- [ ] **Step 2: LiveHuntPage — replace current-bonus markers (~188-199)**

Replace:

```jsx
                  {currentBonus.super && (
                    <span className="shrink-0 px-1 py-0.5 text-[9px] font-bold tracking-eyebrow-md uppercase font-mono border border-orange-admin/60 text-orange-admin leading-none">
                      S
                    </span>
                  )}
                  {currentBonus.fiveScat && (
                    <Star
                      size={18}
                      aria-label="5 scatter"
                      className="shrink-0 fill-gold-scatter text-gold-scatter"
                    />
                  )}
```

With:

```jsx
                  <ScatterPill bonus={currentBonus} size="md" />
```

- [ ] **Step 3: LiveHuntPage — replace table-row markers (~268-273)**

Replace:

```jsx
                                  {b.super && (
                                    <span className="shrink-0 px-1 py-0.5 text-[8px] font-bold tracking-eyebrow-md uppercase font-mono border border-orange-admin/60 text-orange-admin leading-none">S</span>
                                  )}
                                  {b.fiveScat && (
                                    <Star size={11} aria-label="5 scatter" className="shrink-0 fill-gold-scatter text-gold-scatter" />
                                  )}
```

With:

```jsx
                                  <ScatterPill bonus={b} size="sm" />
```

- [ ] **Step 4: LiveHuntPage — drop the `Star` import if now unused**

Search the file for remaining `Star` / `<Star`. If none remain, remove `Star` from the
`lucide-react` import. If other usages remain, leave the import.

Run: `git grep -n "Star" src/pages/LiveHuntPage.js`
Expected after edits: only the import line (if any other usage) — if the only hits were
the two you replaced, delete `Star` from the import.

- [ ] **Step 5: HuntHistory — add import + replace markers (~160-165)**

In `src/components/HuntHistory.js` add:

```js
import ScatterPill from './ScatterPill';
```

Replace:

```jsx
                            {b.super && (
                              <span className="shrink-0 px-1 py-0.5 text-[8px] font-bold tracking-eyebrow-md uppercase font-mono border border-orange-admin/60 text-orange-admin leading-none">S</span>
                            )}
                            {b.fiveScat && (
                              <Star size={11} aria-label="5 scatter" className="shrink-0 fill-yellow-400 text-yellow-400" />
                            )}
```

With:

```jsx
                            <ScatterPill bonus={b} size="sm" />
```

(This also fixes the stale `fill-yellow-400`.) Then remove the `Star` import if unused:
`git grep -n "Star" src/components/HuntHistory.js`.

- [ ] **Step 6: AdminCommunityHuntsPage — add import + replace markers (~67-72)**

In `src/pages/AdminCommunityHuntsPage.js` add:

```js
import ScatterPill from '../components/ScatterPill';
```

Replace:

```jsx
                        {b.super && (
                          <span className="shrink-0 px-1 py-0.5 text-[8px] font-bold tracking-eyebrow-md uppercase font-mono border border-orange-admin/60 text-orange-admin leading-none">S</span>
                        )}
                        {b.fiveScat && (
                          <Star size={11} aria-label="5 scatter" className="shrink-0 fill-yellow-400 text-yellow-400" />
                        )}
```

With:

```jsx
                        <ScatterPill bonus={b} size="sm" />
```

Then remove the `Star` import if unused:
`git grep -n "Star" src/pages/AdminCommunityHuntsPage.js`.

- [ ] **Step 7: Verify build**

Run: `npm run build`
Expected: clean build, no "Star is not defined" or unused-import errors.

- [ ] **Step 8: Commit**

```bash
git add src/pages/LiveHuntPage.js src/components/HuntHistory.js src/pages/AdminCommunityHuntsPage.js
git commit -m "feat: render scatter pills on live/history/admin bonus rows"
```

---

### Task 4: HuntTracker — pill render sites + tier-cycling row

**Files:**
- Modify: `src/components/HuntTracker.js` (import; row marker ~149-184; opening current bonus ~1099-1110; `toggleBonusMarker` ~472-477; row props ~1371; `SortableBonusRow` signature ~88-95)

- [ ] **Step 1: Add the import**

Near the top of `src/components/HuntTracker.js`, with the other component imports:

```js
import ScatterPill from './ScatterPill';
```

- [ ] **Step 2: Replace `toggleBonusMarker` with `setBonusTier`**

Replace (lines ~472-477):

```js
  // Toggle a boolean marker ('super' | 'fiveScat') on an existing bonus.
  function toggleBonusMarker(id, key) {
    updateHunt({
      bonuses: bonuses.map((b) => (b.id === id ? { ...b, [key]: !b[key] } : b)),
    });
  }
```

With:

```js
  // Set the exclusive scatter tier on an existing bonus. tier ∈ 'regular'|'super'|'five'.
  // Keeps the legacy booleans mutually exclusive and resets `hidden` on any tier change.
  function setBonusTier(id, tier) {
    updateHunt({
      bonuses: bonuses.map((b) =>
        b.id === id
          ? { ...b, super: tier === 'super', fiveScat: tier === 'five', hidden: false }
          : b
      ),
    });
  }
  // Toggle the `hidden` modifier (only meaningful on a five-scatter bonus).
  function toggleBonusHidden(id) {
    updateHunt({
      bonuses: bonuses.map((b) =>
        b.id === id ? { ...b, hidden: b.fiveScat ? !b.hidden : false } : b
      ),
    });
  }
```

- [ ] **Step 3: Update `SortableBonusRow` props destructuring (~88-95)**

In the `SortableBonusRow` function signature, replace the `onToggleMarker` prop with
`onSetTier` and `onToggleHidden`. Find the destructured props object (around line 88-108)
and replace `onToggleMarker,` with:

```js
  onSetTier,
  onToggleHidden,
```

- [ ] **Step 4: Replace the row's two marker buttons (~149-184) with a tier-cycling pill**

Replace the whole block from the `{/* Super — common, first... */}` comment through the
closing `</button>` of the 5-scat star (lines ~149-184) with:

```jsx
          {/* Tier pill — click cycles regular → super → five → regular.
              Shift-click toggles the hidden modifier when already at five. */}
          <button
            type="button"
            onClick={(e) => {
              const tier = scatterTierKey(bonus);
              if (e.shiftKey && tier === 'five') {
                onToggleHidden(bonus.id);
                return;
              }
              const nextTier =
                tier === 'regular' ? 'super' : tier === 'super' ? 'five' : 'regular';
              onSetTier(bonus.id, nextTier);
            }}
            title="Click: cycle tier (regular → super → 5 scatter). Shift-click on 5 scatter: toggle hidden."
            className="shrink-0 leading-none"
          >
            {scatterTierKey(bonus) === 'regular' ? (
              <span className="px-1 py-0.5 text-[8px] font-bold tracking-eyebrow-md uppercase font-mono border border-white/15 text-white/30 hover:text-white/60 hover:border-white/30 leading-none">
                tier
              </span>
            ) : (
              <ScatterPill bonus={bonus} size="sm" />
            )}
          </button>
```

- [ ] **Step 5: Add the `scatterTierKey` import**

The row needs the current tier key. Add a tiny named helper to `scatterTier.js` and import
it. First append to `src/utils/scatterTier.js`:

```js
// Convenience: the tier as a plain cycle key, including 'regular'.
export function scatterTierKey(b) {
  const t = scatterTier(b);
  return t ? t.key : 'regular';
}
```

Then in `HuntTracker.js`, change the import to:

```js
import { scatterTierKey } from '../utils/scatterTier';
```

(Place it with the other `../utils/*` imports. `ScatterPill` import from Step 1 stays.)

- [ ] **Step 6: Add a unit test for `scatterTierKey`**

Append to `src/utils/__tests__/scatterTier.test.js`:

```js
import { scatterTierKey } from '../scatterTier';

describe('scatterTierKey', () => {
  it('returns regular when no tier', () => {
    expect(scatterTierKey({})).toBe('regular');
  });
  it('returns the tier key otherwise', () => {
    expect(scatterTierKey({ super: true })).toBe('super');
    expect(scatterTierKey({ fiveScat: true })).toBe('five');
    expect(scatterTierKey({ fiveScat: true, hidden: true })).toBe('five');
  });
});
```

Run: `npm test -- --watchAll=false --testPathPattern=scatterTier`
Expected: PASS — now 8 passing.

- [ ] **Step 7: Replace the opening current-bonus markers (~1099-1110)**

Replace:

```jsx
                    {currentBonus.super && (
                      <span className="shrink-0 px-1 py-0.5 text-[9px] font-bold tracking-eyebrow-md uppercase font-mono border border-orange-admin/60 text-orange-admin leading-none">
                        S
                      </span>
                    )}
                    {currentBonus.fiveScat && (
                      <Star
                        size={14}
                        aria-label="5 scatter"
                        className="shrink-0 fill-gold-scatter text-gold-scatter"
                      />
                    )}
```

With:

```jsx
                    <ScatterPill bonus={currentBonus} size="md" />
```

- [ ] **Step 8: Update the `<SortableBonusRow>` usage props (~1357-1372)**

In the `<SortableBonusRow ... />` JSX, replace the `onToggleMarker={toggleBonusMarker}`
prop with:

```jsx
                            onSetTier={setBonusTier}
                            onToggleHidden={toggleBonusHidden}
```

- [ ] **Step 9: Verify build**

Run: `npm run build`
Expected: clean build. (If `Star` is now unused in HuntTracker after later Task 5, that's
handled there; the add-form still uses `Star` until Task 5, so keep the import for now.)

- [ ] **Step 10: Commit**

```bash
git add src/components/HuntTracker.js src/utils/scatterTier.js src/utils/__tests__/scatterTier.test.js
git commit -m "feat: tier-cycling scatter pill on tracker rows"
```

---

### Task 5: HuntTracker — add-bonus tier segmented control

Replace the two independent toggle buttons in the add-bonus form with an exclusive
3-way segmented control plus a Hidden toggle shown only for 5 Scatter.

**Files:**
- Modify: `src/components/HuntTracker.js` (input state ~319-320; `addBonus` ~434-454; `startLanding`/landing bonus defaults ~520-529; the toggle buttons ~1241-1280)

- [ ] **Step 1: Replace input state (~319-320)**

Replace:

```js
  const [superInput, setSuperInput] = useState(false);
  const [fiveScatInput, setFiveScatInput] = useState(false);
```

With:

```js
  // Add-form scatter tier: 'regular' | 'super' | 'five'. `hiddenInput` only applies to 'five'.
  const [tierInput, setTierInput] = useState('regular');
  const [hiddenInput, setHiddenInput] = useState(false);
```

- [ ] **Step 2: Update `addBonus` to map tier → booleans (~434-454)**

Replace the bonus object's marker fields and the reset block. Change:

```js
        super: superInput,
        fiveScat: fiveScatInput,
```

To:

```js
        super: tierInput === 'super',
        fiveScat: tierInput === 'five',
        hidden: tierInput === 'five' && hiddenInput,
```

And change the reset lines:

```js
    setSuperInput(false);
    setFiveScatInput(false);
```

To:

```js
    setTierInput('regular');
    setHiddenInput(false);
```

(The `callerInput` reset is replaced in Part 2 / Task 7 — leave it for now.)

- [ ] **Step 3: Add `hidden` default to the landing bonus (~520-529)**

In `startLanding`'s confirm handler, the new bonus object (around line 520-529) sets
`super: false, fiveScat: false`. Add `hidden: false` alongside them:

```js
      super: false,
      fiveScat: false,
      hidden: false,
```

- [ ] **Step 4: Replace the two toggle buttons (~1241-1280) with the segmented control**

Replace the entire `<div className="grid grid-cols-2 gap-2"> ... </div>` block
(the Super + 5-scat buttons, lines ~1241-1280) with:

```jsx
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'regular', label: 'Regular', active: 'border-white/30 bg-white/5 text-white-body' },
                      { key: 'super', label: 'Super', active: 'border-orange-admin bg-orange-admin/10 text-orange-admin' },
                      { key: 'five', label: '5 Scatter', active: 'border-gold-scatter bg-gold-scatter/10 text-gold-scatter' },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => {
                          setTierInput(opt.key);
                          if (opt.key !== 'five') setHiddenInput(false);
                        }}
                        aria-pressed={tierInput === opt.key}
                        className={`inline-flex items-center justify-center px-3 py-2.5 border transition-colors duration-150 text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono ${
                          tierInput === opt.key
                            ? opt.active
                            : 'border-white/10 text-white/55 hover:text-white-body hover:border-white/25'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {tierInput === 'five' && (
                    <button
                      type="button"
                      onClick={() => setHiddenInput((h) => !h)}
                      aria-pressed={hiddenInput}
                      className={`w-full inline-flex items-center justify-center gap-2 px-3 py-2 border transition-colors duration-150 text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono ${
                        hiddenInput
                          ? 'border-gold-scatter bg-gold-scatter text-zinc-broadcast'
                          : 'border-gold-scatter/40 text-gold-scatter/80 hover:border-gold-scatter'
                      }`}
                    >
                      {hiddenInput ? '★ Hidden 5 scatter' : 'Mark as hidden'}
                    </button>
                  )}
                </div>
```

- [ ] **Step 5: Remove the now-unused `Star` import if applicable**

After this task the add-form no longer uses `<Star>`. Check:
`git grep -n "Star" src/components/HuntTracker.js`
If no `<Star` / `Star,` usages remain, remove `Star` from the `lucide-react` import line
(line ~9). If any remain, leave it.

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: clean build, no `Star`/`superInput`/`fiveScatInput` reference errors.

- [ ] **Step 7: Manual smoke (dev server)**

Run: `npm start`. Open the tracker (admin hunt or `/gamba` hunt tool), start a hunt,
go to the collecting phase. Confirm:
- The Regular / Super / 5 Scatter segmented control selects exclusively.
- The Hidden toggle appears only when 5 Scatter is selected and disappears otherwise.
- Logging a 5-scatter+hidden bonus shows the pulsing `HID 5★` pill in the list.
- Clicking a row's pill cycles its tier; shift-click on a 5-scat row toggles hidden.

- [ ] **Step 8: Commit**

```bash
git add src/components/HuntTracker.js
git commit -m "feat: 3-way scatter tier control with hidden toggle in add form"
```

---

## Part 2 — Refocus slot input + "caller is hot" toggle

### Task 6: `SlotAutocomplete` ref forwarding

**Files:**
- Modify: `src/components/SlotAutocomplete.js` (signature line ~12; inner input ~50-61)

- [ ] **Step 1: Convert to `forwardRef` + expose `focus()`**

At the top of `src/components/SlotAutocomplete.js`, the current import is
`import { useState, useEffect, useRef } from 'react';` (line 1). Add `forwardRef` and
`useImperativeHandle`:

```js
import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
```

(Line 2 `import { Dice6 } from 'lucide-react';` stays unchanged.)

Change the component declaration (line ~12) from:

```js
export default function SlotAutocomplete({ value, onChange, onSelect, placeholder, className, onKeyDown, autoFocus, 'aria-label': ariaLabel }) {
```

To:

```js
const SlotAutocomplete = forwardRef(function SlotAutocomplete(
  { value, onChange, onSelect, placeholder, className, onKeyDown, autoFocus, 'aria-label': ariaLabel },
  ref
) {
```

Add an input ref inside the component body (near `const containerRef = useRef(null);`):

```js
  const inputRef = useRef(null);
  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current && inputRef.current.focus(),
  }));
```

Attach the ref to the inner `<input>` (line ~50) by adding `ref={inputRef}`:

```jsx
      <input
        ref={inputRef}
        type="text"
        value={value}
```

At the end of the file, change the default export. Replace the closing `}` of the old
function declaration with `});` and add:

```js
export default SlotAutocomplete;
```

(If the file already ends with `}` closing the function, the conversion turns it into
`});` for the `forwardRef` call, then the explicit `export default SlotAutocomplete;`.)

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: clean build, no errors in `SlotAutocomplete`.

- [ ] **Step 3: Commit**

```bash
git add src/components/SlotAutocomplete.js
git commit -m "feat: forward ref from SlotAutocomplete to expose focus()"
```

---

### Task 7: HuntTracker — refocus + "caller is hot"

**Files:**
- Modify: `src/components/HuntTracker.js` (new state near ~321; `addBonus` ~434-454; slot field + caller field ~1211-1235)

- [ ] **Step 1: Add `slotRef` and `callerHot` state**

Near the other transient input state (after `const [callerInput, setCallerInput] = useState('');`, ~line 321), add:

```js
  const [callerHot, setCallerHot] = useState(false);
  const slotRef = useRef(null);
```

`useRef` is NOT currently imported in HuntTracker (line 1 is
`import { useState, useEffect } from 'react';`). Add it:

```js
import { useState, useEffect, useRef } from 'react';
```

- [ ] **Step 2: Pass the ref to the slot field (~1211-1218)**

Add `ref={slotRef}` to the `<SlotAutocomplete>` in the add-bonus form:

```jsx
                <SlotAutocomplete
                  ref={slotRef}
                  value={slotInput}
                  onChange={setSlotInput}
                  placeholder="Slot name"
                  className={`w-full ${inputCls}`}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && addBonus()}
                />
```

- [ ] **Step 3: Make caller clear conditional + refocus in `addBonus`**

In `addBonus` (the reset block ~449-453), replace:

```js
    setCallerInput('');
  }
```

With:

```js
    if (!callerHot) setCallerInput('');
    slotRef.current?.focus();
  }
```

(The slot/stake/tier resets above stay as-is from Task 5.)

- [ ] **Step 4: Add the "caller is hot" toggle by the caller input (~1227-1235)**

The caller `<input>` is at ~1227-1235. Wrap it with the toggle. Replace:

```jsx
                <input
                  type="text"
                  list="hunt-callers"
                  placeholder="Slot caller (optional)"
                  value={callerInput}
                  onChange={(e) => setCallerInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addBonus()}
                  className={`w-full ${inputCls}`}
                />
```

With:

```jsx
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    list="hunt-callers"
                    placeholder="Slot caller (optional)"
                    value={callerInput}
                    onChange={(e) => setCallerInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addBonus()}
                    className={`flex-1 ${inputCls}`}
                  />
                  <button
                    type="button"
                    onClick={() => setCallerHot((h) => !h)}
                    aria-pressed={callerHot}
                    title={callerHot ? 'Caller is hot — kept after each bonus. Click to clear after add.' : 'Keep this caller after logging each bonus'}
                    className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-2.5 border transition-colors duration-150 text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono ${
                      callerHot
                        ? 'border-orange-admin bg-orange-admin/10 text-orange-admin'
                        : 'border-white/10 text-white/55 hover:text-white-body hover:border-white/25'
                    }`}
                  >
                    {callerHot ? '🔥 Hot' : 'Hot?'}
                  </button>
                </div>
```

- [ ] **Step 4b: Verify build**

Run: `npm run build`
Expected: clean build.

- [ ] **Step 5: Manual smoke (dev server)**

Run: `npm start`. In the collecting phase:
- Type a slot name, press Enter → bonus logged, cursor returns to the slot field, ready
  to type the next slot (no mouse). Same when clicking "Log bonus".
- With "Hot?" OFF: caller clears after each add.
- Toggle to "🔥 Hot": type a caller, log several bonuses — caller persists; slot + bet
  still clear each time.

- [ ] **Step 6: Commit**

```bash
git add src/components/HuntTracker.js
git commit -m "feat: refocus slot input after add + caller-is-hot toggle"
```

---

## Part 3 — Rename "Stake" → "Bet" (viewer-facing labels only)

### Task 8: Rename labels in HuntTracker

**Files:**
- Modify: `src/components/HuntTracker.js`

> **Guardrail:** change visible STRINGS only. Do NOT touch `stake` object keys,
> `stakeInput`/`landStakeInput`, `bonusSort` values `'stake-asc'`/`'stake-desc'`,
> `onStake`/`updateBonusStake`, `cycleStakeSort`, or `totalStakes`.

- [ ] **Step 1: Row stake input aria-label (~240)**

Change `aria-label="Stake"` → `aria-label="Bet"`.

- [ ] **Step 2: Add-form placeholder (~1221)**

Change `placeholder="Stake ($)"` → `placeholder="Bet ($)"`.

- [ ] **Step 3: Opening-card line (~1121)**

Change `stake {fmt(currentBonus.stake)}` → `bet {fmt(currentBonus.stake)}` (the visible
word only; `currentBonus.stake` stays).

- [ ] **Step 4: Bonus-list column header (~1306 and ~1324)**

There are two visible "Stake" header strings (a plain header span ~1306 and the sortable
header button label ~1324). Change both visible `Stake` → `Bet`.

- [ ] **Step 5: Sort tooltips (~1313-1315)**

In the `title` for the stake-sort button, change the visible phrases:
`Sort by stake (high to low)` → `Sort by bet (high to low)`,
`Sort by stake (low to high)` → `Sort by bet (low to high)`.
(Leave the `bonusSort === 'stake-desc'` comparisons untouched — those are state values.)

- [ ] **Step 6: Stake-prompt panel label (~1724-1732)**

If the "Bonus landed — add to hunt" panel shows a "Stake" label for `landStakeInput`,
change the visible label to "Bet". (Verify the exact string at edit time; change only
the visible label, not `landStakeInput`.)

- [ ] **Step 7: Verify no stray visible "Stake" remains**

Run: `git grep -n "Stake" src/components/HuntTracker.js`
Expected: remaining hits are ONLY identifiers (`stakeInput`, `landStakeInput`,
`cycleStakeSort`, `totalStakes`, `'stake-*'`, comments) — no user-visible JSX text or
placeholders/aria-labels.

- [ ] **Step 8: Commit**

```bash
git add src/components/HuntTracker.js
git commit -m "feat: rename Stake to Bet in tracker labels"
```

---

### Task 9: Rename labels in LiveHuntPage / HuntHistory / Admin

**Files:**
- Modify: `src/pages/LiveHuntPage.js` (~160, ~205, ~230, ~248)
- Modify: `src/components/HuntHistory.js` (~148)
- Modify: `src/pages/AdminCommunityHuntsPage.js` (~55)

- [ ] **Step 1: LiveHuntPage**

- `~160`: `{fmt(stats.totalStakes)} staked so far` → `{fmt(stats.totalStakes)} bet so far`
- `~205`: `stake {fmt(currentBonus.stake)}` → `bet {fmt(currentBonus.stake)}`
- `~230`: stat label `'Total staked'` → `'Total bet'` (the visible label string only)
- `~248`: table header `<th ...>Stake</th>` → `<th ...>Bet</th>`

(Leave `stats.totalStakes`, `currentBonus.stake`, `b.stake` untouched.)

- [ ] **Step 2: HuntHistory (~148)**

Change `<th className="text-right px-3 py-2 font-bold">Stake</th>` → `...>Bet</th>`.

- [ ] **Step 3: AdminCommunityHuntsPage (~55)**

Change `<th className="text-right px-3 py-2 font-bold">Stake</th>` → `...>Bet</th>`.

- [ ] **Step 4: Verify no stray visible "Stake"/"staked" remains in these files**

Run:
```bash
git grep -n "Stake\|staked" src/pages/LiveHuntPage.js src/components/HuntHistory.js src/pages/AdminCommunityHuntsPage.js
```
Expected: only `stake`/`totalStakes` identifiers remain — no visible JSX text. (`b.stake`,
`stats.totalStakes`, `x = b.stake > 0 ...` are fine.)

- [ ] **Step 5: Verify build + tests**

Run: `npm run build`
Expected: clean build.
Run: `npm test -- --watchAll=false --testPathPattern=scatterTier`
Expected: PASS — 8 passing.

- [ ] **Step 6: Commit**

```bash
git add src/pages/LiveHuntPage.js src/components/HuntHistory.js src/pages/AdminCommunityHuntsPage.js
git commit -m "feat: rename Stake to Bet on live/history/admin pages"
```

---

## Final Verification

- [ ] **Full build:** `npm run build` — clean.
- [ ] **Tests:** `npm test -- --watchAll=false --testPathPattern=scatterTier` — 8 passing.
- [ ] **Manual end-to-end (`npm start`):**
  - Log bonuses of each tier; pills render in tracker row, opening card, and (via share)
    live page, history, and admin tables.
  - `HIDDEN 5★` pulses; enable OS reduced-motion → pulse stops, static glow remains.
  - After logging (Enter and button), focus returns to the slot field.
  - "Hot?" OFF clears caller; "🔥 Hot" keeps it across adds; slot + bet always clear.
  - No visible "Stake" text anywhere in the tracker surfaces; bet sort still works.
  - Open an OLD hunt (pre-change data): legacy `super`/`fiveScat` bonuses still show the
    correct pill; a bonus with both legacy flags shows `5 SCATTER`.
