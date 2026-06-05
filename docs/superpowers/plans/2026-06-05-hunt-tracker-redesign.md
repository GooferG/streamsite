# Hunt Tracker Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-express the `/gamba` Hunt Tracker in the redesign handoff's layout and add a cross-hunt caller reputation layer, preserving every existing capability.

**Architecture:** First extend the pure stat math (`huntCalc.js`) with backward-compatible reputation, fully unit-tested. Then extract the 1850-line `HuntTracker.js` into focused presentational components with no behavior change. Then relayout into the handoff structure (hero P/L, stat grid, work grid, panels), upgrade opening to a focus card with hotkeys + notes, add the caller-stats panel + call-log drawer, and reconcile viewer-calls grouped Add/Skip with the existing intake flow.

**Tech Stack:** React 19, CRA + react-scripts (Jest + React Testing Library), Tailwind, dnd-kit, Firebase/Firestore (via `useHuntStore`), lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-06-05-hunt-tracker-redesign-design.md`
**Visual source of truth:** `docs/redesign/design_handoff_hunt_tracker/` (open `Hunt Tracker.html` in a browser; `data.js` has the exact stat algorithms).

---

## Conventions for this plan

- **Test runner:** `npm test -- --watchAll=false --testPathPattern=<name>` for one-shot. Jest is via react-scripts; `CI=true` also forces one-shot.
- **Tokens (`/gamba` register):** emerald `text-emerald-signal` (positive/primary), purple `text-purple-bright`/`purple-gamba` (community), red `text-red-destructive` (loss/brick), gold `text-gold-scatter`. Surfaces `bg-zinc-card/30`, `bg-zinc-broadcast/40`, borders `border-white/8`. Mono labels `font-mono` + `tracking-eyebrow-lg uppercase`. No box-shadow. `rounded-lg` for cards.
- **No webfonts, no violet "studio" theme** from the prototype.
- **Preserve:** dnd-kit reorder, `ScatterPill` tiers + hidden modifier, deferred "Later", `callerHot`, `HuntLinkControls` password intake, stake-sort lens, `HuntTour`, share/live mirror, anon-localStorage/logged-in-Firestore split. If a prototype element conflicts with one of these, keep the repo capability and house it in the prototype's slot.
- **Commit style:** short imperative subject, no `Co-Authored-By` trailer (per global + project instruction).

---

## File Structure

**Modified:**
- `src/utils/huntCalc.js` — extend `computeCallerStats` (backward-compatible) + reputation helpers.
- `src/utils/__tests__/huntCalc.test.js` — add reputation tests.
- `src/components/HuntTracker.js` — becomes the orchestrator; markup moves into the new components below.
- `src/components/HuntHistory.js` — caller link → drawer + compact caller block (uses extended stats).
- `src/hooks/useHuntStore.js` — add `skippedCalls` to hunt shape (additive).

**Created (component extraction + new surfaces):**
- `src/components/hunt/PanelLabel.js` — extracted shared label (currently inline in HuntTracker).
- `src/components/hunt/BonusTable.js` — bonus rows + DnD + scatter + inline edits + amber pending/Open.
- `src/components/hunt/HuntHero.js` — P/L hero card.
- `src/components/hunt/HuntStatGrid.js` — 4-up secondary stat grid.
- `src/components/hunt/OpeningFocus.js` — centered opening focus card + hotkeys + notes.
- `src/components/hunt/ViewerCalls.js` — grouped Add/Skip viewer-calls panel.
- `src/components/hunt/CallerStatsPanel.js` — panel `05` (highlights + table).
- `src/components/hunt/CallerLogDrawer.js` — caller call-log modal.
- `src/components/hunt/FormStrip.js` + `src/components/hunt/StatusBadge.js` — small shared bits for reputation UI.

> Rationale: HuntTracker is ~1850 lines. Splitting by responsibility into `src/components/hunt/` keeps each file focused and testable. Extraction (Tasks 3–5) is behavior-preserving before any relayout.

---

## Task 1: Extend caller reputation math — leaderboard rows

**Files:**
- Modify: `src/utils/huntCalc.js:131-179` (`computeCallerStats`)
- Test: `src/utils/__tests__/huntCalc.test.js`

**Backward-compat contract:** `computeCallerStats(bonuses, history = [], skippedCalls = [])`. Existing callers pass only `bonuses` — they must keep working. The returned object MUST still include `leaderboard`, `bestCall`, `worstCall`, and `bestAvgCaller` (alias of `mostConsistent`). New keys: per-row `gotIn, missed, calls, acceptRate, avgX, best, plays, form, status, hotStreak, coldStreak`; top-level `mostConsistent, hotCaller, coldCaller`.

- [ ] **Step 1: Write failing tests for reputation rows**

Add to `src/utils/__tests__/huntCalc.test.js`:

```javascript
import { computeStats, bestWorstSlot, computeCallerStats } from '../huntCalc';

describe('computeCallerStats — reputation layer', () => {
  // Caller "Ana": current hunt 2 calls (one played 100x, one unopened),
  // history 1 played call at 30x. "Bo": 1 played call at 0.5x (brick).
  const CURRENT = [
    { slot: 'Big Bass', stake: 10, win: 1000, caller: 'Ana' }, // 100x played
    { slot: 'Gates', stake: 10, win: 0, caller: 'Ana' },       // gotIn, not played
    { slot: 'Doom', stake: 10, win: 5, caller: 'Bo' },         // 0.5x brick
  ];
  const HISTORY = [
    { bonuses: [{ slot: 'Wanted', stake: 10, win: 300, caller: 'Ana' }] }, // 30x
  ];
  const SKIPS = [{ caller: 'Bo', slot: 'Skipped Slot' }];

  test('seeds gotIn from current + history, missed from skips', () => {
    const s = computeCallerStats(CURRENT, HISTORY, SKIPS);
    const ana = s.leaderboard.find((r) => r.name === 'Ana');
    const bo = s.leaderboard.find((r) => r.name === 'Bo');
    expect(ana.gotIn).toBe(3);   // 2 current + 1 history
    expect(ana.missed).toBe(0);
    expect(bo.gotIn).toBe(1);
    expect(bo.missed).toBe(1);   // one skip
    expect(bo.calls).toBe(2);
    expect(bo.acceptRate).toBeCloseTo(0.5, 2);
  });

  test('avgX / best / plays use played calls across current + history', () => {
    const s = computeCallerStats(CURRENT, HISTORY, SKIPS);
    const ana = s.leaderboard.find((r) => r.name === 'Ana');
    // played X: 100 (current) + 30 (history) -> avg 65, best 100, plays 2
    expect(ana.plays).toBe(2);
    expect(ana.best).toBeCloseTo(100, 2);
    expect(ana.avgX).toBeCloseTo(65, 2);
  });

  test('status: hot when avgX>=25 and acceptRate>=0.6, cold on low accept', () => {
    const s = computeCallerStats(CURRENT, HISTORY, SKIPS);
    const ana = s.leaderboard.find((r) => r.name === 'Ana');
    expect(ana.status).toBe('hot'); // avg 65, accept 1.0
  });

  test('backward compatible: one-arg call still returns legacy keys', () => {
    const s = computeCallerStats(CURRENT);
    expect(Array.isArray(s.leaderboard)).toBe(true);
    expect(s).toHaveProperty('bestCall');
    expect(s).toHaveProperty('worstCall');
    expect(s).toHaveProperty('bestAvgCaller'); // legacy alias preserved
  });

  test('empty input returns empty leaderboard and null highlights', () => {
    const s = computeCallerStats([]);
    expect(s.leaderboard).toEqual([]);
    expect(s.bestCall).toBeNull();
    expect(s.hotCaller).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --watchAll=false --testPathPattern=huntCalc`
Expected: FAIL — new assertions error (rows lack `gotIn`/`status`/etc.).

- [ ] **Step 3: Rewrite `computeCallerStats` with the reputation layer**

Replace `computeCallerStats` in `src/utils/huntCalc.js` (lines ~131-179) with:

```javascript
// Tunable thresholds for the "fun stat" reputation layer. Adjust here only.
const REP = {
  winX: 20,      // form pip "win" / hot-pace threshold
  brickX: 1,     // form pip "brick" / cold-pace threshold
  hotAvgX: 25,
  hotAccept: 0.6,
  coldAccept: 0.35,
  streakLen: 2,
  minColdCalls: 3,
};

function playedX(b) {
  const stake = Number(b.stake) || 0;
  const win = Number(b.win) || 0;
  return stake > 0 && win > 0 ? win / stake : null;
}

/**
 * Slot-caller leaderboard + cross-hunt reputation.
 * @param {Array} bonuses        current hunt bonuses (with caller, stake, win)
 * @param {Array} history        completed hunts [{ bonuses:[...] }] for prior plays
 * @param {Array} skippedCalls   [{ caller }] viewer calls skipped this hunt
 * Backward compatible: history/skippedCalls default to []. Legacy keys
 * (leaderboard, bestCall, worstCall, bestAvgCaller) are preserved.
 */
export function computeCallerStats(bonuses, history = [], skippedCalls = []) {
  const cur = (bonuses ?? []).filter((b) => (b.caller || '').trim() !== '');

  // Per-caller accumulator.
  const map = new Map();
  const ensure = (name) => {
    if (!map.has(name)) {
      map.set(name, { name, gotIn: 0, missed: 0, xs: [] });
    }
    return map.get(name);
  };

  // History first (older plays at the front of each caller's X list).
  for (const h of history ?? []) {
    for (const b of h.bonuses ?? []) {
      const name = (b.caller || '').trim();
      if (!name) continue;
      const rec = ensure(name);
      rec.gotIn += 1;
      const x = playedX(b);
      if (x != null) rec.xs.push(x);
    }
  }
  // Current hunt.
  for (const b of cur) {
    const name = b.caller.trim();
    const rec = ensure(name);
    rec.gotIn += 1;
    const x = playedX(b);
    if (x != null) rec.xs.push(x);
  }
  // Skips → missed.
  for (const s of skippedCalls ?? []) {
    const name = (s.caller || '').trim();
    if (!name) continue;
    ensure(name).missed += 1;
  }

  const formPip = (x) => (x >= REP.winX ? 'win' : x < REP.brickX ? 'brick' : 'ok');
  const trailingRun = (xs, pred) => {
    let n = 0;
    for (let i = xs.length - 1; i >= 0 && pred(xs[i]); i--) n += 1;
    return n;
  };

  const leaderboard = [...map.values()]
    .map((rec) => {
      const calls = rec.gotIn + rec.missed;
      const plays = rec.xs.length;
      const avgX = plays ? rec.xs.reduce((s, x) => s + x, 0) / plays : null;
      const best = plays ? Math.max(...rec.xs) : null;
      const acceptRate = calls ? rec.gotIn / calls : 0;
      const form = rec.xs.slice(-5).map(formPip);
      const hotStreak = trailingRun(rec.xs, (x) => x >= REP.winX);
      const coldStreak = trailingRun(rec.xs, (x) => x < REP.brickX);
      let status = 'steady';
      if (hotStreak >= REP.streakLen || (avgX != null && avgX >= REP.hotAvgX && acceptRate >= REP.hotAccept)) {
        status = 'hot';
      } else if (coldStreak >= REP.streakLen || (acceptRate < REP.coldAccept && calls >= REP.minColdCalls)) {
        status = 'cold';
      }
      return {
        name: rec.name, calls, gotIn: rec.gotIn, missed: rec.missed,
        acceptRate, avgX, best, plays, form, status, hotStreak, coldStreak,
      };
    })
    .sort((a, b) => b.calls - a.calls || a.name.localeCompare(b.name));

  // Best/worst single call — current hunt played bonuses only (the "this hunt" highlight).
  let bestCall = null;
  let worstCall = null;
  for (const b of cur) {
    const x = playedX(b);
    if (x == null) continue;
    const cand = { slot: b.slot, x, caller: b.caller.trim() };
    if (!bestCall || x > bestCall.x) bestCall = cand;
    if (!worstCall || x < worstCall.x) worstCall = cand;
  }

  const withPlays = leaderboard.filter((r) => r.plays >= 2);
  const mostConsistent = withPlays.reduce(
    (best, r) => (!best || r.avgX > best.avgX ? r : best), null
  );
  const hotRows = leaderboard.filter((r) => r.status === 'hot');
  const hotCaller = hotRows.reduce(
    (best, r) => (!best || (r.avgX ?? 0) > (best.avgX ?? 0) ? r : best), null
  );
  const coldRows = leaderboard.filter((r) => r.status === 'cold');
  const coldCaller = coldRows.reduce(
    (worst, r) => (!worst || r.acceptRate < worst.acceptRate ? r : worst), null
  );

  return {
    leaderboard, bestCall, worstCall,
    mostConsistent, hotCaller, coldCaller,
    bestAvgCaller: mostConsistent, // legacy alias
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --watchAll=false --testPathPattern=huntCalc`
Expected: PASS (all new + existing huntCalc tests).

- [ ] **Step 5: Verify existing call sites still compile**

Run: `npm test -- --watchAll=false --testPathPattern="HuntTour|StatCell"`
Expected: PASS (sanity that the shared module still imports). Then visually confirm no other test references the old shape.

- [ ] **Step 6: Commit**

```bash
git add src/utils/huntCalc.js src/utils/__tests__/huntCalc.test.js
git commit -m "feat(hunt): cross-hunt caller reputation in computeCallerStats"
```

---

## Task 2: Add `skippedCalls` to the hunt shape

**Files:**
- Modify: `src/hooks/useHuntStore.js:35-46` (`EMPTY_HUNT`)
- Modify: `src/components/HuntTracker.js` (read `skippedCalls` from `activeHunt`)

This is additive: a new array field that flows through the existing `updateHunt` merge-write. No rules change (owner writes it).

- [ ] **Step 1: Add the field to EMPTY_HUNT**

In `src/hooks/useHuntStore.js`, inside `EMPTY_HUNT`'s returned object (after `bannedSlots: ''`):

```javascript
    bannedSlots: '',
    skippedCalls: [],
```

- [ ] **Step 2: Read it in HuntTracker active section**

In `src/components/HuntTracker.js`, in the ACTIVE block near line 391-397 where other hunt fields are destructured, add:

```javascript
  const skippedCalls = activeHunt.skippedCalls ?? [];
```

- [ ] **Step 3: Build passes**

Run: `npm test -- --watchAll=false --testPathPattern=huntCalc`
Expected: PASS (no behavior change yet; this just wires the field).

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useHuntStore.js src/components/HuntTracker.js
git commit -m "feat(hunt): add skippedCalls field to hunt shape"
```

---

## Task 3: Extract `PanelLabel` and `BonusTable` (behavior-preserving)

**Files:**
- Create: `src/components/hunt/PanelLabel.js`
- Create: `src/components/hunt/BonusTable.js`
- Modify: `src/components/HuntTracker.js` (import + replace inline markup)

Move the inline `PanelLabel` (HuntTracker.js:70-88) and the bonus-table block (the `SortableBonusRow` + the table render in the LEFT column) into dedicated files. **No visual or behavior change** — pure extraction. `BonusTable` receives all handlers as props.

- [ ] **Step 1: Create `PanelLabel.js`**

```javascript
// src/components/hunt/PanelLabel.js
export default function PanelLabel({ code, icon: Icon, label, accent = 'emerald', quiet = false }) {
  const color =
    accent === 'orange'
      ? 'text-orange-admin'
      : accent === 'purple'
        ? 'text-purple-bright'
        : 'text-emerald-signal';
  return (
    <div
      className={`flex items-center gap-3 text-[10px] font-bold uppercase tracking-eyebrow-lg font-mono ${quiet ? 'text-white/50' : 'text-white/65'}`}
    >
      {code && <span className={`${color} tabular-nums`}>{code}</span>}
      <span className="inline-flex items-center gap-1.5">
        {Icon && <Icon size={12} aria-hidden="true" className={color} />}
        <span>{label}</span>
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Create `BonusTable.js`**

Move `SortableBonusRow` (HuntTracker.js:90-284) and the table render (the `bonuses.length === 0 ? … : <div className="border …">` block in the LEFT column, ~lines 1348-1451) into `BonusTable.js`. Export a `BonusTable` component with this prop interface (the engineer copies the existing JSX verbatim; only the data/handlers become props):

```javascript
// src/components/hunt/BonusTable.js
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { X, GripVertical, Play, Clock, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import ScatterPill from '../ScatterPill';
import CappedScroll from '../CappedScroll';
import { scatterTierKey } from '../../utils/scatterTier';
import { fmt, fmtX } from '../../utils/huntCalc';

// SortableBonusRow: paste the existing component body unchanged from HuntTracker.js.
// (kept internal to this file)

export default function BonusTable({
  rowList, reqX, phase, currentBonus, totalStakes, totalWins,
  bonusSort, onCycleStakeSort,
  onJump, onWin, onStake, onRemove, onSetTier, onToggleHidden, onDefer, onCaller,
  editingCallerId, setEditingCallerId, onDragEnd,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  // Paste the existing table JSX (headers + CappedScroll + DnD + totals)
  // verbatim, sourcing rows from rowList and wiring the handler props above.
  // No structural change in this task.
}
```

- [ ] **Step 3: Wire into HuntTracker**

In `src/components/HuntTracker.js`: delete the inline `PanelLabel` and `SortableBonusRow` definitions and the inline table JSX; import the two new components; render `<BonusTable .../>` with the existing `rowList`, `reqX`, `phase`, `handleBonusDragEnd`, `cycleStakeSort`, etc. Keep `PanelLabel` usages pointing at the import.

- [ ] **Step 4: Manual smoke test (no unit test for pure extraction)**

Run: `npm start`, open `/gamba/hunt-tracker`. Verify: add a bonus, drag to reorder, toggle scatter tier, edit caller inline, stake-sort header cycles, totals correct. Behavior identical to before.

- [ ] **Step 5: Commit**

```bash
git add src/components/hunt/PanelLabel.js src/components/hunt/BonusTable.js src/components/HuntTracker.js
git commit -m "refactor(hunt): extract PanelLabel and BonusTable (no behavior change)"
```

---

## Task 4: Extract `FormStrip`, `StatusBadge`, `CallerStatsPanel`, `CallerLogDrawer`

**Files:**
- Create: `src/components/hunt/FormStrip.js`
- Create: `src/components/hunt/StatusBadge.js`
- Create: `src/components/hunt/CallerStatsPanel.js`
- Create: `src/components/hunt/CallerLogDrawer.js`
- Test: `src/components/hunt/__tests__/CallerStatsPanel.test.js`

This task builds the panel `05` + drawer fresh (the prototype's design), driven by the Task 1 stats. The existing inline caller-stats block in HuntTracker (lines ~1626-1696) will be replaced by `<CallerStatsPanel>` in Task 7.

- [ ] **Step 1: Create `FormStrip.js` and `StatusBadge.js`**

```javascript
// src/components/hunt/FormStrip.js
// Recent-calls pip strip (newest right). f ∈ 'win' | 'ok' | 'brick'.
export default function FormStrip({ form }) {
  if (!form || form.length === 0) {
    return <span className="text-[10px] font-mono text-white/30">no plays</span>;
  }
  const cls = { win: 'bg-emerald-signal', ok: 'bg-white/35', brick: 'bg-red-destructive' };
  return (
    <span className="inline-flex items-center gap-0.5" title="Recent calls (newest right)">
      {form.map((f, i) => (
        <span key={i} className={`inline-block w-1.5 h-3 ${cls[f] || 'bg-white/20'}`} />
      ))}
    </span>
  );
}
```

```javascript
// src/components/hunt/StatusBadge.js
import { Flame, Zap } from 'lucide-react';
export default function StatusBadge({ status }) {
  if (status === 'hot') {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-bold tracking-eyebrow-md uppercase font-mono text-emerald-signal">
        <Flame size={11} aria-hidden="true" /> Hot
      </span>
    );
  }
  if (status === 'cold') {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-bold tracking-eyebrow-md uppercase font-mono text-red-destructive">
        <Zap size={11} aria-hidden="true" /> Cold
      </span>
    );
  }
  return (
    <span className="text-[9px] font-bold tracking-eyebrow-md uppercase font-mono text-white/40">
      Steady
    </span>
  );
}
```

- [ ] **Step 2: Write a failing render test for `CallerStatsPanel`**

```javascript
// src/components/hunt/__tests__/CallerStatsPanel.test.js
import { render, screen } from '@testing-library/react';
import CallerStatsPanel from '../CallerStatsPanel';

test('renders caller rows with status and got-in counts', () => {
  const bonuses = [
    { slot: 'Big Bass', stake: 10, win: 1000, caller: 'Ana' },
    { slot: 'Doom', stake: 10, win: 5, caller: 'Bo' },
  ];
  render(<CallerStatsPanel bonuses={bonuses} history={[]} skippedCalls={[]} onOpenLog={() => {}} />);
  expect(screen.getByText('Ana')).toBeInTheDocument();
  expect(screen.getByText('Bo')).toBeInTheDocument();
});

test('empty state when no callers', () => {
  render(<CallerStatsPanel bonuses={[]} history={[]} skippedCalls={[]} onOpenLog={() => {}} />);
  expect(screen.getByText(/no calls tagged/i)).toBeInTheDocument();
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- --watchAll=false --testPathPattern=CallerStatsPanel`
Expected: FAIL — `CallerStatsPanel` not found.

- [ ] **Step 4: Create `CallerStatsPanel.js`**

```javascript
// src/components/hunt/CallerStatsPanel.js
import { Flame, Trophy, Ban } from 'lucide-react';
import { fmtX } from '../../utils/huntCalc';
import { computeCallerStats } from '../../utils/huntCalc';
import PanelLabel from './PanelLabel';
import FormStrip from './FormStrip';
import StatusBadge from './StatusBadge';

export default function CallerStatsPanel({ bonuses, history, skippedCalls, onOpenLog }) {
  const s = computeCallerStats(bonuses, history, skippedCalls);
  if (s.leaderboard.length === 0) {
    return (
      <div className="space-y-3">
        <PanelLabel code="05" label="Caller stats" accent="purple" quiet />
        <p className="text-center text-white/55 py-4 text-[12px] font-mono">No calls tagged yet.</p>
      </div>
    );
  }
  const Tile = ({ tone, icon: Icon, k, primary, sub }) => (
    <div className="px-3 py-2 bg-zinc-broadcast/50 border border-white/8">
      <p className={`text-[10px] font-bold uppercase tracking-eyebrow-lg mb-1 font-mono inline-flex items-center gap-1.5 ${tone}`}>
        <Icon size={11} aria-hidden="true" /> {k}
      </p>
      <p className="text-sm font-bold text-white-body tabular-nums">
        {primary}{sub && <span className="text-white/45 font-normal"> · {sub}</span>}
      </p>
    </div>
  );
  return (
    <div className="space-y-3">
      <PanelLabel code="05" label="Caller stats" accent="purple" quiet />
      <div className="grid grid-cols-1 gap-2">
        <Tile tone="text-emerald-signal" icon={Flame} k="On a heater"
          primary={s.hotCaller ? s.hotCaller.name : '—'}
          sub={s.hotCaller ? `avg ${fmtX(s.hotCaller.avgX)} · ${s.hotCaller.hotStreak} hot` : null} />
        <Tile tone="text-emerald-signal" icon={Trophy} k="Best call"
          primary={s.bestCall ? s.bestCall.slot : '—'}
          sub={s.bestCall ? `${fmtX(s.bestCall.x)} · ${s.bestCall.caller}` : null} />
        <Tile tone="text-red-destructive" icon={Ban} k="Brick of the hunt"
          primary={s.worstCall ? s.worstCall.slot : '—'}
          sub={s.worstCall ? `${fmtX(s.worstCall.x)} · ${s.worstCall.caller}` : null} />
      </div>
      <div className="border border-white/8 bg-zinc-broadcast/40">
        {s.leaderboard.map((r, i) => (
          <div key={r.name} className="flex items-center gap-3 px-3 py-1.5 border-b border-white/5 last:border-b-0">
            <span className="text-[10px] font-bold tabular-nums text-white/30 font-mono w-5">
              {String(i + 1).padStart(2, '0')}
            </span>
            <button type="button" onClick={() => onOpenLog(r.name)}
              className="flex-1 min-w-0 truncate font-bold text-purple-bright text-sm text-left hover:underline">
              {r.name}
            </button>
            <StatusBadge status={r.status} />
            <span className="text-[10px] font-mono tabular-nums text-white/55 w-14 text-right">
              {r.gotIn}/{r.calls}
            </span>
            <span className="w-16 flex justify-end"><FormStrip form={r.form} /></span>
            <span className={`text-[11px] font-bold tabular-nums w-14 text-right ${
              r.avgX == null ? 'text-white/40' : r.avgX >= 20 ? 'text-emerald-signal' : r.avgX < 1 ? 'text-red-destructive' : 'text-white/70'
            }`}>
              {r.avgX == null ? '—' : fmtX(r.avgX)}
            </span>
          </div>
        ))}
      </div>
      {s.coldCaller && (
        <p className="text-[10px] font-mono text-white/50 tracking-eyebrow-md">
          {s.coldCaller.name} on a cold streak · {Math.round(s.coldCaller.acceptRate * 100)}% of calls get in
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- --watchAll=false --testPathPattern=CallerStatsPanel`
Expected: PASS.

- [ ] **Step 6: Create `CallerLogDrawer.js`**

```javascript
// src/components/hunt/CallerLogDrawer.js
import { X } from 'lucide-react';
import Modal from '../Modal';
import { fmtX, computeCallerStats } from '../../utils/huntCalc';
import FormStrip from './FormStrip';
import StatusBadge from './StatusBadge';

// Per-caller call record: this hunt's called slots + prior-hunt summary.
export default function CallerLogDrawer({ name, bonuses, history, skippedCalls, onClose }) {
  const s = computeCallerStats(bonuses, history, skippedCalls);
  const row = s.leaderboard.find((r) => r.name === name) ||
    { calls: 0, gotIn: 0, missed: 0, avgX: null, best: null, form: [], status: 'steady', acceptRate: 0 };
  const huntCalls = (bonuses ?? []).filter((b) => (b.caller || '').trim() === name);
  // Prior-hunt rollup from history.
  let priorIn = 0, priorPlayed = 0, priorXsum = 0;
  for (const h of history ?? []) {
    for (const b of h.bonuses ?? []) {
      if ((b.caller || '').trim() !== name) continue;
      priorIn += 1;
      const stake = Number(b.stake) || 0, win = Number(b.win) || 0;
      if (stake > 0 && win > 0) { priorPlayed += 1; priorXsum += win / stake; }
    }
  }
  const priorAvg = priorPlayed ? priorXsum / priorPlayed : null;
  const Stat = ({ k, children }) => (
    <div className="px-3 py-2 bg-zinc-broadcast/50 border border-white/8 text-center">
      <div className="text-[9px] font-bold uppercase tracking-eyebrow-md text-white/45 font-mono mb-1">{k}</div>
      <div className="text-sm font-bold text-white-body tabular-nums">{children}</div>
    </div>
  );
  return (
    <Modal onClose={onClose} label={`Caller — ${name}`}
      panelClassName="w-full max-w-md border border-purple-gamba/40 bg-zinc-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-black text-white-body text-lg leading-tight flex items-center gap-2">
            {name} <StatusBadge status={row.status} />
          </div>
          <div className="text-[11px] font-mono text-white/50 mt-0.5">
            {row.gotIn} of {row.calls} calls made the hunt · {Math.round(row.acceptRate * 100)}% accept
          </div>
        </div>
        <button type="button" onClick={onClose} className="p-1.5 border border-white/10 text-white/50 hover:text-white-body">
          <X size={14} aria-hidden="true" />
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <Stat k="Avg X">{row.avgX == null ? '—' : fmtX(row.avgX)}</Stat>
        <Stat k="Best X">{row.best == null ? '—' : fmtX(row.best)}</Stat>
        <Stat k="Skipped">{row.missed}</Stat>
        <Stat k="Form"><FormStrip form={row.form} /></Stat>
      </div>
      <div className="space-y-1.5">
        <div className="text-[10px] font-bold uppercase tracking-eyebrow-lg text-purple-bright font-mono">
          This hunt · {huntCalls.length} in
        </div>
        {huntCalls.length === 0 && <p className="text-[11px] font-mono text-white/40">No calls in the hunt yet.</p>}
        {huntCalls.map((b) => {
          const stake = Number(b.stake) || 0, win = Number(b.win) || 0;
          const x = stake > 0 && win > 0 ? win / stake : null;
          return (
            <div key={b.id} className="flex items-center justify-between text-[12px] font-mono">
              <span className="text-white-body">{b.slot}</span>
              <span className={x == null ? 'text-white/40' : 'text-white/70'}>{x == null ? 'opening…' : fmtX(x)}</span>
            </div>
          );
        })}
      </div>
      <div className="space-y-1.5">
        <div className="text-[10px] font-bold uppercase tracking-eyebrow-lg text-white/45 font-mono">Prior hunts</div>
        <p className="text-[11px] font-mono text-white/55 tabular-nums">
          {priorIn} slots in · {priorPlayed} played{priorAvg != null ? ` · avg ${fmtX(priorAvg)}` : ''}
        </p>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 7: Run the panel test again + commit**

Run: `npm test -- --watchAll=false --testPathPattern=CallerStatsPanel`
Expected: PASS.

```bash
git add src/components/hunt/FormStrip.js src/components/hunt/StatusBadge.js src/components/hunt/CallerStatsPanel.js src/components/hunt/CallerLogDrawer.js src/components/hunt/__tests__/CallerStatsPanel.test.js
git commit -m "feat(hunt): caller stats panel 05 + call-log drawer components"
```

---

## Task 5: Extract `HuntHero` and `HuntStatGrid`

**Files:**
- Create: `src/components/hunt/HuntHero.js`
- Create: `src/components/hunt/HuntStatGrid.js`
- Test: `src/components/hunt/__tests__/HuntHero.test.js`

Build the redesign's hero P/L card + 4-up stat grid as pure presentational components driven by `computeStats` output (passed in as props so they're testable without the store).

- [ ] **Step 1: Write a failing test for `HuntHero`**

```javascript
// src/components/hunt/__tests__/HuntHero.test.js
import { render, screen } from '@testing-library/react';
import HuntHero from '../HuntHero';

test('shows positive P/L in emerald with + sign', () => {
  render(<HuntHero profit={250} avgReqRemaining={null} totalWins={1850} start={1600} wlMultiplier={1.16} />);
  expect(screen.getByText(/\+\$250\.00/)).toBeInTheDocument();
});

test('shows BEHIND pace chip when down and need-per-remaining provided', () => {
  render(<HuntHero profit={-300} avgReqRemaining={92.5} totalWins={300} start={600} wlMultiplier={0.5} />);
  expect(screen.getByText(/behind/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- --watchAll=false --testPathPattern=HuntHero`
Expected: FAIL — not found.

- [ ] **Step 3: Create `HuntHero.js`**

```javascript
// src/components/hunt/HuntHero.js
import { fmt, fmtX } from '../../utils/huntCalc';

// Hero Profit/Loss card. `profit` is the effective P/L (finish-based or running).
export default function HuntHero({ profit, avgReqRemaining, totalWins, start, wlMultiplier }) {
  const positive = profit != null && profit >= 0;
  const behind = profit != null && profit < 0 && avgReqRemaining != null;
  return (
    <div className="relative overflow-hidden rounded-lg border border-white/8 bg-zinc-card/40 p-5">
      <div
        className={`pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full blur-3xl motion-reduce:hidden ${
          positive ? 'bg-emerald-signal/10' : 'bg-red-destructive/10'
        }`}
        aria-hidden="true"
      />
      <div className="relative flex items-center justify-between gap-2 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-eyebrow-lg text-white/55 font-mono">
          Profit / Loss
        </span>
        {behind ? (
          <span className="text-[9px] font-bold uppercase tracking-eyebrow-md font-mono text-red-destructive">
            Behind · need {fmt(avgReqRemaining)} avg
          </span>
        ) : positive && profit > 0 ? (
          <span className="text-[9px] font-bold uppercase tracking-eyebrow-md font-mono text-emerald-signal">
            Ahead
          </span>
        ) : null}
      </div>
      <div className={`relative text-[52px] leading-none font-black tabular-nums ${
        profit == null ? 'text-white/40' : positive ? 'text-emerald-signal' : 'text-red-destructive'
      }`}>
        {profit == null ? '—' : `${positive ? '+' : '−'}${fmt(Math.abs(profit))}`}
      </div>
      <div className="relative text-[11px] font-mono text-white/45 mt-2 tabular-nums">
        {fmt(totalWins)} won{start != null ? ` · ${fmt(start)} start` : ''}{wlMultiplier != null ? ` · ${fmtX(wlMultiplier)} recovered` : ''}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- --watchAll=false --testPathPattern=HuntHero`
Expected: PASS.

- [ ] **Step 5: Create `HuntStatGrid.js`**

```javascript
// src/components/hunt/HuntStatGrid.js
import { fmt, fmtX } from '../../utils/huntCalc';

// 4-up secondary stat grid. Values come from computeStats + counts.
function Cell({ label, value, tint }) {
  return (
    <div className="rounded-lg border border-white/8 bg-zinc-card/30 px-3 py-2.5">
      <div className="text-[10px] font-bold uppercase tracking-eyebrow-md text-white/55 font-mono mb-1">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${tint || 'text-white-body'}`}>{value}</div>
    </div>
  );
}

export default function HuntStatGrid({ stats, bonusCount, pendingCount }) {
  const winTint = stats.totalWins > 0 ? 'text-emerald-signal' : 'text-white-body';
  const avgXTint = stats.curAvgX != null && stats.curAvgX >= 1 ? 'text-emerald-signal' : 'text-white-body';
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Cell label={`Bonuses${pendingCount ? ` · ${pendingCount} pending` : ''}`} value={bonusCount} />
      <Cell label="Start cost" value={fmt(stats.totalStakes)} />
      <Cell label="Winnings" value={fmt(stats.totalWins)} tint={winTint} />
      <Cell label="Avg req" value={stats.avgReqRemaining != null ? fmt(stats.avgReqRemaining) : '—'} />
      <Cell label="Cur avg" value={stats.curAvgWin != null ? fmt(stats.curAvgWin) : '—'} />
      <Cell label="Total X" value={stats.totalX > 0 ? fmtX(stats.totalX) : '—'} />
      <Cell label="Req X" value={stats.reqX != null ? fmtX(stats.reqX) : '—'} />
      <Cell label="Cur avg X" value={stats.curAvgX != null ? fmtX(stats.curAvgX) : '—'} tint={avgXTint} />
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/hunt/HuntHero.js src/components/hunt/HuntStatGrid.js src/components/hunt/__tests__/HuntHero.test.js
git commit -m "feat(hunt): hero P/L card + 4-up stat grid components"
```

---

## Task 6: Build `OpeningFocus` (focus card + hotkeys + notes)

**Files:**
- Create: `src/components/hunt/OpeningFocus.js`
- Modify: `src/components/HuntTracker.js` (render OpeningFocus in opening phase; add `note` save handler)
- Test: `src/components/hunt/__tests__/OpeningFocus.test.js`

Upgrade opening from the inline current/next card to the prototype's centered focus card with `↵/←/→/esc` hotkeys and a notes field. Notes persist to a new `note` field on the bonus via `updateBonusNote`. Preserve deferred "Later" handling.

- [ ] **Step 1: Write a failing test (renders current slot + payout entry)**

```javascript
// src/components/hunt/__tests__/OpeningFocus.test.js
import { render, screen, fireEvent } from '@testing-library/react';
import OpeningFocus from '../OpeningFocus';

const ORDER = [
  { id: 'a', slot: 'Big Bass', stake: 10, win: 0, caller: 'Ana' },
  { id: 'b', slot: 'Gates', stake: 20, win: 0, caller: 'Bo' },
];

test('shows current slot name and computes live multiplier on payout entry', () => {
  const onWin = jest.fn();
  render(
    <OpeningFocus order={ORDER} idx={0} openedCount={0}
      onWin={onWin} onNote={() => {}} onPrev={() => {}} onNext={() => {}}
      onDefer={() => {}} onExit={() => {}} onFinish={() => {}} />
  );
  expect(screen.getByText('Big Bass')).toBeInTheDocument();
  const payout = screen.getByLabelText(/payout/i);
  fireEvent.change(payout, { target: { value: '1000' } });
  expect(onWin).toHaveBeenCalledWith('a', '1000');
  expect(screen.getByText(/100\.00x/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- --watchAll=false --testPathPattern=OpeningFocus`
Expected: FAIL — not found.

- [ ] **Step 3: Create `OpeningFocus.js`**

```javascript
// src/components/hunt/OpeningFocus.js
import { useEffect, useRef } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Clock, Check } from 'lucide-react';
import ScatterPill from '../ScatterPill';
import { fmt, fmtX } from '../../utils/huntCalc';

function Avatar({ name, size = 48 }) {
  const initials = (name || '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <div className="flex items-center justify-center border border-purple-gamba/40 bg-purple-gamba/10 text-purple-bright font-mono font-bold"
      style={{ width: size, height: size }}>
      {initials || '?'}
    </div>
  );
}

// Centered opening focus card. Parent owns the order + the openingIndex; this
// component renders the current bonus and fires granular callbacks.
export default function OpeningFocus({
  order, idx, openedCount, onWin, onNote, onPrev, onNext, onDefer, onExit, onFinish,
}) {
  const bonus = order[idx] || null;
  const next = order[idx + 1] || null;
  const last = idx >= order.length - 1;
  const payoutRef = useRef(null);

  useEffect(() => {
    const id = setTimeout(() => payoutRef.current && payoutRef.current.focus(), 30);
    return () => clearTimeout(id);
  }, [idx]);

  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'Enter') { e.preventDefault(); last ? onFinish() : onNext(); }
      else if (e.key === 'ArrowRight' && !last) onNext();
      else if (e.key === 'ArrowLeft' && idx > 0) onPrev();
      else if (e.key === 'Escape') onExit();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!bonus) return null;
  const stake = Number(bonus.stake) || 0;
  const win = Number(bonus.win) || 0;
  const mult = stake > 0 && win > 0 ? win / stake : null;
  const multTone = mult == null ? 'text-white/40'
    : mult >= 100 ? 'text-emerald-signal'
    : mult >= 20 ? 'text-emerald-signal'
    : mult === 0 ? 'text-red-destructive' : 'text-white/70';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={onExit}
          className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-eyebrow-lg font-mono text-white/60 hover:text-white-body">
          <ArrowLeft size={12} aria-hidden="true" /> Back to hunt
        </button>
        <span className="text-[10px] font-bold uppercase tracking-eyebrow-lg font-mono text-purple-bright tabular-nums">
          Opening · {openedCount}/{order.length} done
        </span>
        <span className="text-[10px] font-mono text-white/35 hidden sm:inline">↵ next · ←/→ nav · esc exit</span>
      </div>

      <div className="mx-auto max-w-[1040px] border border-purple-gamba/40 bg-purple-gamba/5 p-5">
        <div className="flex items-center gap-3 mb-4">
          <Avatar name={bonus.slot} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <ScatterPill bonus={bonus} size="md" />
              <p className="font-black text-white-body text-2xl leading-tight truncate">{bonus.slot}</p>
            </div>
            <p className="text-[11px] font-mono text-white/50 mt-0.5 tabular-nums">
              called by {bonus.caller || '—'} · bonus {idx + 1} of {order.length}
            </p>
          </div>
          <div className="flex gap-1">
            <button type="button" onClick={onPrev} disabled={idx === 0}
              className="p-2 border border-white/15 text-white/60 hover:text-white-body disabled:opacity-30">
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <button type="button" onClick={onNext} disabled={last}
              className="p-2 border border-white/15 text-white/60 hover:text-white-body disabled:opacity-30">
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            <span className="block text-[10px] font-bold uppercase tracking-eyebrow-md text-white/55 mb-1.5 font-mono">Bet size</span>
            <div className="bg-zinc-broadcast/40 border border-white/10 px-3 py-2 text-white/70 tabular-nums">{fmt(stake)}</div>
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold uppercase tracking-eyebrow-md text-white/55 mb-1.5 font-mono">Payout</span>
            <input ref={payoutRef} type="number" inputMode="decimal" aria-label="Payout"
              value={bonus.win || ''} onChange={(e) => onWin(bonus.id, e.target.value)}
              placeholder="0.00"
              className="w-full bg-zinc-broadcast/70 border border-purple-gamba/50 px-3 py-2 text-right text-white-body focus:border-purple-bright focus:outline-none tabular-nums" />
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold uppercase tracking-eyebrow-md text-white/55 mb-1.5 font-mono">Multiplier</span>
            <div className={`px-3 py-2 text-right font-bold tabular-nums border border-white/10 bg-zinc-broadcast/40 ${multTone}`}>
              {mult == null ? '—' : fmtX(mult)}
            </div>
          </label>
        </div>

        <label className="block mt-3">
          <span className="block text-[10px] font-bold uppercase tracking-eyebrow-md text-white/55 mb-1.5 font-mono">Notes</span>
          <textarea value={bonus.note || ''} onChange={(e) => onNote(bonus.id, e.target.value)}
            placeholder="Bonus story, retrigger, big tile…" rows={2}
            className="w-full bg-zinc-broadcast/60 border border-white/10 px-3 py-2 text-sm text-white-body focus:border-emerald-signal/70 focus:outline-none resize-none" />
        </label>

        <div className="flex items-center justify-between gap-2 mt-4">
          <button type="button" onClick={() => onDefer(bonus.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 border text-[10px] font-bold uppercase tracking-eyebrow-lg font-mono ${
              bonus.deferred ? 'border-orange-admin bg-orange-admin/10 text-orange-admin' : 'border-white/15 text-white/60 hover:text-white-body'
            }`}>
            <Clock size={12} aria-hidden="true" /> Later
          </button>
          {next && (
            <span className="text-[10px] font-mono text-white/40 truncate">Next · {next.slot}</span>
          )}
          <button type="button" onClick={last ? onFinish : onNext}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-gamba text-white-body hover:bg-purple-bright transition-colors">
            <span className="text-[10px] font-bold uppercase tracking-eyebrow-lg font-mono">
              {last ? 'Finish opening' : 'Save & continue'}
            </span>
            {last ? <Check size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- --watchAll=false --testPathPattern=OpeningFocus`
Expected: PASS.

- [ ] **Step 5: Add `updateBonusNote` to HuntTracker and wire OpeningFocus**

In `src/components/HuntTracker.js`, add near `updateBonusCaller` (~line 493):

```javascript
  function updateBonusNote(id, value) {
    updateHunt({
      bonuses: bonuses.map((b) => (b.id === id ? { ...b, note: value } : b)),
    });
  }
```

Replace the inline opening current/next block (HuntTracker.js ~1128-1240) with:

```javascript
{phase === 'opening' && currentBonus && (
  <OpeningFocus
    order={order}
    idx={openingIdx}
    openedCount={openedCount}
    onWin={updateBonusWin}
    onNote={updateBonusNote}
    onPrev={prevOpening}
    onNext={advanceOpening}
    onDefer={toggleDeferred}
    onExit={backToCollecting}
    onFinish={() => setShowWrapUp(true)}
  />
)}
```

Import `OpeningFocus` at the top. Keep the existing `BonusTable` list below it (it already renders `order` when `phase === 'opening'`).

- [ ] **Step 6: Manual smoke test**

Run: `npm start`, start a hunt with 2+ bonuses, click START OPENING. Verify: focus card shows current slot, typing payout shows live multiplier, Enter advances, ←/→ navigate, Esc exits, Later toggles, notes persist after navigating away/back, last slot's Finish opens the wrap-up modal.

- [ ] **Step 7: Commit**

```bash
git add src/components/hunt/OpeningFocus.js src/components/hunt/__tests__/OpeningFocus.test.js src/components/HuntTracker.js
git commit -m "feat(hunt): opening focus mode with hotkeys and notes"
```

---

## Task 7: Build `ViewerCalls` (grouped Add/Skip) + skip persistence

**Files:**
- Create: `src/components/hunt/ViewerCalls.js`
- Modify: `src/components/HuntTracker.js` (skip handler pushes to `skippedCalls`; render ViewerCalls)
- Test: `src/components/hunt/__tests__/ViewerCalls.test.js`

Reconcile the prototype's grouped Add/Skip with the existing suggestion intake. Calls are grouped by caller; Add promotes via the existing `startLanding` stake prompt; Skip removes the suggestion AND records it in `skippedCalls` (feeding accept-rate). Keep the password intake link in the panel header.

- [ ] **Step 1: Write a failing test for grouping + actions**

```javascript
// src/components/hunt/__tests__/ViewerCalls.test.js
import { render, screen, fireEvent } from '@testing-library/react';
import ViewerCalls from '../ViewerCalls';

const SUGGESTIONS = [
  { person: 'Ana', slots: [
    { id: 's1', name: 'Big Bass', status: 'pending' },
    { id: 's2', name: 'Gates', status: 'pending' },
  ] },
  { person: 'Bo', slots: [{ id: 's3', name: 'Doom', status: 'pending' }] },
];

test('groups by caller and fires onAdd / onSkip', () => {
  const onAdd = jest.fn();
  const onSkip = jest.fn();
  render(<ViewerCalls suggestions={SUGGESTIONS} onAdd={onAdd} onSkip={onSkip} intakeControls={null} />);
  expect(screen.getByText('Ana')).toBeInTheDocument();
  expect(screen.getByText('Bo')).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('button', { name: /add/i })[0]);
  expect(onAdd).toHaveBeenCalledWith('Ana', expect.objectContaining({ id: 's1' }));
  fireEvent.click(screen.getAllByRole('button', { name: /^skip$/i })[0]);
  expect(onSkip).toHaveBeenCalledWith('Ana', expect.objectContaining({ id: 's1' }));
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- --watchAll=false --testPathPattern=ViewerCalls`
Expected: FAIL — not found.

- [ ] **Step 3: Create `ViewerCalls.js`**

```javascript
// src/components/hunt/ViewerCalls.js
import { Plus, X, Radio } from 'lucide-react';
import PanelLabel from './PanelLabel';

// Pending viewer slot-calls, grouped by caller. Only 'pending' slots show.
export default function ViewerCalls({ suggestions, onAdd, onSkip, onSkipAll, onOpenLog, intakeControls }) {
  const groups = (suggestions ?? [])
    .map((p) => ({ caller: p.person, items: (p.slots || []).filter((s) => s.status === 'pending') }))
    .filter((g) => g.items.length > 0);
  const pendingCount = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <PanelLabel icon={Radio} label="Viewer calls" accent="purple" quiet />
        <span className="text-[10px] font-bold uppercase tracking-eyebrow-lg text-white/45 font-mono tabular-nums">
          {pendingCount} pending
        </span>
      </div>
      {intakeControls}
      {groups.length === 0 ? (
        <p className="text-center text-white/55 py-4 text-[12px] font-mono">No pending calls.</p>
      ) : (
        <div className="border border-white/8 bg-zinc-broadcast/40 divide-y divide-white/5">
          {groups.map((g) => (
            <div key={g.caller} className="px-3 py-2">
              <div className="flex items-center justify-between mb-1.5">
                <button type="button" onClick={() => onOpenLog && onOpenLog(g.caller)}
                  className="font-bold text-purple-bright text-sm hover:underline">
                  {g.caller}
                </button>
                {g.items.length > 1 && onSkipAll && (
                  <button type="button" onClick={() => onSkipAll(g.caller, g.items)}
                    className="text-[10px] font-bold uppercase tracking-eyebrow-md font-mono text-white/45 hover:text-red-destructive">
                    Skip all
                  </button>
                )}
              </div>
              {g.items.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 py-1">
                  <span className="text-[13px] text-white-body truncate">{s.name}</span>
                  <div className="flex gap-1.5 shrink-0">
                    <button type="button" onClick={() => onSkip(g.caller, s)}
                      title="Didn't make the hunt — counts against this caller"
                      className="inline-flex items-center gap-1 px-2 py-1 border border-white/10 text-white/55 hover:text-red-destructive hover:border-red-destructive/40 text-[10px] font-bold uppercase tracking-eyebrow-md font-mono">
                      <X size={11} aria-hidden="true" /> Skip
                    </button>
                    <button type="button" onClick={() => onAdd(g.caller, s)}
                      className="inline-flex items-center gap-1 px-2 py-1 border border-emerald-signal/50 text-emerald-signal hover:bg-emerald-signal/10 text-[10px] font-bold uppercase tracking-eyebrow-md font-mono">
                      <Plus size={11} aria-hidden="true" /> Add
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- --watchAll=false --testPathPattern=ViewerCalls`
Expected: PASS.

- [ ] **Step 5: Add skip handler + wire in HuntTracker**

In `src/components/HuntTracker.js`, add a skip handler that records the skip then removes the suggestion (place near `setSuggestionStatus`, ~line 512):

```javascript
  // Skip a viewer call: record it against the caller (accept-rate), then drop
  // the suggestion. onAdd reuses the existing startLanding stake prompt.
  function skipCall(person, slot) {
    updateHunt({ skippedCalls: [...skippedCalls, { caller: person, slot: slot.name, ts: Date.now() }] });
    updateSuggestions(
      suggestions.map((p) => ({
        ...p,
        slots: p.slots.map((s) => (s.id === slot.id ? { ...s, status: 'skipped' } : s)),
      }))
    );
  }
  function skipAllCalls(person, slots) {
    updateHunt({ skippedCalls: [...skippedCalls, ...slots.map((s) => ({ caller: person, slot: s.name, ts: Date.now() }))] });
    const ids = new Set(slots.map((s) => s.id));
    updateSuggestions(
      suggestions.map((p) => ({
        ...p,
        slots: p.slots.map((s) => (ids.has(s.id) ? { ...s, status: 'skipped' } : s)),
      }))
    );
  }
```

Render `<ViewerCalls>` in the right column, passing `onAdd={(person, slot) => startLanding(person, slot)}`, `onSkip={skipCall}`, `onSkipAll={skipAllCalls}`, `onOpenLog={setCallerLogName}` (the drawer trigger from Task 8), and `intakeControls={<the existing HuntLinkControls block>}`. Keep `SuggestionsPanel` only if you still want the import flow; otherwise ViewerCalls replaces its triage role (keep `SuggestionsPanel`'s import button if the sheet-import is still used — confirm with the existing intake; the password link lives in `intakeControls`).

- [ ] **Step 6: Commit**

```bash
git add src/components/hunt/ViewerCalls.js src/components/hunt/__tests__/ViewerCalls.test.js src/components/HuntTracker.js
git commit -m "feat(hunt): grouped viewer-calls Add/Skip with skip persistence"
```

---

## Task 8: Relayout HuntTracker into the redesign structure + wire drawer

**Files:**
- Modify: `src/components/HuntTracker.js` (header actions, stat grid w/ hero, work grid, panel order, drawer state)

Assemble the extracted components into the handoff layout. Add the caller-log drawer state and the Collab placeholder button (disabled — Spec B fills it).

- [ ] **Step 1: Add drawer state + Collab placeholder**

In `src/components/HuntTracker.js` state block (~line 342), add:

```javascript
  const [callerLogName, setCallerLogName] = useState(null);
```

In the header actions row, add a disabled Collab button before Export split:

```javascript
          <button
            type="button"
            disabled
            title="Collab — coming soon"
            className="inline-flex items-center gap-2 px-3 py-1.5 border border-white/10 text-white/30 cursor-not-allowed"
          >
            <Users size={12} aria-hidden="true" />
            <span className="text-[10px] font-bold tracking-eyebrow-lg">COLLAB</span>
          </button>
```

- [ ] **Step 2: Replace the stat band with hero + grid**

Replace the "Overall stats band" block (HuntTracker.js ~1026-1114) with a grid that places `<HuntHero>` left and `<HuntStatGrid>` right (stacking < 1180px). Keep the Start/Finish balance inputs in a compact sub-row beneath the grid:

```javascript
<div data-tour="stats" className="border-b border-white/8 bg-emerald-signal/[0.03] px-4 py-4">
  <div className="grid lg:grid-cols-[360px_1fr] gap-4 items-start">
    <HuntHero
      profit={profit != null ? profit : runningProfit}
      avgReqRemaining={stats.avgReqRemaining}
      totalWins={totalWins}
      start={stats.start}
      wlMultiplier={wlMultiplier}
    />
    <HuntStatGrid
      stats={stats}
      bonusCount={bonuses.length}
      pendingCount={bonuses.length - openedCount}
    />
  </div>
  <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3 mt-3">
    {/* keep existing Start bal / Finish bal labeled inputs here */}
  </div>
</div>
```

- [ ] **Step 3: Reorder the right column to the handoff stack**

In the work grid right column, order panels: Squad split → `<ViewerCalls>` → Soft banned → `<CallerStatsPanel bonuses={bonuses} history={history} skippedCalls={skippedCalls} onOpenLog={setCallerLogName} />`. Replace the old inline caller-stats block (~1626-1696) with `<CallerStatsPanel>`. Adjust the work grid to `lg:grid-cols-[1.35fr_1fr]`.

- [ ] **Step 4: Render the drawer**

Before the closing `</div>` of the component (near the other modals), add:

```javascript
{callerLogName && (
  <CallerLogDrawer
    name={callerLogName}
    bonuses={bonuses}
    history={history}
    skippedCalls={skippedCalls}
    onClose={() => setCallerLogName(null)}
  />
)}
```

Import `HuntHero`, `HuntStatGrid`, `ViewerCalls`, `CallerStatsPanel`, `CallerLogDrawer` at the top.

- [ ] **Step 5: Full manual smoke test**

Run: `npm start`, `/gamba/hunt-tracker`. Verify end-to-end: hero P/L tints + pace chip; 4-up grid values match old band; add/drag/scatter/caller still work; opening focus mode; viewer-calls Add (stake prompt) + Skip (caller's missed increments in panel 05); click a caller name → drawer opens with this-hunt + prior-hunt sections; complete a hunt → recap exports; reload → state persists. Confirm `prefers-reduced-motion` hides the hero glow animation.

- [ ] **Step 6: Run the full test suite**

Run: `CI=true npm test -- --watchAll=false`
Expected: PASS (huntCalc, HuntHero, CallerStatsPanel, OpeningFocus, ViewerCalls + all pre-existing).

- [ ] **Step 7: Commit**

```bash
git add src/components/HuntTracker.js
git commit -m "feat(hunt): relayout tracker into redesign structure + caller drawer"
```

---

## Task 9: Update `HuntHistory` for caller links + compact caller block

**Files:**
- Modify: `src/components/HuntHistory.js` (caller name → drawer link; richer caller block)
- Modify: `src/components/HuntTracker.js` if history drawer is wired from the idle screen (optional)

The handoff wants completed-hunt rows to show the caller per bonus as a link and a compact caller-stats block. `computeCallerStats` is already backward-compatible, so passing `(hunt.bonuses)` keeps working; we add the cross-hunt context as `[]` for a single completed hunt (its own bonuses are the data).

- [ ] **Step 1: Make the caller name a button in the expanded bonus table**

In `src/components/HuntHistory.js`, in the expanded bonus table row (~line 164-168), wrap the caller in a button. Since the history screen has no live drawer wiring by default, make the link optional via an `onOpenLog` prop:

```javascript
// in HistoryRow signature add onOpenLog
function HistoryRow({ hunt, onReexport, onReopen, onDelete, onOpenLog }) {
  ...
  {b.caller && (
    onOpenLog ? (
      <button type="button" onClick={() => onOpenLog(b.caller)}
        className="block text-[10px] font-mono tracking-eyebrow-md uppercase text-purple-bright truncate mt-0.5 hover:underline text-left">
        📣 {b.caller}
      </button>
    ) : (
      <span className="block text-[10px] font-mono tracking-eyebrow-md uppercase text-purple-bright truncate mt-0.5">
        📣 {b.caller}
      </span>
    )
  )}
```

Thread `onOpenLog` from `HuntHistory` props down to each `HistoryRow`.

- [ ] **Step 2: Use the richer caller block (best/brick already present)**

The existing block already shows leaderboard + best/brick. No structural change required beyond confirming it still reads `callerStats.leaderboard`/`bestCall`/`worstCall` (all preserved). Leave as-is.

- [ ] **Step 3: Build check**

Run: `npm test -- --watchAll=false --testPathPattern=huntCalc`
Expected: PASS (no signature break).

- [ ] **Step 4: Manual check**

Run: `npm start`, complete a hunt, return to the idle/start screen, expand a past hunt. Verify caller shows and (if `onOpenLog` wired) is clickable; best/brick render.

- [ ] **Step 5: Commit**

```bash
git add src/components/HuntHistory.js
git commit -m "feat(hunt): caller links in hunt history expand"
```

---

## Task 10: Final verification + cleanup

**Files:** none new — verification pass.

- [ ] **Step 1: Confirm no dead code remains in HuntTracker**

Grep for the now-extracted inline definitions to ensure they were removed (not duplicated):

Run: `grep -n "function SortableBonusRow\|function PanelLabel" src/components/HuntTracker.js`
Expected: no matches (both moved to `src/components/hunt/`).

- [ ] **Step 2: Confirm all `computeCallerStats` call sites pass valid args**

Run: `grep -rn "computeCallerStats(" src`
Expected: `HuntHistory.js`, `AdminCommunityHuntsPage.js` call with one arg (still valid); `CallerStatsPanel.js`, `CallerLogDrawer.js` with three. No call passes a wrong shape.

- [ ] **Step 3: Full suite + production build**

Run: `CI=true npm test -- --watchAll=false`
Expected: PASS.

Run: `npm run build`
Expected: build succeeds (no ESLint errors; `react-app` preset is enforced in build).

- [ ] **Step 4: Responsive + reduced-motion spot check**

Run: `npm start`, narrow the window < 1180px (stat + work grids collapse to one column), < 760px (opening fields stack). Toggle OS reduced-motion and confirm hero glow + any pulse respect it.

- [ ] **Step 5: Commit any cleanup**

```bash
git add -A
git commit -m "chore(hunt): redesign cleanup and verification"
```

---

## Self-review notes (for the executor)

- **Spec coverage:** A1 layout → Tasks 5,6,8; A2 reputation → Tasks 1,4,7,9; opening focus → Task 6; viewer-calls Add/Skip + `skippedCalls` → Tasks 2,7; drawer → Tasks 4,8; preserved capabilities → Task 3 (extraction keeps DnD/scatter/deferred/sort) + props throughout.
- **Backward-compat trap:** `computeCallerStats` keeps `leaderboard/bestCall/worstCall/bestAvgCaller` so `HuntHistory.js` and `AdminCommunityHuntsPage.js` (one-arg callers) don't break — enforced by a test in Task 1 and verified in Task 10 Step 2.
- **No mirror/rules changes** in this plan — all collab/cross-user work is Spec B.
- **Naming consistency:** drawer trigger state is `callerLogName` everywhere; skip writes go to `skippedCalls` everywhere; note field is `note` on the bonus in both `OpeningFocus` and `updateBonusNote`.
