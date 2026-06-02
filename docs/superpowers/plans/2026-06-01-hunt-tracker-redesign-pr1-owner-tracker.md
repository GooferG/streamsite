# Hunt Tracker Redesign — PR 1: Owner Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the owner-side bonus hunt tracker — co-locate the two share links in a WATCH/COLLECT bar, restructure to the Option B layout with a full-width stats band, add a first-visit coachmark tour, cap long lists with internal scroll, enlarge high-traffic inputs, and apply secondary polish.

**Architecture:** All changes live in the lazy-loaded `HuntTracker` chunk plus small new sibling files. `LinkControls` is extracted from `SuggestionsPanel.js` into its own file so both the new share bar and the (trimmed) suggestions panel can use it. A new `CopyLinkButton`, a `useFirstVisit` hook, and a `HuntTour` overlay are added. No data-model, Firestore, serverless, or routing changes — only JSX placement, presentational components, a new Tailwind token, and DOM/localStorage reads.

**Tech Stack:** React 19, react-router-dom v7, Tailwind (config at `tailwind.config.js`), lucide-react icons, `@dnd-kit` (already used for bonus drag), Jest + `@testing-library/react` (`renderHook`, `render`, `act`), `react-scripts` for build/lint.

**Spec:** `docs/superpowers/specs/2026-06-01-hunt-tracker-ux-redesign-design.md` (§1–§7, §10, plus the `gold-scatter` decision and PR 1 rollout).

---

## File Structure

**New files:**
- `src/components/CopyLinkButton.js` — one Copy/Copied control (URL + label), reused by both share-bar tracks.
- `src/components/HuntLinkControls.js` — the `LinkControls` component moved out of `SuggestionsPanel.js` verbatim, exported for reuse.
- `src/hooks/useFirstVisit.js` — localStorage-backed `[seen, markSeen]` first-visit flag.
- `src/components/HuntTour.js` — coachmark overlay + step engine.
- `src/components/CappedScroll.js` — tiny presentational wrapper: `max-h` + `overflow-y-auto` body with sticky-edge support, for the bonus list + squad split.
- Tests: `src/hooks/__tests__/useFirstVisit.test.js`, `src/components/__tests__/CopyLinkButton.test.js`, `src/components/__tests__/HuntTour.test.js`.

**Modified files:**
- `tailwind.config.js` — add the `gold-scatter` color token.
- `src/components/SuggestionsPanel.js` — remove inline `LinkControls`, stop rendering it, add `data-tour="suggestions"` wrapper, bump `inputCls`.
- `src/components/HuntTracker.js` — share bar, stats band, layout reorder, header regroup, add-form reorder, opening-card refinements, tour wiring, capped scroll, sizing, secondary polish, `gold-scatter` usage.
- `src/components/HuntStartScreen.js` — minor sizing parity.
- `src/components/StatCell.js` — add a borderless/`hero` variant via props.

**Convention notes for the implementer (read once):**
- Hooks use **named** exports (`export function useFoo()`), matching `useCountdown.js`, `useSchedule.js`, `useHuntStore.js`.
- Components use **default** exports (e.g. `export default function HuntTracker()`).
- Color tokens live under `theme.extend.colors` in `tailwind.config.js`. There is already a casino-hifi `gold: '#e7c267'` — do NOT reuse it; the new token is a distinct `gold-scatter`.
- Tests live in `__tests__/` folders beside the code. Run a single file with:
  `npm test -- --watchAll=false --testPathPattern=<name>`
- There is no lint script; lint runs via `npm run build`. Use `npm run build` as the "does it compile + lint clean" gate.
- The dev server is `npm start` (localhost:3000). The tracker is reached at `/gamba/hunt-tracker`.
- Do NOT add `Co-Authored-By` trailers to commits (global user instruction).

---

## Task 1: Add the `gold-scatter` Tailwind token

**Files:**
- Modify: `tailwind.config.js` (the `theme.extend.colors` object, around line 26–27)

- [ ] **Step 1: Add the token**

In `tailwind.config.js`, inside `theme.extend.colors`, add a line after `'white-muted': '#a1a1aa',` (line 27):

```js
        'white-muted': '#a1a1aa',
        'gold-scatter': '#fbbf24',
```

(Place it before the `// Broadcast hifi (phosphor CRT)` comment block so it sits with the core palette, not the hifi sub-palettes. Do not touch the existing `gold: '#e7c267'`.)

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: build succeeds (Tailwind regenerates with the new color available as `text-gold-scatter` / `fill-gold-scatter` / `border-gold-scatter`). If the build is slow, this step only needs to reach "Compiled successfully".

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.js
git commit -m "feat: add gold-scatter color token for 5-scatter marker"
```

---

## Task 2: `useFirstVisit` hook (TDD)

**Files:**
- Create: `src/hooks/useFirstVisit.js`
- Test: `src/hooks/__tests__/useFirstVisit.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/__tests__/useFirstVisit.test.js`:

```js
import { renderHook, act } from '@testing-library/react';
import { useFirstVisit } from '../useFirstVisit';

describe('useFirstVisit', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns seen=false on first visit, then true after markSeen', () => {
    const { result } = renderHook(() => useFirstVisit('testKey'));
    expect(result.current[0]).toBe(false);
    act(() => {
      result.current[1](); // markSeen
    });
    expect(result.current[0]).toBe(true);
  });

  it('returns seen=true when the flag is already stored', () => {
    window.localStorage.setItem('testKey', '1');
    const { result } = renderHook(() => useFirstVisit('testKey'));
    expect(result.current[0]).toBe(true);
  });

  it('treats a throwing localStorage as seen (never traps the user)', () => {
    const spy = jest
      .spyOn(window.localStorage.__proto__, 'getItem')
      .mockImplementation(() => {
        throw new Error('denied');
      });
    const { result } = renderHook(() => useFirstVisit('testKey'));
    expect(result.current[0]).toBe(true);
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --watchAll=false --testPathPattern=useFirstVisit`
Expected: FAIL — "Cannot find module '../useFirstVisit'".

- [ ] **Step 3: Write the hook**

Create `src/hooks/useFirstVisit.js`:

```js
import { useCallback, useState } from 'react';

// Returns [seen, markSeen] for a localStorage flag at `key`.
// If storage is unavailable (private mode, disabled, SSR), treat as "seen"
// so a first-visit gate never traps the user.
export function useFirstVisit(key) {
  const [seen, setSeen] = useState(() => {
    try {
      return window.localStorage.getItem(key) != null;
    } catch {
      return true;
    }
  });

  const markSeen = useCallback(() => {
    setSeen(true);
    try {
      window.localStorage.setItem(key, '1');
    } catch {
      // best-effort; the in-memory flag still flips
    }
  }, [key]);

  return [seen, markSeen];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- --watchAll=false --testPathPattern=useFirstVisit`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useFirstVisit.js src/hooks/__tests__/useFirstVisit.test.js
git commit -m "feat: add useFirstVisit hook for first-visit gating"
```

---

## Task 3: `CopyLinkButton` component (TDD)

**Files:**
- Create: `src/components/CopyLinkButton.js`
- Test: `src/components/__tests__/CopyLinkButton.test.js`

This replaces the two near-duplicate copy controls (header + `SuggestionsPanel` `LinkControls`). It copies a URL to the clipboard and flips its label to "Copied" briefly.

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/CopyLinkButton.test.js`:

```js
import { render, screen, fireEvent, act } from '@testing-library/react';
import CopyLinkButton from '../CopyLinkButton';

describe('CopyLinkButton', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
    });
  });
  afterEach(() => jest.useRealTimers());

  it('renders the given label', () => {
    render(<CopyLinkButton url="https://x/live/ab" label="Copy watch link" />);
    expect(screen.getByText('Copy watch link')).toBeInTheDocument();
  });

  it('writes the url to the clipboard on click', () => {
    render(<CopyLinkButton url="https://x/live/ab" label="Copy watch link" />);
    fireEvent.click(screen.getByRole('button'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://x/live/ab');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --watchAll=false --testPathPattern=CopyLinkButton`
Expected: FAIL — "Cannot find module '../CopyLinkButton'".

- [ ] **Step 3: Write the component**

Create `src/components/CopyLinkButton.js`:

```js
import { useState } from 'react';
import { Check, Link as LinkIcon } from 'lucide-react';

// Calm dark copy button: readable light label, accent only on the small icon.
// `label` names what is copied ("Copy watch link") to prevent mis-paste.
export default function CopyLinkButton({
  url,
  label = 'Copy',
  className = '',
  iconClassName = 'text-emerald-signal',
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    if (!url) return;
    navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {}
    );
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={url}
      className={`inline-flex items-center gap-1.5 px-2.5 py-2 border border-white/20 bg-zinc-broadcast/60 text-white-body hover:border-white/40 transition-colors text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono whitespace-nowrap ${className}`}
    >
      {copied ? (
        <Check size={12} aria-hidden="true" className={iconClassName} />
      ) : (
        <LinkIcon size={12} aria-hidden="true" className={iconClassName} />
      )}
      <span>{copied ? 'Copied' : label}</span>
    </button>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- --watchAll=false --testPathPattern=CopyLinkButton`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/CopyLinkButton.js src/components/__tests__/CopyLinkButton.test.js
git commit -m "feat: add shared CopyLinkButton control"
```

---

## Task 4: Extract `LinkControls` into `HuntLinkControls.js`

**Files:**
- Create: `src/components/HuntLinkControls.js`
- Modify: `src/components/SuggestionsPanel.js` (remove the inline `LinkControls` definition at lines ~205–372 and its render at ~435–445; keep `RosterSearch`, import flow, pills)

- [ ] **Step 1: Create the extracted component**

Create `src/components/HuntLinkControls.js`. Move the **entire** `LinkControls` function from `SuggestionsPanel.js` (currently lines ~205–372) into this file verbatim, add the imports it needs, swap its internal Copy control to the new `CopyLinkButton`, and default-export it. Full file:

```js
import { useState } from 'react';
import { Link as LinkIcon, Trash2 } from 'lucide-react';
import CopyLinkButton from './CopyLinkButton';

const inputCls =
  'bg-zinc-broadcast/60 border border-white/10 px-3.5 py-2.5 text-sm text-white-body placeholder:text-white/50 focus:border-emerald-signal/70 focus:outline-none transition-colors duration-150';

// Owner controls for the password-gated public suggestion link.
// Extracted from SuggestionsPanel so the share bar and the panel can share it.
export default function HuntLinkControls({
  linkId,
  linkOpen,
  linkBusy,
  linkError,
  onCreateLink,
  onToggleLink,
  onDeleteLink,
}) {
  const [opening, setOpening] = useState(false);
  const [pw, setPw] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const url = linkId ? `${window.location.origin}/hunt-suggest/${linkId}` : null;

  if (!linkId) {
    return (
      <div className="border border-white/8 bg-zinc-broadcast/40 p-3 space-y-2">
        {!opening ? (
          <button
            type="button"
            onClick={() => setOpening(true)}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 border border-purple-gamba/40 text-purple-bright hover:bg-purple-gamba/15 transition-colors duration-150"
          >
            <LinkIcon size={13} aria-hidden="true" />
            <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
              Collect via link
            </span>
          </button>
        ) : (
          <>
            <p className="text-[11px] text-white/55 leading-snug">
              Set a password and share the link. Anyone with both can submit picks
              straight into this list.
            </p>
            <input
              type="text"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="Set a password (min 8 chars)"
              className={`w-full ${inputCls}`}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onCreateLink(pw)}
                disabled={linkBusy || pw.trim().length < 8}
                className="flex-1 px-3 py-2.5 bg-purple-gamba text-white-body hover:bg-purple-bright transition-colors duration-150 disabled:opacity-40"
              >
                <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
                  {linkBusy ? 'Creating…' : 'Create link'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpening(false);
                  setPw('');
                }}
                className="px-3 py-2.5 border border-white/10 text-white/60 hover:text-white-body transition-colors"
              >
                <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
                  Cancel
                </span>
              </button>
            </div>
            {linkError && <p className="text-red-destructive text-[11px]">{linkError}</p>}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="border border-purple-gamba/30 bg-purple-gamba/5 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              linkOpen ? 'bg-emerald-signal animate-pulse' : 'bg-white/30'
            }`}
          />
          <span className={linkOpen ? 'text-emerald-signal' : 'text-white/50'}>
            {linkOpen ? 'Collecting' : 'Closed'}
          </span>
        </span>
        <button
          type="button"
          onClick={() => onToggleLink(!linkOpen)}
          disabled={linkBusy}
          className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono px-2 py-1 border border-white/15 text-white/65 hover:text-white-body hover:border-white/30 transition-colors disabled:opacity-40"
        >
          {linkOpen ? 'Close' : 'Re-open'}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          readOnly
          value={url}
          onFocus={(e) => e.target.select()}
          className={`flex-1 min-w-0 ${inputCls} text-[11px]`}
        />
        <CopyLinkButton url={url} label="Copy collect link" iconClassName="text-purple-bright" />
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] text-white/40 font-mono">
          Password set when created — recreate to change it.
        </p>
        {confirmingDelete ? (
          <span className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                onDeleteLink();
                setConfirmingDelete(false);
              }}
              disabled={linkBusy}
              className="px-2 py-1 bg-red-destructive/15 border border-red-destructive/50 text-red-destructive text-[9px] font-bold tracking-eyebrow-md uppercase font-mono disabled:opacity-40"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="px-2 py-1 border border-white/10 text-white/50 text-[9px] font-bold tracking-eyebrow-md uppercase font-mono"
            >
              ✕
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold tracking-eyebrow-md uppercase font-mono text-white/40 hover:text-red-destructive transition-colors"
          >
            <Trash2 size={11} aria-hidden="true" />
            Kill link
          </button>
        )}
      </div>
      {linkError && <p className="text-red-destructive text-[11px]">{linkError}</p>}
    </div>
  );
}
```

Note: the placeholder copy "Password set when created — recreate to change it." keeps its em dash because it is pre-existing copy being moved verbatim; leave it unless doing the §7 voice pass (out of this task's scope).

- [ ] **Step 2: Remove `LinkControls` from `SuggestionsPanel.js`**

In `src/components/SuggestionsPanel.js`:
1. Delete the entire `LinkControls` function definition (currently lines ~205–372).
2. Remove the now-unused imports it required if they are not used elsewhere in the file: check `Radio`, `Link as LinkIcon`, `Trash2`. (Keep any still used by `SlotPill`/`RosterSearch`/the panel: `Check`, `X`, `Radio` is used by `SlotPill` — verify before deleting. Only remove imports with zero remaining references.)
3. In the panel's returned JSX, delete the `<LinkControls ... />` render block (currently lines ~435–445, the `{isLoggedIn && (<LinkControls .../>)}`).
4. Leave the `RosterSearch` render, the import flow, and the pill list intact.
5. The `SuggestionsPanel` props related to the link (`linkId`, `linkOpen`, `linkBusy`, `linkError`, `onCreateLink`, `onToggleLink`, `onDeleteLink`) become unused by the panel. Remove them from the destructured props and from the `SuggestionsPanel` propTypes/signature. (They will instead be passed to `HuntLinkControls` from `HuntTracker` in Task 8.)

- [ ] **Step 3: Verify it compiles**

Run: `npm run build`
Expected: "Compiled successfully" with no unused-var lint errors. If lint flags an unused import (e.g. `LinkIcon`), remove it.

- [ ] **Step 4: Commit**

```bash
git add src/components/HuntLinkControls.js src/components/SuggestionsPanel.js
git commit -m "refactor: extract LinkControls into HuntLinkControls, drop from SuggestionsPanel"
```

---

## Task 5: Bump `inputCls` sizing in SuggestionsPanel + add suggestions tour target

**Files:**
- Modify: `src/components/SuggestionsPanel.js` (the `inputCls` const at line ~6; the panel's outer wrapper)

- [ ] **Step 1: Enlarge inputs**

In `src/components/SuggestionsPanel.js`, change the `inputCls` const padding from `px-3 py-2` to `px-3.5 py-2.5`:

```js
const inputCls =
  'bg-zinc-broadcast/60 border border-white/10 px-3.5 py-2.5 text-sm text-white-body placeholder:text-white/50 focus:border-emerald-signal/70 focus:outline-none transition-colors duration-150';
```

- [ ] **Step 2: Add the tour target**

Wrap the panel's top-level returned element (the outermost `<div className="space-y-3">`) with `data-tour="suggestions"`:

```jsx
    <div className="space-y-3" data-tour="suggestions">
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run build`
Expected: "Compiled successfully".

- [ ] **Step 4: Commit**

```bash
git add src/components/SuggestionsPanel.js
git commit -m "style: enlarge SuggestionsPanel inputs, add tour target"
```

---

## Task 6: `StatCell` borderless / hero variant

**Files:**
- Modify: `src/components/StatCell.js`
- Test: extend `src/components/__tests__/CopyLinkButton.test.js`? No — add `src/components/__tests__/StatCell.test.js`

The stats band needs cells without the bordered-box look, plus a larger "hero" value for Profit. Add `variant` (`'box' | 'bare'`) and `hero` (boolean) props; default keeps today's exact look so existing call sites are unaffected.

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/StatCell.test.js`:

```js
import { render, screen } from '@testing-library/react';
import StatCell from '../StatCell';

describe('StatCell', () => {
  it('renders label and value', () => {
    render(<StatCell label="Profit" value="+100" />);
    expect(screen.getByText('Profit')).toBeInTheDocument();
    expect(screen.getByText('+100')).toBeInTheDocument();
  });

  it('default variant keeps the bordered box class', () => {
    const { container } = render(<StatCell label="X" value="1" />);
    expect(container.firstChild.className).toContain('border');
  });

  it('bare variant drops the border', () => {
    const { container } = render(<StatCell label="X" value="1" variant="bare" />);
    expect(container.firstChild.className).not.toContain('border ');
  });

  it('hero enlarges the value', () => {
    const { container } = render(<StatCell label="Profit" value="+100" hero />);
    // hero value uses a larger text size class
    expect(container.querySelector('.text-2xl, .text-3xl')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --watchAll=false --testPathPattern=StatCell`
Expected: FAIL — the `bare`/`hero` assertions fail against the current fixed markup.

- [ ] **Step 3: Update the component**

Replace `src/components/StatCell.js` with:

```js
// Small label + value box used across the hunt tracker and live hunt views.
// variant 'box' (default) keeps the original bordered look; 'bare' drops the
// border/background for use inside a hairline-divided stats band. `hero`
// enlarges the value (Profit lead in the band).
export default function StatCell({ label, value, variant = 'box', hero = false }) {
  const wrap =
    variant === 'bare'
      ? 'px-3 py-2.5'
      : 'px-3 py-2.5 bg-zinc-broadcast/50 border border-white/8';
  const valueCls = hero ? 'text-2xl' : 'text-base';
  return (
    <div className={wrap}>
      <p className="text-[10px] font-bold uppercase tracking-eyebrow-lg text-white/65 mb-1 font-mono">
        {label}
      </p>
      <p className={`font-bold text-white-body ${valueCls} tabular-nums`}>{value}</p>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- --watchAll=false --testPathPattern=StatCell`
Expected: PASS (4 tests).

- [ ] **Step 5: Verify existing call sites unaffected**

Run: `npm run build`
Expected: "Compiled successfully" (default `variant='box'` preserves the old output for `HuntTracker`, the wrap-up modal, and `LiveHuntPage`).

- [ ] **Step 6: Commit**

```bash
git add src/components/StatCell.js src/components/__tests__/StatCell.test.js
git commit -m "feat: add bare/hero variants to StatCell for the stats band"
```

---

## Task 7: `CappedScroll` wrapper

**Files:**
- Create: `src/components/CappedScroll.js`

A presentational wrapper that caps height and scrolls internally. It does not own the sticky header/footer (those are `position: sticky` cells inside the table, set where the table is rendered); it provides the scroll container + max height.

- [ ] **Step 1: Create the component**

Create `src/components/CappedScroll.js`:

```js
// Caps a list/table body height and scrolls it internally past the cap, so a
// long hunt doesn't stretch the page. Sticky header/footer pinning is done by
// the table cells inside (position: sticky) — this just owns the scroll box.
// `maxClass` is a Tailwind max-height utility (e.g. 'max-h-[60vh]').
export default function CappedScroll({ maxClass = 'max-h-[60vh]', className = '', children }) {
  return (
    <div className={`${maxClass} overflow-y-auto [scrollbar-width:thin] ${className}`}>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: "Compiled successfully".

- [ ] **Step 3: Commit**

```bash
git add src/components/CappedScroll.js
git commit -m "feat: add CappedScroll wrapper for height-capped lists"
```

---

## Task 8: Broadcast & collect share bar in HuntTracker

**Files:**
- Modify: `src/components/HuntTracker.js` (header block lines ~706–901; add bar between header and status bar; remove header live-share block lines ~773–817; pass link props to `HuntLinkControls`)

This is the core of §1. The live-share logic (`shareId`, `startSharing`, `stopSharing`, `copyShareLink`, `shareUrl`) already exists in `HuntTracker` — only the rendering moves. The intake-link props/handlers (`createIntakeLink`, `toggleIntakeOpen`, `deleteIntakeLink`, `activeHunt.intakeLinkId`, `activeHunt.intakeOpen`, `linkBusy`, `linkError`) also already exist; they now feed `HuntLinkControls` in the bar instead of `SuggestionsPanel`.

- [ ] **Step 1: Add imports**

At the top of `HuntTracker.js`, add:

```js
import CopyLinkButton from './CopyLinkButton';
import HuntLinkControls from './HuntLinkControls';
```

- [ ] **Step 2: Remove the live-share block from the header**

Delete the live-share `{isLoggedIn && (shareId ? (...) : (...))}` block currently in the header actions (lines ~773–817 — the `<div>` with the red "Live" pill, copy, stop, and the "SHARE LIVE" button). Keep `Export split`, `Complete`, and `Discard`. (The `?` button and overflow are Task 12; do those after this lands.)

- [ ] **Step 3: Add the share bar between header and status bar**

Immediately after the closing `</div>` of the header block (the `flex flex-wrap items-center ... border-b border-white/8` wrapper, ~line 901) and before the `{/* Status bar */}` comment, insert:

```jsx
      {/* Broadcast & collect bar — owner only */}
      {isLoggedIn && (
        <div
          data-tour="share-bar"
          data-html2canvas-ignore="true"
          className="grid grid-cols-1 sm:grid-cols-2 gap-2 px-4 py-3 border-b border-white/8 bg-purple-gamba/5"
        >
          {/* WATCH track */}
          <div className="border border-white/10 bg-zinc-broadcast/40 p-2.5">
            <p className="flex items-center gap-2 text-[9px] font-bold tracking-eyebrow-lg uppercase font-mono text-red-destructive mb-2">
              <span
                className={`w-1.5 h-1.5 rounded-full ${shareId ? 'bg-red-destructive animate-pulse' : 'bg-white/25'}`}
              />
              Watch{shareId ? ' · live' : ''}
            </p>
            {shareId ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.target.select()}
                  className="flex-1 min-w-0 bg-zinc-broadcast/60 border border-white/10 px-2.5 py-2 text-[11px] font-mono text-white/70 focus:outline-none"
                />
                <CopyLinkButton url={shareUrl} label="Copy watch link" iconClassName="text-red-destructive" />
                <button
                  type="button"
                  onClick={stopSharing}
                  title="Stop sharing — link dies"
                  className="px-2.5 py-2 border border-red-destructive/55 text-red-300 hover:bg-red-destructive/15 transition-colors text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono"
                >
                  Stop
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={startSharing}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 border border-red-destructive/40 text-red-300 hover:bg-red-destructive/10 transition-colors duration-150"
              >
                <Radio size={13} aria-hidden="true" />
                <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
                  Go live
                </span>
              </button>
            )}
          </div>
          {/* COLLECT track */}
          <div className="border border-white/10 bg-zinc-broadcast/40 p-2.5">
            <p className="flex items-center gap-2 text-[9px] font-bold tracking-eyebrow-lg uppercase font-mono text-purple-bright mb-2">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  activeHunt.intakeLinkId && activeHunt.intakeOpen !== false
                    ? 'bg-emerald-signal animate-pulse'
                    : 'bg-white/25'
                }`}
              />
              Collect
            </p>
            <HuntLinkControls
              linkId={activeHunt.intakeLinkId || null}
              linkOpen={activeHunt.intakeOpen !== false}
              linkBusy={linkBusy}
              linkError={linkError}
              onCreateLink={createIntakeLink}
              onToggleLink={toggleIntakeOpen}
              onDeleteLink={deleteIntakeLink}
            />
          </div>
        </div>
      )}
```

- [ ] **Step 4: Remove the link props from the `SuggestionsPanel` render**

Find the `<SuggestionsPanel ... />` render (lines ~1477–1491) and delete the link-related props now that the panel no longer renders the controls: remove `linkId`, `linkOpen`, `linkBusy`, `linkError`, `onCreateLink`, `onToggleLink`, `onDeleteLink`. Keep `suggestions`, `onImport`, `onSetStatus`, `onLand`, `onClear`, `isLoggedIn`.

- [ ] **Step 5: Verify it compiles and renders**

Run: `npm run build`
Expected: "Compiled successfully". If `Radio` was only used by the removed header block and now the bar, confirm it is still imported (it is used by the bar's "Go live").

- [ ] **Step 6: Manual check**

Run: `npm start`, log in as owner, go to `/gamba/hunt-tracker`, start a hunt.
Expected: a two-cell bar under the title — WATCH (Go live) and COLLECT (Collect via link). Create the collect link (password ≥ 8 chars) and click Go live; both show a URL + readable Copy + Stop/Close. "Stop" and "Copy" are legible (dark buttons, light text). The old SHARE LIVE block is gone from the header.

- [ ] **Step 7: Commit**

```bash
git add src/components/HuntTracker.js
git commit -m "feat: add broadcast & collect share bar to hunt tracker"
```

---

## Task 9: Stats band (Option B) + balance inputs

**Files:**
- Modify: `src/components/HuntTracker.js` (move Financials §02 out of the right column into a new full-width band under the status bar)

- [ ] **Step 1: Insert the stats band after the status bar**

After the `{/* Status bar */}` block (ends ~line 928) and before the `{/* Body */}` block, insert a full-width band. It uses `StatCell` with the new `variant="bare"` and `hero` props, hairline `divide-x`, and the two balance inputs as the rightmost editable cells:

```jsx
      {/* Overall stats band */}
      <div data-tour="stats" className="border-b border-white/8 bg-emerald-signal/[0.03]">
        <div className="flex flex-wrap divide-x divide-white/10">
          <StatCell
            variant="bare"
            hero
            label="Profit"
            value={
              profit == null ? (
                '—'
              ) : (
                <span className={profit >= 0 ? 'text-emerald-signal' : 'text-red-destructive'}>
                  {profit >= 0 ? '+' : ''}
                  {fmt(profit)}
                </span>
              )
            }
          />
          <StatCell variant="bare" label="Req X" value={reqX != null ? `${reqX.toFixed(1)}x` : '—'} />
          <StatCell
            variant="bare"
            label="W/L mult"
            value={wlMultiplier != null ? fmtX(Math.round(wlMultiplier * 100) / 100) : '—'}
          />
          <StatCell variant="bare" label="Total wins" value={fmt(totalWins)} />
          <label className="px-3 py-2.5 block">
            <span className="block text-[10px] font-bold uppercase tracking-eyebrow-md text-white/65 mb-1.5 font-mono">
              Start bal
            </span>
            <input
              type="number"
              placeholder="0.00"
              value={startBalance}
              onChange={(e) => updateHunt({ startBalance: e.target.value })}
              className={`w-28 ${inputCls} tabular-nums`}
            />
          </label>
          <label className="px-3 py-2.5 block">
            <span className="block text-[10px] font-bold uppercase tracking-eyebrow-md text-white/65 mb-1.5 font-mono">
              Finish bal
            </span>
            <input
              type="number"
              placeholder="0.00"
              value={finishBalance}
              onChange={(e) => updateHunt({ finishBalance: e.target.value })}
              className={`w-28 ${inputCls} tabular-nums`}
            />
          </label>
        </div>
      </div>
```

- [ ] **Step 2: Remove the old Financials section (§02) from the right column**

In the right column (`{/* RIGHT — Stats / Split / Banned */}`, ~line 1247), delete the entire first `<div className="space-y-3">` block that holds the `PanelLabel code="02" ... label="Financials"`, the Start/Finish balance grid, and the 2×2 `StatCell` grid (lines ~1249–1315). Those stats now live in the band; the balance inputs now live in the band. The right column now starts with the "Squad split" (`code="03"`) section.

- [ ] **Step 3: Verify it compiles and renders**

Run: `npm run build` then `npm start`.
Expected: under the status bar, a full-width band: Profit (large, emerald/red) · Req X · W/L mult · Total wins · Start bal (input) · Finish bal (input), divided by hairlines. The right column no longer has a Financials box. Editing Start/Finish in the band updates Profit live.

- [ ] **Step 4: Commit**

```bash
git add src/components/HuntTracker.js
git commit -m "feat: full-width stats band with hero profit (Option B)"
```

---

## Task 10: Add-bonus form reorder + autofocus + tour target

**Files:**
- Modify: `src/components/HuntTracker.js` (the collecting add-bonus form, lines ~1063–1145)

- [ ] **Step 1: Reorder the form fields**

In the `{phase === 'collecting' && (...)}` add-bonus form, reorder so the markers row sits just above the Log button: order becomes (1) slot autocomplete, (2) stake input, (3) caller input, (4) the Super / 5-scat two-button grid, (5) Log bonus button. Move the `<div className="grid grid-cols-2 gap-2">` markers block and the `datalist` so the caller input precedes the markers. Wrap the form's outer `<div>` with `data-tour="add-form"` and bump its container padding `p-3 space-y-2` → `p-4 space-y-3`.

The resulting structure:

```jsx
            {phase === 'collecting' && (
              <div data-tour="add-form" className="border border-white/8 bg-zinc-broadcast/40 p-4 space-y-3">
                <SlotAutocomplete
                  value={slotInput}
                  onChange={setSlotInput}
                  placeholder="Slot name"
                  className={`w-full ${inputCls}`}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && addBonus()}
                />
                <input
                  type="number"
                  placeholder="Stake ($)"
                  value={stakeInput}
                  onChange={(e) => setStakeInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addBonus()}
                  className={`w-full ${inputCls}`}
                />
                <input
                  type="text"
                  list="hunt-callers"
                  placeholder="Slot caller (optional)"
                  value={callerInput}
                  onChange={(e) => setCallerInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addBonus()}
                  className={`w-full ${inputCls}`}
                />
                <datalist id="hunt-callers">
                  {gamblers.map((g) => (
                    <option key={g.id} value={g.name} />
                  ))}
                </datalist>
                <div className="grid grid-cols-2 gap-2">
                  {/* Super toggle — unchanged markup, just py-2 -> py-2.5 */}
                  {/* 5-scat toggle — unchanged markup, just py-2 -> py-2.5 */}
                </div>
                <button
                  type="button"
                  onClick={addBonus}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150"
                >
                  <Plus size={14} aria-hidden="true" />
                  <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
                    Log bonus
                  </span>
                </button>
              </div>
            )}
```

For the two toggle buttons, keep the exact existing Super and 5-scat `<button>` markup (lines ~1081–1118) but change each button's `px-3 py-2` to `px-3 py-2.5`. The 5-scat star icon `className` becomes `fiveScatInput ? 'fill-gold-scatter text-gold-scatter' : ''` (was `fill-yellow-400`).

- [ ] **Step 2: Confirm `SlotAutocomplete` accepts `autoFocus`**

Open `src/components/SlotAutocomplete.js` and confirm it spreads props onto its `<input>` or accepts `autoFocus`. If it does not forward arbitrary props, add `autoFocus` to its prop list and pass it to the inner `<input>`. (If it already spreads `...rest` to the input, no change needed.)

- [ ] **Step 3: Verify it compiles and renders**

Run: `npm run build` then `npm start`.
Expected: in collecting phase the form reads slot → stake → caller → [Super | 5-scat] → Log bonus; the slot field is focused on entering collecting; the 5-scat toggle star is gold (`gold-scatter`), not yellow.

- [ ] **Step 4: Commit**

```bash
git add src/components/HuntTracker.js src/components/SlotAutocomplete.js
git commit -m "feat: reorder add-bonus form, autofocus slot, gold-scatter star"
```

---

## Task 11: Opening current-slot card refinements + row star token

**Files:**
- Modify: `src/components/HuntTracker.js` (opening card lines ~942–1059; `SortableBonusRow` star at line ~173; opening-card star at line ~963)

- [ ] **Step 1: Win input on its own row; Prev · Later · Next beneath**

In the opening current-slot card, restructure the controls: put the win `<input>` (lines ~980–998) in its own full-width row (remove it from the `flex flex-wrap` shared with Later). Then a single control row holds three evenly-weighted buttons: Prev, Later, Next. Reuse the existing Prev (lines ~1016–1026), the Later toggle (lines ~999–1013), and Next (lines ~1027–1037) handlers/markup, arranged as:

```jsx
                  <input
                    type="number"
                    autoFocus
                    value={currentBonus.win || ''}
                    onChange={(e) => updateBonusWin(currentBonus.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return;
                      if (openingIdx >= order.length - 1) setShowWrapUp(true);
                      else advanceOpening();
                    }}
                    placeholder="Win ($)"
                    aria-label="Win for current slot"
                    className="w-full bg-zinc-broadcast/70 border border-purple-gamba/50 px-3 py-2 text-base text-right text-white-body focus:border-purple-bright focus:outline-none tabular-nums"
                  />
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {/* Prev button (existing markup), full width of its cell */}
                    {/* Later toggle (existing markup) */}
                    {/* Next button (existing markup, stays purple primary) */}
                  </div>
```

Keep each button's existing onClick/disabled logic; only their container changes from the old two rows to this single 3-col grid. Drop the old `flex flex-wrap items-center gap-2` win+Later row and the separate `flex items-center gap-2 mt-2` Prev/Next row.

- [ ] **Step 2: Add the progress hairline under the card header**

Right after the card header row (the `{openedCount} / {bonuses.length} opened` line, ~line 949–951), add:

```jsx
                  <div className="h-0.5 bg-white/10 mb-2">
                    <div
                      className="h-full bg-purple-bright transition-all"
                      style={{
                        width: `${bonuses.length ? (openedCount / bonuses.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
```

- [ ] **Step 3: Swap star tokens to `gold-scatter`**

Change every 5-scat star fill from `yellow-400` to `gold-scatter`:
- `SortableBonusRow` star (line ~173): `fill-yellow-400 text-yellow-400` → `fill-gold-scatter text-gold-scatter`.
- Opening-card current star (line ~963): `fill-yellow-400 text-yellow-400` → `fill-gold-scatter text-gold-scatter`.
- The collecting-form 5-scat toggle border/active classes that use `yellow-400` (lines ~1105–1107, 1113): `border-yellow-400 bg-yellow-400/10 text-yellow-400` → `border-gold-scatter bg-gold-scatter/10 text-gold-scatter`; `fill-yellow-400` → `fill-gold-scatter`. (If not already done in Task 10 Step 1, do it here.)

- [ ] **Step 4: Verify and commit**

Run: `npm run build` then `npm start`; start opening on a hunt with a few bonuses.
Expected: the win field is its own row, Prev · Later · Next sit evenly beneath, a thin purple progress bar fills with opened count, and every star is gold.

```bash
git add src/components/HuntTracker.js
git commit -m "feat: opening card win row + progress bar + gold-scatter stars"
```

---

## Task 12: Header regroup + `?` tour button + overflow

**Files:**
- Modify: `src/components/HuntTracker.js` (header actions ~748–900; phase toggle grouping ~709–772)

- [ ] **Step 1: Move the phase toggle next to the title**

Move the phase-toggle button (Start opening / Edit bonuses, lines ~749–772) out of the `ml-auto` actions cluster and into the left identity group, right after the title block (after line ~747's closing `</div>` of the name block, still inside the header flex). It sits beside the title as a mode switch.

- [ ] **Step 2: Add the `?` tour button and overflow for Discard**

Add an `aria-expanded` overflow menu to the right cluster. Keep Export split and Complete as direct buttons. Replace the standalone Discard trigger with an overflow `⋯` button that opens a small menu containing "How it works" (opens the tour) and "Discard hunt". Add local state near the other `useState`s:

```js
  const [menuOpen, setMenuOpen] = useState(false);
```

Wrap the Complete + Export buttons with the tour target. The actions cluster becomes:

```jsx
        <div className="ml-auto flex gap-2 items-center" data-html2canvas-ignore="true">
          <div data-tour="complete-actions" className="flex gap-2 items-center">
            {/* Export split button — existing markup */}
            {/* Complete button + its confirm-swap — existing markup */}
          </div>
          {/* Overflow */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              title="More"
              className="w-8 h-8 inline-flex items-center justify-center border border-white/10 text-white/45 hover:text-white-body hover:border-white/30 transition-colors"
            >
              <MoreHorizontal size={14} aria-hidden="true" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 z-30 w-44 border border-white/15 bg-zinc-card shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setTourOpen(true);
                  }}
                  className="w-full text-left px-3 py-2 text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono text-white/70 hover:bg-white/5 inline-flex items-center gap-2"
                >
                  <HelpCircle size={12} aria-hidden="true" /> How it works
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmingDiscard(true);
                  }}
                  className="w-full text-left px-3 py-2 text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono text-white/60 hover:text-red-destructive hover:bg-red-destructive/10 inline-flex items-center gap-2"
                >
                  <Trash2 size={12} aria-hidden="true" /> Discard hunt
                </button>
              </div>
            )}
          </div>
        </div>
```

Keep the existing `confirmingDiscard` confirm UI, but render it as a small inline confirm row beneath the header (or where it already renders) when `confirmingDiscard` is true; remove the old always-visible Discard trigger button. Keep the existing rule that hides Complete's trigger while `confirmingDiscard` and Discard while `confirmingComplete`.

- [ ] **Step 3: Add imports + tour state**

Add to the lucide import: `HelpCircle, MoreHorizontal`. Add tour state near the other `useState`s:

```js
  const [tourOpen, setTourOpen] = useState(false);
```

(The auto-open wiring is Task 14; this just creates the state + the replay entry point.)

- [ ] **Step 4: Verify and commit**

Run: `npm run build` then `npm start`.
Expected: phase toggle sits by the title; right cluster is Export, Complete, and a `⋯` menu; the menu has "How it works" and "Discard hunt". No always-visible Discard button. Clicking "How it works" sets `tourOpen` (tour renders once Task 13/14 land — until then it is a no-op or guarded).

```bash
git add src/components/HuntTracker.js
git commit -m "feat: regroup header, add tour button + overflow menu"
```

---

## Task 13: `HuntTour` overlay + step engine (TDD on the engine)

**Files:**
- Create: `src/components/HuntTour.js`
- Test: `src/components/__tests__/HuntTour.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/HuntTour.test.js`:

```js
import { render, screen, fireEvent } from '@testing-library/react';
import HuntTour from '../HuntTour';

describe('HuntTour', () => {
  it('renders step 1 of 6 on open', () => {
    render(<HuntTour open onClose={() => {}} />);
    expect(screen.getByText(/1 \/ 6/)).toBeInTheDocument();
  });

  it('advances on Next and calls onClose with Done on the last step', () => {
    const onClose = jest.fn();
    render(<HuntTour open onClose={onClose} />);
    // 5 Nexts to reach step 6, then Done
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
    }
    expect(screen.getByText(/6 \/ 6/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /done/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('Skip closes immediately', () => {
    const onClose = jest.fn();
    render(<HuntTour open onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing when open=false', () => {
    const { container } = render(<HuntTour open={false} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --watchAll=false --testPathPattern=HuntTour`
Expected: FAIL — "Cannot find module '../HuntTour'".

- [ ] **Step 3: Implement `HuntTour`**

Create `src/components/HuntTour.js`. The step engine drives index 0–5; each step has a `target` (a `data-tour` key or null) and copy. On render it measures the target via `getBoundingClientRect()`; if present and non-zero it spotlights, else it centers a fallback card. Spotlight uses a `box-shadow: 0 0 0 9999px rgba(0,0,0,0.38)` ring at ~38% dim + emerald ring/glow; transitions gated by `prefers-reduced-motion`.

```js
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { HelpCircle } from 'lucide-react';

const STEPS = [
  {
    target: null,
    title: 'Welcome to the hunt tracker',
    body: 'Log bonuses, open them on stream, and split the result with your squad. Here is the quick tour.',
  },
  {
    target: 'share-bar',
    title: 'Your two links',
    body: 'Go live so spectators can watch the hunt, and open a collect link so viewers can submit slot picks. Both live right here.',
  },
  {
    target: 'suggestions',
    title: 'Where suggestions land',
    body: 'Picks from your collect link show up here, grouped by who sent them. Tap a slot to mark it in bonus.',
  },
  {
    target: null,
    title: 'Accept or reject a pick',
    body: 'When a suggested slot bonuses, hit "Got in" to add it to your list with the suggester as the caller. Hit "Nope" if it did not.',
  },
  {
    target: 'add-form',
    title: 'Log and open bonuses',
    body: 'Type a slot, set the stake, tag who called it, then log it. Start opening when the list is set.',
  },
  {
    target: 'complete-actions',
    title: 'Finish up',
    body: 'Complete saves the hunt to your history and exports the recap. Export split shares the squad payout any time.',
  },
];

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function HuntTour({ open, onClose }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);

  const step = STEPS[i];

  const measure = useCallback(() => {
    if (!step?.target) {
      setRect(null);
      return;
    }
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) {
      setRect(null);
      return;
    }
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step]);

  useLayoutEffect(() => {
    if (open) measure();
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') next();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, i]);

  useEffect(() => {
    if (open) setI(0);
  }, [open]);

  const close = () => {
    onClose?.();
  };
  const next = () => {
    if (i >= STEPS.length - 1) close();
    else setI((n) => n + 1);
  };
  const back = () => setI((n) => Math.max(0, n - 1));

  if (!open) return null;

  const reduce = prefersReducedMotion();
  const pad = 6;
  const spotlit = !!rect;

  const cardStyle = spotlit
    ? (() => {
        const below = rect.top + rect.height + 12;
        const wantAbove = below + 180 > window.innerHeight;
        return {
          position: 'fixed',
          left: Math.min(Math.max(8, rect.left), window.innerWidth - 320),
          top: wantAbove ? Math.max(8, rect.top - 192) : below,
          width: 300,
        };
      })()
    : {
        position: 'fixed',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: 320,
      };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Hunt tracker tour">
      {/* Dim layer + spotlight */}
      {spotlit ? (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.38), 0 0 22px 4px rgba(16,185,129,0.45)',
            border: '2px solid #10b981',
            borderRadius: 2,
            transition: reduce ? 'none' : 'all 0.22s ease',
            pointerEvents: 'none',
          }}
        />
      ) : (
        <div aria-hidden="true" className="fixed inset-0 bg-black/[0.38]" />
      )}

      {/* Tooltip / fallback card */}
      <div
        style={cardStyle}
        className="border border-emerald-signal/40 bg-zinc-card p-4 shadow-xl"
      >
        <button
          type="button"
          onClick={close}
          className="absolute top-2.5 right-3 text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono text-white/45 hover:text-white-body"
        >
          Skip ✕
        </button>
        <p className="inline-flex items-center gap-1.5 text-[9px] font-bold tracking-eyebrow-lg uppercase font-mono text-emerald-signal mb-1">
          <HelpCircle size={11} aria-hidden="true" /> Tour
        </p>
        <h4 className="font-black text-white-body text-base leading-tight mb-1.5">{step.title}</h4>
        <p className="text-[12px] text-white/65 leading-snug mb-3">{step.body}</p>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-white/40 mr-auto tabular-nums">
            {i + 1} / {STEPS.length}
          </span>
          <button
            type="button"
            onClick={back}
            disabled={i === 0}
            className="px-2.5 py-1.5 border border-white/10 text-white/60 hover:text-white-body transition-colors disabled:opacity-30 text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono"
          >
            Back
          </button>
          <button
            type="button"
            onClick={next}
            className="px-3 py-1.5 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono"
          >
            {i >= STEPS.length - 1 ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- --watchAll=false --testPathPattern=HuntTour`
Expected: PASS (4 tests). (In jsdom `getBoundingClientRect` returns zeros, so steps fall back to the centered card — the engine/controls still work, which is what the test covers.)

- [ ] **Step 5: Commit**

```bash
git add src/components/HuntTour.js src/components/__tests__/HuntTour.test.js
git commit -m "feat: add HuntTour coachmark overlay + step engine"
```

---

## Task 14: Wire the tour into HuntTracker (auto-open + replay)

**Files:**
- Modify: `src/components/HuntTracker.js` (import `HuntTour` + `useFirstVisit`; auto-open effect; render `<HuntTour>`)

- [ ] **Step 1: Add imports**

```js
import HuntTour from './HuntTour';
import { useFirstVisit } from '../hooks/useFirstVisit';
```

- [ ] **Step 2: Add the first-visit gate + auto-open**

Near the other hooks/state at the top of `HuntTracker` (after `const store = useHuntStore();` block), add:

```js
  const [tourSeen, markTourSeen] = useFirstVisit('huntTourSeen');
```

(The `tourOpen` state was added in Task 12.) After the `status`/`activeHunt` are known and before the active return, add an effect that auto-opens once for a logged-in owner on the active view:

```js
  useEffect(() => {
    if (status === 'active' && isLoggedIn && !tourSeen) {
      setTourOpen(true);
    }
  }, [status, isLoggedIn, tourSeen]);
```

Add `useEffect` to the React import if not present (`import { useState, useEffect } from 'react';`).

- [ ] **Step 3: Render the tour**

At the end of the active-hunt return (just before the final closing `</div>` of the component's root, alongside the modals), render:

```jsx
      <HuntTour
        open={tourOpen}
        onClose={() => {
          setTourOpen(false);
          markTourSeen();
        }}
      />
```

- [ ] **Step 4: Manual verification**

Run: `npm start`. In the browser devtools console run `localStorage.removeItem('huntTourSeen')`, reload, log in as owner, open a hunt.
Expected: the tour auto-opens at step 1; Next walks the steps (share bar and add-form spotlight when present; suggestions spotlights if the panel is on screen, else a centered card); Skip/Done closes and sets the flag. Reload — it does NOT reopen. Open `⋯` → "How it works" — it replays regardless of the flag.

- [ ] **Step 5: Commit**

```bash
git add src/components/HuntTracker.js
git commit -m "feat: wire HuntTour auto-open (first visit) + replay"
```

---

## Task 15: Height-capped scroll on bonus list + squad split

**Files:**
- Modify: `src/components/HuntTracker.js` (bonus table wrapper ~1152; squad table wrapper ~1356; import `CappedScroll`)

- [ ] **Step 1: Import `CappedScroll`**

```js
import CappedScroll from './CappedScroll';
```

- [ ] **Step 2: Wrap the bonus list rows in a capped scroll with pinned header + totals**

The bonus list currently is `<div className="border border-white/8 overflow-x-auto ..."><div className="min-w-[480px] text-sm"> [header] [DndContext rows] [totals] </div></div>` (lines ~1152–1243). Wrap the inner content so the rows scroll while the column header and totals pin. Concretely, put the column-header row and totals row OUTSIDE the scroll, or make them `position: sticky`. Simplest with the existing grid layout: keep the structure, wrap only the rows region in `CappedScroll`, and make the header/totals sticky.

Change the structure to:

```jsx
              <div className="border border-white/8 overflow-x-auto [scrollbar-width:thin]">
                <div className="min-w-[480px] text-sm">
                  {/* Column headers — make sticky */}
                  <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-2 items-center px-2 py-2 border-b border-white/10 bg-zinc-broadcast/50 sticky top-0 z-10 text-white/65 text-[10px] uppercase tracking-eyebrow-md font-mono font-bold">
                    {/* ...existing header cells... */}
                  </div>
                  <CappedScroll maxClass="max-h-[60vh]">
                    {/* DndContext + SortableContext + rows — unchanged */}
                  </CappedScroll>
                  {/* Totals — make sticky bottom */}
                  <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-2 items-center px-2 py-2 border-t border-white/10 bg-zinc-broadcast/50 sticky bottom-0 z-10 text-[10px] uppercase tracking-eyebrow-md font-mono font-bold text-white/70">
                    {/* ...existing totals cells... */}
                  </div>
                </div>
              </div>
```

Note: because the header/totals are siblings of the scroll box (not inside it), `sticky` on them is belt-and-suspenders; the key behavior is the rows scrolling inside `CappedScroll` while header/totals stay fixed in the panel. Keep the `DndContext`/`SortableContext`/`rowList.map` exactly as-is inside `CappedScroll`.

- [ ] **Step 3: Wrap the squad table body in a capped scroll**

The squad split is a `<table>` inside `<div className="border border-white/8 overflow-x-auto ...">` (lines ~1356–1456). Add a vertical cap with sticky `thead`/`tfoot`. On the wrapping div, add `max-h-[60vh] overflow-y-auto`, and make the table's `thead tr` and `tfoot tr` sticky:

- Wrapper div: add `max-h-[60vh] overflow-y-auto` to its className.
- `thead tr`: add `sticky top-0 z-10` (it already has `bg-zinc-broadcast/50`).
- `tfoot tr`: add `sticky bottom-0 z-10` (it already has `bg-zinc-broadcast/50`).

- [ ] **Step 4: Verify**

Run: `npm run build` then `npm start`. Add ~20 bonuses and several squad members.
Expected: the bonus list and squad table each cap their height and scroll internally; the bonus column header stays pinned at the top and the Totals row at the bottom while rows scroll between; a short hunt (few rows) shows no scrollbar.

- [ ] **Step 5: Commit**

```bash
git add src/components/HuntTracker.js
git commit -m "feat: cap bonus list + squad split height with internal scroll"
```

---

## Task 16: Secondary polish (panel numbering, quiet column, empty states, em dash, caller icons)

**Files:**
- Modify: `src/components/HuntTracker.js` (`PanelLabel` usages; empty-state strings; soft-banned placeholder ~1468; caller highlight icons ~1531–1551)
- Modify: `src/components/SuggestionsPanel.js` (its "06" code; "No suggestions imported." string)

- [ ] **Step 1: Drop numeric codes from secondary panels**

The `PanelLabel` component takes a `code` prop. Keep `code="01"` on the bonus list. The stats band already has no code. For the right-column panels, remove the `code` from `PanelLabel` calls for Squad split (was 03), Soft banned (was 04), and Caller stats (was 07), and from `SuggestionsPanel`'s hardcoded "06". To support a code-less label, make `PanelLabel` render the code span only when `code` is truthy:

In `PanelLabel` (lines ~63–79), change the code span to:

```jsx
      {code && <span className={`${color} tabular-nums`}>{code}</span>}
```

Then remove the `code="03"`, `code="04"`, `code="07"` props from those three `PanelLabel` usages. In `SuggestionsPanel.js`, remove the hardcoded `06` span from its section header (lines ~415–417), leaving the icon + "Suggestions" label.

- [ ] **Step 2: Dim the quiet right column labels**

`PanelLabel` uses `text-white/65` on its label text. Add an optional `quiet` prop that lowers it to `text-white/50`, and pass `quiet` to the right-column labels (Squad split, Soft banned, Caller stats). In `PanelLabel`:

```jsx
function PanelLabel({ code, icon: Icon, label, accent = 'emerald', quiet = false }) {
```

and change the wrapper text class from `text-white/65` to `${quiet ? 'text-white/50' : 'text-white/65'}`.

- [ ] **Step 3: Soften empty states + fix the em dash**

- Bonus list empty (line ~1148): "No bonuses logged." → "Nothing logged yet."
- Squad empty (line ~1352): "No squad added." → "No squad yet."
- Caller empty (line ~1502): "No calls tagged." → "No calls tagged yet."
- Soft-banned placeholder (line ~1468): replace the em dash: "Slots to avoid this hunt — comma or newline separated." → "Slots to avoid this hunt. Comma or newline separated."
- In `SuggestionsPanel.js` (line ~540): "No suggestions imported." → "Nothing imported yet."

Keep these as sentence case; you may drop the `uppercase tracking-eyebrow-lg` on the empty-state `<p>`s to soften them (optional, low-risk), but at minimum change the text.

- [ ] **Step 4: Unify caller-stats highlight icons**

The three caller highlight cards use a lucide `Trophy` (line ~1531), a 🧱 emoji (line ~1541), and no icon (line ~1550). Make all three use a lucide icon: keep `Trophy` for Best call; use `Brick`-less alternative for "Brick of the hunt" — use the lucide `TrendingDown` icon (already imported) with `text-red-destructive`; for "Most consistent" add a lucide `Target` icon. Add `Target` to the lucide import. Replace the `🧱` text with `<TrendingDown size={11} aria-hidden="true" />` inside the existing `<p>`.

- [ ] **Step 5: Verify and commit**

Run: `npm run build` then `npm start`.
Expected: right-column panels have no numbers and slightly dimmer labels; empty states read in sentence case; the soft-banned placeholder has no em dash; all three caller highlights use lucide icons.

```bash
git add src/components/HuntTracker.js src/components/SuggestionsPanel.js
git commit -m "polish: panel numbering, quiet labels, empty states, caller icons"
```

---

## Task 17: HuntStartScreen sizing parity

**Files:**
- Modify: `src/components/HuntStartScreen.js` (Start button + spacing)

- [ ] **Step 1: Nudge sizing**

The start form inputs are already `py-2.5` (good). Bump the Start hunt button (lines ~120–128) from `py-2.5` to `py-3` and the form `space-y-3` to `space-y-4` so the primary action matches the enlarged tracker forms. Small change only.

- [ ] **Step 2: Verify and commit**

Run: `npm run build` then `npm start`; open the start screen.
Expected: slightly roomier start form, Start button a touch taller.

```bash
git add src/components/HuntStartScreen.js
git commit -m "style: start screen sizing parity"
```

---

## Task 18: Full PR 1 verification

**Files:** none (verification only)

- [ ] **Step 1: Run all unit tests**

Run: `npm test -- --watchAll=false`
Expected: all tests pass, including the new `useFirstVisit`, `CopyLinkButton`, `StatCell`, `HuntTour` suites and the existing Leaderboard/hook suites.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: "Compiled successfully", no lint errors.

- [ ] **Step 3: Manual smoke (owner)**

Run `npm start`, log in as owner (`luimeneghim@gmail.com`), go to `/gamba/hunt-tracker`:
- Clear the flag: devtools console `localStorage.removeItem('huntTourSeen')`, reload.
- Start a hunt → tour auto-opens once → Skip → reload → does not reopen → `⋯` "How it works" replays.
- Share bar: Go live and Create collect link both work; Copy/Stop/Close legible; URLs correct.
- Stats band: Profit hero updates when you edit Start/Finish; band is one hairline-divided row.
- Add a bonus: form order is slot → stake → caller → markers → Log; slot autofocused; 5-scat star is gold.
- Start opening: win field its own row, Prev · Later · Next beneath, progress bar fills.
- Add 20+ bonuses + squad: both lists cap height and scroll with pinned header/totals.
- Right column: no panel numbers, dimmer labels; empty states sentence case.
- Resize to phone width: share bar stacks, stats band reflows to 2×2, a bonus row is reachable in one scroll.

- [ ] **Step 4: Open the PR**

```bash
git push -u origin HEAD
gh pr create --title "Hunt tracker redesign (PR 1: owner tracker)" --body "$(cat <<'EOF'
Implements PR 1 of the hunt tracker UX redesign spec (docs/superpowers/specs/2026-06-01-hunt-tracker-ux-redesign-design.md):

- WATCH/COLLECT share bar co-locating the live + collect links under the header
- Option B layout: full-width stats band with hero Profit; quiet right column
- First-visit coachmark tour (HuntTour) with replay via the header overflow
- Height-capped bonus list + squad split with pinned header/totals
- Reordered add-bonus form, opening-card refinements, gold-scatter star token
- Secondary polish: panel numbering, quiet labels, empty-state copy, caller icons

Pure frontend; no data/Firestore/serverless/route changes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

(Branch first if on `main`: `git checkout -b feat/hunt-tracker-redesign-pr1` before pushing.)

---

## Self-Review Notes (for the implementer)

- If `git status` shows you are on `main`, create a feature branch before the first commit (`git checkout -b feat/hunt-tracker-redesign-pr1`). Commit per task as written.
- Line numbers in this plan are approximate (the file is ~1700 lines and shifts as you edit). Search by the surrounding code/strings quoted, not raw line numbers.
- If `SlotAutocomplete` already forwards `autoFocus`, skip that edit in Task 10.
- The `data-html2canvas-ignore="true"` attribute matters: the export-to-image feature (`renderSplit`/`renderRecap`) must not capture the share bar or action buttons. The bar in Task 8 includes it; keep it.
