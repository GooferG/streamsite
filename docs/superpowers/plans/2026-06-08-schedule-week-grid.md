# Schedule Week-Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the admin schedule editor into a 7-day week grid with a click-to-open day editor, and give the public schedule a desktop week-strip (poster cells) while keeping the row list on mobile.

**Architecture:** Data model and Firestore save path are unchanged (one recurring weekly array of 7 entries, one `setDoc` of the whole array). Shared week-ordering helpers are extracted to a small pure util (unit-tested). Both pages re-skin presentation only — admin renders summary cells + a right-side drawer editing local draft state; public forks layout via Tailwind responsive `hidden`/`grid` at `lg`.

**Tech Stack:** React 19, react-router-dom v7, Tailwind, Firebase Firestore, lucide-react icons, Jest (react-scripts) for the pure util.

**Reference:** Spec at [docs/superpowers/specs/2026-06-08-schedule-week-grid-design.md](../specs/2026-06-08-schedule-week-grid-design.md).

---

## File Structure

- **Create** `src/utils/scheduleWeek.js` — pure helpers `WEEK_ORDER`, `DAY_INDEX`, `dayAbbrev`, `dayDisplay`, `orderByWeek(schedule)`. Single responsibility: weekday ordering/labelling. Imported by both pages.
- **Create** `src/utils/__tests__/scheduleWeek.test.js` — unit tests for the pure helpers.
- **Modify** `src/pages/AdminSchedulePage.js` — replace vertical `DayPanel` stack with week grid of summary cells + `DayEditorDrawer`; add `editingIndex`/`draft` state. Import from `scheduleWeek`.
- **Modify** `src/pages/SchedulePage.js` — add `SchedulePosterCell` + desktop `WeekStrip`; gate existing `ScheduleRow` list to mobile; import shared helpers from `scheduleWeek` (remove local dupes).
- **Modify** `tailwind.config.js` — add a `drawer-in` keyframe + animation for the admin editor drawer (no global `slideUp` keyframe exists in this codebase).

**Note on testing approach:** This codebase wires no tests into CI; the schedule pages have no existing tests and are presentational React. Per the spec, page/drawer work is verified by production build + manual checks. Only the pure util (`scheduleWeek.js`) gets real Jest tests (TDD). Page tasks use `npm run build` as the mechanical gate and list explicit manual checks.

---

## Task 1: Shared week-ordering util (TDD)

**Files:**
- Create: `src/utils/scheduleWeek.js`
- Test: `src/utils/__tests__/scheduleWeek.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/utils/__tests__/scheduleWeek.test.js`:

```js
import {
  WEEK_ORDER,
  DAY_INDEX,
  dayAbbrev,
  dayDisplay,
  orderByWeek,
} from '../scheduleWeek';

describe('scheduleWeek', () => {
  test('WEEK_ORDER runs Monday through Sunday', () => {
    expect(WEEK_ORDER).toEqual([
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRY-DAY',
      'SATURDAY',
      'SUNDAY',
    ]);
  });

  test('DAY_INDEX maps days to JS getDay() numbers, incl. FRY-DAY and FRIDAY', () => {
    expect(DAY_INDEX.SUNDAY).toBe(0);
    expect(DAY_INDEX.MONDAY).toBe(1);
    expect(DAY_INDEX.THURSDAY).toBe(4);
    expect(DAY_INDEX['FRY-DAY']).toBe(5);
    expect(DAY_INDEX.FRIDAY).toBe(5);
    expect(DAY_INDEX.SATURDAY).toBe(6);
  });

  test('dayAbbrev abbreviates, with FRY-DAY -> FRI', () => {
    expect(dayAbbrev('MONDAY')).toBe('MON');
    expect(dayAbbrev('FRY-DAY')).toBe('FRI');
    expect(dayAbbrev('SUNDAY')).toBe('SUN');
  });

  test('dayDisplay gives title-case label, FRY-DAY -> Fry', () => {
    expect(dayDisplay('MONDAY')).toBe('Mon');
    expect(dayDisplay('FRY-DAY')).toBe('Fry');
    expect(dayDisplay('SATURDAY')).toBe('Sat');
  });

  test('orderByWeek sorts a schedule into Mon->Sun order', () => {
    const input = [
      { day: 'WEDNESDAY' },
      { day: 'MONDAY' },
      { day: 'SUNDAY' },
    ];
    expect(orderByWeek(input).map((d) => d.day)).toEqual([
      'MONDAY',
      'WEDNESDAY',
      'SUNDAY',
    ]);
  });

  test('orderByWeek returns [] for empty/nullish input', () => {
    expect(orderByWeek([])).toEqual([]);
    expect(orderByWeek(null)).toEqual([]);
    expect(orderByWeek(undefined)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --testPathPattern=scheduleWeek --watchAll=false`
Expected: FAIL — `Cannot find module '../scheduleWeek'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/utils/scheduleWeek.js`:

```js
// Shared weekday ordering + labelling for the schedule (admin + public).
// Source of truth for week order — both SchedulePage and AdminSchedulePage import this.

export const DAY_INDEX = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  'FRY-DAY': 5,
  FRIDAY: 5,
  SATURDAY: 6,
};

export const WEEK_ORDER = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRY-DAY',
  'SATURDAY',
  'SUNDAY',
];

export function dayAbbrev(day) {
  if (day === 'FRY-DAY') return 'FRI';
  return day.slice(0, 3);
}

// Title-case short label, e.g. MONDAY -> "Mon", FRY-DAY -> "Fry".
export function dayDisplay(day) {
  const abbr = day === 'FRY-DAY' ? 'FRY' : dayAbbrev(day);
  return abbr.charAt(0) + abbr.slice(1).toLowerCase();
}

export function orderByWeek(schedule) {
  if (!schedule || schedule.length === 0) return [];
  return [...schedule].sort(
    (a, b) => WEEK_ORDER.indexOf(a.day) - WEEK_ORDER.indexOf(b.day)
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --testPathPattern=scheduleWeek --watchAll=false`
Expected: PASS — 6 passing.

- [ ] **Step 5: Commit**

```bash
git add src/utils/scheduleWeek.js src/utils/__tests__/scheduleWeek.test.js
git commit -m "feat(schedule): shared week-ordering util"
```

---

## Task 2: Public page — adopt shared util (no visual change yet)

Refactor `SchedulePage.js` to consume `scheduleWeek` before adding the grid, so the diff that adds the grid stays small. Pure refactor — output identical.

**Files:**
- Modify: `src/pages/SchedulePage.js`

- [ ] **Step 1: Replace local constants/helpers with imports**

In `src/pages/SchedulePage.js`, add the import near the top (after the existing `useNowTimestamp` import line):

```js
import { DAY_INDEX, dayAbbrev, dayDisplay, orderByWeek } from '../utils/scheduleWeek';
```

Then **delete** these now-duplicated local definitions from the file:
- the `const DAY_INDEX = { ... };` block
- the `const WEEK_ORDER = [ ... ];` block
- the `function dayAbbrev(day) { ... }` function

Leave `parseStartHour`, `ScanlineOverlay`, `StaticPattern`, and all components in place.

- [ ] **Step 2: Use `dayDisplay` in `ScheduleRow` and `orderByWeek` in the component**

In `ScheduleRow`, replace the inline day-name expression:

```jsx
        <span
          className={`text-lg sm:text-xl font-black tracking-tight leading-none ${
            isOff ? 'text-white/35' : 'text-white-body'
          }`}
          style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
        >
          {dayDisplay(item.day)}
        </span>
```

In `SchedulePage`, replace the `orderedSchedule` memo body:

```jsx
  const orderedSchedule = useMemo(() => orderByWeek(schedule), [schedule]);
```

(`useMemo` is still imported and used.)

- [ ] **Step 3: Build to verify no breakage**

Run: `npm run build`
Expected: build succeeds, no ESLint errors about unused/undefined `WEEK_ORDER`, `DAY_INDEX`, or `dayAbbrev`. (`dayAbbrev` is still used inside `ScheduleRow` for the eyebrow label — keep that usage; it now comes from the import.)

- [ ] **Step 4: Manual check**

`npm start`, open `/schedule`. Confirm the page renders identically to before (rows, covers, TODAY highlight, off-day static).

- [ ] **Step 5: Commit**

```bash
git add src/pages/SchedulePage.js
git commit -m "refactor(schedule): public page uses shared week util"
```

---

## Task 3: Public page — desktop week strip (poster cells)

Add `SchedulePosterCell` + `WeekStrip`; show strip at `lg+`, rows below `lg`.

**Files:**
- Modify: `src/pages/SchedulePage.js`

- [ ] **Step 1: Add `SchedulePosterCell` component**

In `src/pages/SchedulePage.js`, add this component above `SchedulePage` (after `ScheduleRow`). It reuses `StaticPattern`, `dayAbbrev`, `dayDisplay`:

```jsx
function SchedulePosterCell({ item, coverUrl, isToday, isOff, isSpecial }) {
  return (
    <div
      className={`group relative aspect-[3/4] overflow-hidden bg-zinc-card border ${
        isToday ? 'border-emerald-signal/60' : 'border-white/8'
      } transition-colors duration-200`}
    >
      {/* Art / static */}
      {isOff ? (
        <StaticPattern />
      ) : coverUrl ? (
        <img
          src={coverUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-[0.5625rem] font-bold tracking-eyebrow-md text-white/30 font-mono">
          NO ART
        </div>
      )}

      {/* Bottom scrim for legibility */}
      <div
        className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/55 to-transparent pointer-events-none"
        aria-hidden="true"
      />

      {/* SPECIAL tag */}
      {isSpecial && !isOff && (
        <span className="absolute top-2 right-2 px-2 py-0.5 border border-purple-gamba/50 bg-black/40 text-[0.5625rem] font-bold tracking-eyebrow-md text-purple-bright font-mono">
          SPECIAL
        </span>
      )}

      {/* Overlay text */}
      <div className="absolute inset-x-0 bottom-0 p-3">
        <div className="flex items-center gap-1.5 text-[0.5625rem] font-bold tracking-eyebrow-md font-mono mb-1">
          <span className={isToday ? 'text-emerald-signal' : 'text-white/55'}>
            {dayAbbrev(item.day)}
          </span>
          {isToday && (
            <span className="relative flex w-1.5 h-1.5">
              <span className="absolute inset-0 rounded-full bg-emerald-signal motion-safe:animate-ping opacity-50" />
              <span className="relative w-1.5 h-1.5 rounded-full bg-emerald-signal" />
            </span>
          )}
        </div>
        <p
          className={`text-sm font-black tracking-tight leading-none mb-1 ${
            isOff ? 'text-white/40' : 'text-white-body'
          }`}
          style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
        >
          {dayDisplay(item.day)}
        </p>
        <p
          className={`text-[0.625rem] font-bold tracking-eyebrow-sm uppercase font-mono ${
            isOff ? 'text-white/30' : 'text-white/60'
          }`}
        >
          {isOff ? 'DARK' : item.time}
        </p>
        {!isOff && (
          <p className="mt-1 text-[0.6875rem] text-white/80 leading-snug line-clamp-2">
            {item.content}
          </p>
        )}
      </div>
    </div>
  );
}

function WeekStrip({ items, gameCovers, todayIndex }) {
  return (
    <div className="grid grid-cols-7 gap-3">
      {items.map((item) => (
        <SchedulePosterCell
          key={item.day}
          item={item}
          coverUrl={item.gameName ? gameCovers[item.gameName] : null}
          isToday={DAY_INDEX[item.day] === todayIndex}
          isOff={item.status === 'off'}
          isSpecial={item.status === 'special'}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Fork the loaded-content branch by breakpoint**

In `SchedulePage`'s returned JSX, find the `<section aria-label="Weekly schedule">` block. The current loaded branch maps `orderedSchedule` to `ScheduleRow`s. Replace **only the loaded-with-content branch** (the `else` after `isLoading` / `allDark`) so it renders both layouts, each gated by breakpoint. The full section becomes:

```jsx
        <section aria-label="Weekly schedule">
          {isLoading ? (
            Array.from({ length: 7 }).map((_, i) => <LoadingRow key={i} />)
          ) : allDark ? (
            <DarkWeekNotice />
          ) : (
            <>
              {/* Desktop: week strip */}
              <div className="hidden lg:block">
                <WeekStrip
                  items={orderedSchedule}
                  gameCovers={gameCovers}
                  todayIndex={todayIndex}
                />
              </div>

              {/* Mobile/tablet: row list */}
              <div className="lg:hidden">
                {orderedSchedule.map((item) => (
                  <ScheduleRow
                    key={item.day}
                    item={item}
                    coverUrl={item.gameName ? gameCovers[item.gameName] : null}
                    isToday={DAY_INDEX[item.day] === todayIndex}
                    isOff={item.status === 'off'}
                    isSpecial={item.status === 'special'}
                  />
                ))}
                <div className="border-t border-white/8" />
              </div>
            </>
          )}
        </section>
```

Note the trailing `<div className="border-t border-white/8" />` that previously sat after the section (guarded by `!allDark`) now lives inside the rows wrapper only (it's a row-list bottom rule; the strip doesn't need it). Remove the old standalone `{!allDark && <div className="border-t border-white/8" />}` line that followed the section's closing logic.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds, no ESLint errors.

- [ ] **Step 4: Manual checks**

`npm start`, open `/schedule`:
- Width ≥1024px → 7 poster cells across in one row; covers fill cells; off-day shows static; TODAY cell has emerald border + pinging dot; special cell shows SPECIAL tag; content text legible over art.
- Width <1024px (resize / devtools) → identical row list as before.
- All-dark week and loading states unchanged at both widths.

- [ ] **Step 5: Commit**

```bash
git add src/pages/SchedulePage.js
git commit -m "feat(schedule): desktop week strip on public page"
```

---

## Task 4: Admin page — extract reusable field block + adopt shared util

Prep refactor: pull the 4 editable fields out of `DayPanel` into a `DayFields` component (used by the drawer next), and import shared helpers. Keep the page rendering the existing vertical stack for now so this commit is behavior-preserving.

**Files:**
- Modify: `src/pages/AdminSchedulePage.js`

- [ ] **Step 1: Add shared util import**

In `src/pages/AdminSchedulePage.js`, add after the existing `DEFAULT_SCHEDULE` import line:

```js
import { orderByWeek, dayAbbrev, dayDisplay } from '../utils/scheduleWeek';
```

- [ ] **Step 2: Extract `DayFields` from `DayPanel`**

Add this component above `DayPanel`. It is the 4-field grid, parameterised by a `day` object and an `onField(field, value)` callback (no index — caller binds the index):

```jsx
function DayFields({ day, onField }) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <label className="block">
        <FieldLabel icon={Clock} code="01">
          Time
        </FieldLabel>
        <input
          type="text"
          value={day.time}
          onChange={(e) => onField('time', e.target.value)}
          placeholder="7:00 PM EST"
          className={inputCls}
        />
      </label>
      <label className="block">
        <FieldLabel code="02">Status</FieldLabel>
        <select
          value={day.status}
          onChange={(e) => onField('status', e.target.value)}
          className={inputCls}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <FieldLabel code="03">Content description</FieldLabel>
        <input
          type="text"
          value={day.content}
          onChange={(e) => onField('content', e.target.value)}
          placeholder="Gaming, Gambling, Just Chatting"
          className={inputCls}
        />
      </label>
      <label className="block">
        <FieldLabel icon={Gamepad2} code="04">
          Game name · optional
        </FieldLabel>
        <GameAutocomplete
          value={day.gameName || ''}
          onChange={(val) => onField('gameName', val)}
          placeholder="Fortnite, Valorant…"
          className={inputCls}
        />
      </label>
    </div>
  );
}
```

- [ ] **Step 3: Make `DayPanel` use `DayFields`**

Replace the `{/* Fields */}` block inside `DayPanel` (the `<div className="grid md:grid-cols-2 gap-4 px-4 py-4">…</div>`) with:

```jsx
      {/* Fields */}
      <div className="px-4 py-4">
        <DayFields
          day={day}
          onField={(field, value) => onChange(index, field, value)}
        />
      </div>
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build succeeds. Admin schedule still renders the vertical stack, unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/pages/AdminSchedulePage.js
git commit -m "refactor(schedule): extract DayFields in admin editor"
```

---

## Task 5: Admin page — week grid + day editor drawer

Replace the vertical `DayPanel` stack with a grid of summary cells; clicking a cell opens a right-side drawer editing a local draft; closing commits the draft into `schedule` state. Global Save unchanged.

**Files:**
- Modify: `tailwind.config.js`
- Modify: `src/pages/AdminSchedulePage.js`

- [ ] **Step 1: Add a `drawer-in` keyframe to Tailwind config**

This codebase keeps animations in `tailwind.config.js` (there is **no** global `slideUp` keyframe — don't reference one). Add a slide-in-from-right animation.

In `tailwind.config.js`, inside `theme.extend.keyframes` (after the `'nn-flicker'` entry, before the closing `}` of `keyframes`), add:

```js
        'drawer-in': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
```

Inside `theme.extend.animation` (after `'nn-flicker'`), add:

```js
        'drawer-in': 'drawer-in 0.2s ease-out',
```

- [ ] **Step 2: Add icons + `DayCell` summary component**

Update the lucide import to add `X` and `Pencil`:

```js
import {
  Save,
  Clock,
  Gamepad2,
  AlertCircle,
  CheckCircle,
  RefreshCcw,
  X,
  Pencil,
} from 'lucide-react';
```

Add `DayCell` above the `AdminSchedulePage` component. It's a focusable button summarising one day:

```jsx
function DayCell({ day, index, onOpen }) {
  const accent = STATUS_ACCENT[day.status] || STATUS_ACCENT.regular;
  const dayCode = String(index + 1).padStart(2, '0');
  const isOff = day.status === 'off';

  return (
    <button
      type="button"
      onClick={() => onOpen(index)}
      className="group text-left border border-white/8 bg-zinc-card/30 hover:border-orange-admin/50 hover:bg-zinc-card/50 focus:outline-none focus:border-orange-admin/70 transition-colors duration-150 flex flex-col"
    >
      {/* Header strip */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/8 text-[0.5625rem] font-bold uppercase tracking-eyebrow-md font-mono">
        <span className={`inline-flex items-center gap-1.5 ${accent.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${accent.dot}`} />
          <span>{accent.label}</span>
        </span>
        <span className="ml-auto text-white/40 tabular-nums">{dayCode}</span>
      </div>

      {/* Body */}
      <div className="px-3 py-3 flex-1 flex flex-col gap-1.5">
        <span
          className="text-base font-black tracking-tight leading-none text-white-body"
          style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
        >
          {dayDisplay(day.day)}
        </span>
        <span className="text-[0.5625rem] font-bold tracking-eyebrow-sm uppercase text-white/45 font-mono">
          {isOff ? 'DARK' : day.time || '—'}
        </span>
        <span className="mt-0.5 text-[0.6875rem] text-white/70 leading-snug line-clamp-2">
          {day.content || <span className="text-white/30">Empty</span>}
        </span>
      </div>

      {/* Edit affordance */}
      <div className="px-3 py-2 border-t border-white/8 flex items-center gap-1.5 text-[0.5625rem] font-bold uppercase tracking-eyebrow-md text-white/30 group-hover:text-orange-admin font-mono transition-colors">
        <Pencil size={10} aria-hidden="true" />
        <span>Edit</span>
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Add `DayEditorDrawer` component**

Add above `AdminSchedulePage`. Right-side drawer over a backdrop; renders `DayFields` against the `draft`; Esc/backdrop/Done all call `onClose`. Focuses the panel on open and restores focus to the opener on close. Slide animation is gated to `motion-safe`.

```jsx
function DayEditorDrawer({ draft, dayLabel, onField, onClose }) {
  const panelRef = React.useRef(null);

  React.useEffect(() => {
    const prevActive = document.activeElement;
    panelRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (prevActive instanceof HTMLElement) prevActive.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Edit ${dayLabel}`}
        className="absolute top-0 right-0 h-full w-full max-w-md bg-zinc-broadcast border-l border-white/10 shadow-2xl focus:outline-none overflow-y-auto motion-safe:animate-drawer-in"
      >
        {/* Drawer header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 text-[0.625rem] font-bold uppercase tracking-eyebrow-md font-mono">
          <span className="inline-flex items-center gap-2 text-orange-admin">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-admin" />
            <span>Editing</span>
          </span>
          <span className="text-white-body text-sm font-bold tracking-tight ml-1">
            {dayLabel}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close editor"
            className="ml-auto p-1.5 text-white/40 hover:text-white-body hover:bg-white/5 transition-colors"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Fields */}
        <div className="px-5 py-5">
          <DayFields day={draft} onField={onField} />
        </div>

        {/* Done bar */}
        <div className="px-5 py-4 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-admin text-zinc-broadcast hover:bg-orange-bright transition-colors duration-150 text-[0.6875rem] font-bold tracking-eyebrow-lg uppercase font-mono"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
```

(`React` is already imported as default in this file — `import React, { ... } from 'react'`. Verify that line includes the default `React`; the existing file imports `React` by default, so `React.useRef`/`React.useEffect` resolve.)

- [ ] **Step 3: Wire grid + drawer state into `AdminSchedulePage`**

Add state below the existing `useState` lines in `AdminSchedulePage`:

```jsx
  const [editingIndex, setEditingIndex] = useState(null);
  const [draft, setDraft] = useState(null);
```

Add handlers (after `handleFieldChange`):

```jsx
  const orderedWithIndex = orderByWeek(
    schedule.map((day, index) => ({ ...day, _index: index }))
  );

  const openEditor = (index) => {
    setDraft({ ...schedule[index] });
    setEditingIndex(index);
  };

  const updateDraft = (field, value) => {
    setDraft((d) => ({ ...d, [field]: value }));
  };

  const closeEditor = () => {
    if (editingIndex != null && draft) {
      setSchedule((prev) => {
        const next = [...prev];
        next[editingIndex] = draft;
        return next;
      });
    }
    setEditingIndex(null);
    setDraft(null);
  };
```

- [ ] **Step 4: Replace the day-panels render block with the grid**

Find the `{/* Day panels */}` block:

```jsx
      {/* Day panels */}
      <div className="space-y-4 mb-8">
        {schedule.map((day, index) => (
          <DayPanel
            key={day.day}
            day={day}
            index={index}
            onChange={handleFieldChange}
          />
        ))}
      </div>
```

Replace it with the week grid (cells in Mon→Sun order via `orderedWithIndex`, opening by original array index):

```jsx
      {/* Week grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
        {orderedWithIndex.map((day) => (
          <DayCell
            key={day.day}
            day={day}
            index={day._index}
            onOpen={openEditor}
          />
        ))}
      </div>
```

- [ ] **Step 5: Render the drawer**

Immediately after the Save bar block (the closing `</div>` of `{/* Save bar */}`), before the component's final closing `</div>`, add:

```jsx
      {editingIndex != null && draft && (
        <DayEditorDrawer
          draft={draft}
          dayLabel={dayDisplay(draft.day)}
          onField={updateDraft}
          onClose={closeEditor}
        />
      )}
```

- [ ] **Step 6: Remove dead code**

`DayPanel` and `handleFieldChange` are now unused. Delete the `DayPanel` function and the `handleFieldChange` handler. Also remove `dayAbbrev` from the `scheduleWeek` import if unused in this file (only `dayDisplay` and `orderByWeek` are used — final import should be `import { orderByWeek, dayDisplay } from '../utils/scheduleWeek';`).

- [ ] **Step 7: Build**

Run: `npm run build`
Expected: build succeeds, no ESLint errors (no unused `DayPanel`, `handleFieldChange`, `dayAbbrev`, `Clock`/`Gamepad2` still used inside `DayFields`).

- [ ] **Step 8: Manual checks**

`npm start`, open `/admin/schedule` (sign in as admin if needed):
- Week grid of 7 cells, Mon→Sun, each showing day/status dot/time/content; wraps to 4 then 2 columns as width shrinks.
- Click a cell → drawer slides in from right with that day's 4 fields seeded correctly.
- Edit time/status/content/game → click Done (or Esc, or backdrop) → drawer closes, cell summary reflects the edit.
- Reopen same cell → shows the edited values (draft committed to state).
- Click **Save schedule** → success banner. Reload page → edits persisted (Firestore round-trip).
- Keyboard: Tab to a cell, Enter opens; focus lands in drawer; Esc closes; focus returns to the cell.
- `prefers-reduced-motion` on → drawer appears without slide.

- [ ] **Step 9: Commit**

```bash
git add src/pages/AdminSchedulePage.js tailwind.config.js
git commit -m "feat(schedule): admin week grid with day editor drawer"
```

---

## Task 6: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full build + util tests**

Run: `npm run build`
Expected: success.

Run: `npm test -- --testPathPattern=scheduleWeek --watchAll=false`
Expected: 6 passing.

- [ ] **Step 2: Cross-check spec acceptance**

Walk the spec's Testing section (admin grid+drawer+save, public desktop strip, public mobile rows, all-dark, loading, reduced-motion) against the running app. Confirm each.

- [ ] **Step 3: Commit any stragglers (if needed)**

```bash
git add -A
git commit -m "chore(schedule): verification pass"
```

(Skip if nothing changed.)

---

## Self-Review Notes

- **Spec coverage:** week grid (T5), click-to-open drawer (T5), local-draft + close-commits + global Save (T5), public desktop strip (T3), public mobile rows preserved (T3), `lg` breakpoint (T3), 7-across poster cells (T3), shared `WEEK_ORDER`/`dayAbbrev` util (T1), status-vocab quirk left untouched (no task depends on `on` vs `regular`). All covered.
- **Type consistency:** `DayFields({ day, onField })`, `DayCell({ day, index, onOpen })`, `DayEditorDrawer({ draft, dayLabel, onField, onClose })`, `orderByWeek`/`dayDisplay`/`dayAbbrev`/`DAY_INDEX` signatures consistent across tasks. `_index` synthetic field used only for ordering→open mapping in admin.
- **No placeholders:** all steps carry full code/commands.
- **Known accepted limitation:** drawer close commits draft (no distinct Cancel), per spec decision 3.
