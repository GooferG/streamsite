# Schedule Week-Grid Redesign

**Date:** 2026-06-08
**Status:** Approved (pending spec review)

## Problem

The admin schedule editor ([src/pages/AdminSchedulePage.js](../../../src/pages/AdminSchedulePage.js)) is a long vertical stack of seven day-panels — every field of every day visible at once, lots of scrolling. The streamer wants something more "calendar I can fill in." The public schedule ([src/pages/SchedulePage.js](../../../src/pages/SchedulePage.js)) is a vertical TV-guide row list; he wants it to read more calendar-like too, while staying on theme.

## Scope & non-goals

- **Data model unchanged.** Schedule stays a recurring weekly array of 7 entries `{ day, time, content, status, gameName }`, stored at Firestore `settings/schedule`. No real dates, no month view, no schema migration.
- **Save path unchanged.** One `setDoc(doc(db,'settings','schedule'), { schedule, updatedAt })` writing the whole array. No per-day partial writes.
- Public page keeps the existing row list as its mobile layout and its data/cover-fetch logic; only the desktop presentation changes.
- No changes to `useSchedule`, `constants.js` SCHEDULE shape, or the cover-fetch (`getGameCovers`) flow.

## Decisions (from brainstorming)

1. Calendar = **7-day week grid** (recurring weekly), not a dated month calendar.
2. Admin = **grid of summary cells + click-to-open editor** (not inline-edit cells).
3. Editor edits **local state only**; **one global "Save schedule"** button commits to Firestore (current model). Closing the editor commits its draft into local state; discard = close without committing.
4. Public = **week grid on desktop, existing row list on mobile.**
5. Public grid = **7 cells across in a single row** (poster-shaped, art-forward; time + title overlaid).
6. Grid→rows breakpoint = **`lg` (1024px)**. Grid at `lg` and up; rows below.

---

## Admin: AdminSchedulePage.js

### Layout

Replace the vertical `space-y-4` stack of `DayPanel`s with a **week grid of 7 summary cells**.

- Grid: `grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3` (admin page is `max-w-4xl`; 7 across is acceptable here since cells are summaries, not posters — wraps to 4/2 on smaller widths). Cells ordered by `WEEK_ORDER` (Mon→Sun) — reuse the same constant the public page uses (see "Shared concerns").
- Each **summary cell** shows, at a glance: day name (e.g. `MON`), status dot + label (reuse existing `STATUS_ACCENT`), time (or `DARK` when off), and content title (truncated). Keeps the slate/mono aesthetic already in the file. The cell is a `<button>` (keyboard-focusable) that opens the editor for that day.
- Header slate and Save bar stay essentially as-is.

### Editor

A focused editor surface for a single day's 4 fields (`time`, `status`, `content`, `gameName`) — the same fields/inputs currently inside `DayPanel` (text input, status `<select>`, content input, `GameAutocomplete`).

- **Form factor:** a **right-side drawer** (`fixed` panel sliding in from the right, with a dimmed backdrop). Chosen over a centered modal because the field stack is tall and narrow and a drawer keeps the week grid partially visible for context. Reduced-motion: respect `prefers-reduced-motion` (no slide, just appear) consistent with the codebase's `motion-reduce`/`motion-safe` usage.
- **Draft model:** opening a cell seeds the drawer with a **local draft copy** of that day. Edits mutate the draft, not the page `schedule` state. "Done" (or backdrop click / Esc) **commits the draft into `schedule` state** and closes. There is no per-field live write to page state — this gives an implicit discard (a future "Cancel" could drop the draft; for now close == commit, matching the low-stakes single-Save model). The cell summary re-renders from committed state.
  - *Note:* close-commits-draft means there's no distinct cancel today. That's acceptable because nothing persists until the global Save; a mis-edit is fixed by reopening or not saving. Keep the draft logic isolated so a Cancel button is a trivial later add.
- **A11y:** drawer is keyboard-navigable, Esc closes, focus moves into the drawer on open and returns to the triggering cell on close, backdrop click closes. Best-effort focus trap (consistent with project's "keyboard-navigable, no formal WCAG target" stance).

### State (page component)

- `schedule` — array, as today.
- `editingIndex` — `number | null`; which day's drawer is open (`null` = closed).
- `draft` — `object | null`; working copy of the day being edited.
- Existing `loading` / `saving` / `message` unchanged.

Handlers: `openEditor(index)` seeds `draft` + sets `editingIndex`; `updateDraft(field, value)` updates `draft`; `closeEditor()` commits `draft` into `schedule[editingIndex]` and clears both. `handleSave` unchanged.

### Component breakdown

- `WeekGrid` / cell rendering — the 7 summary `<button>` cells (can be a small `DayCell` component).
- `DayEditorDrawer` — the drawer: backdrop + panel + the 4 fields (lift the existing field JSX out of `DayPanel`). Props: `draft`, `dayLabel`, `onChange`, `onClose`.
- `DayPanel` is removed (its fields move into the drawer; its header styling informs the cell + drawer header).
- `FieldLabel`, `STATUS_ACCENT`, `STATUS_OPTIONS`, `inputCls` reused.

---

## Public: SchedulePage.js

### Layout swap at `lg`

- **`< lg` (mobile/tablet):** render the **existing `ScheduleRow` list** exactly as today (`hidden lg:hidden` → shown below lg). No behavior change.
- **`≥ lg` (desktop):** render a **week strip** — 7 poster cells in one row (`hidden lg:grid grid-cols-7 gap-3` or `gap-4`). Same `orderedSchedule` data, same `isToday`/`isOff`/`isSpecial` derivation, same `gameCovers` lookup.

Both layouts consume the same already-computed `orderedSchedule` + cover state; this is purely a presentational fork via Tailwind responsive `hidden`/`grid` classes (both rendered in DOM, one hidden per breakpoint — acceptable; data is tiny).

### Poster cell (desktop)

Each cell is a vertical poster:

- **Art-forward:** cover image fills the cell (`aspect-[3/4]`-ish), `object-cover`. Off days use the existing `StaticPattern` (CRT static). No cover → existing "NO ART" treatment.
- **Overlay (bottom):** day abbrev (`MON`/`FRY`), time (or `DARK`), content title (truncated, 1–2 lines). Gradient scrim behind text for legibility on art (honors the dark-gradient-legibility a11y note).
- **TODAY:** emerald ring/border + the existing pinging-dot `TODAY` marker, reusing the emerald-signal treatment already in the row.
- **SPECIAL:** small purple `SPECIAL` tag, reusing existing pill styling.

### Reused / preserved

- `ScanlineOverlay`, `StaticPattern`, `parseStartHour`, `dayAbbrev`, `DAY_INDEX`, `WEEK_ORDER`, header slate, footer, `DarkWeekNotice` (all-dark week), `LoadingRow` (loading state) — unchanged. Loading + all-dark states render once (not per-breakpoint); only the loaded-with-content branch forks into grid vs rows.
- Cover fetch effect, `useSchedule`, timecode — unchanged.

### Component breakdown

- `ScheduleRow` — kept (mobile).
- `SchedulePosterCell` — new; the desktop poster cell. Props mirror `ScheduleRow` (`item`, `coverUrl`, `isToday`, `isOff`, `isSpecial`).
- `WeekStrip` — optional thin wrapper mapping `orderedSchedule` → 7 `SchedulePosterCell`s.

---

## Shared concerns

- **`WEEK_ORDER` / `dayAbbrev`:** the public page defines these; the admin page needs the same Mon→Sun ordering and abbreviations for its grid. Extract `WEEK_ORDER`, `DAY_INDEX`, and `dayAbbrev` into a small shared module (e.g. `src/utils/scheduleWeek.js`) and import in both pages, rather than duplicating. This is a targeted improvement justified by the new shared need — not unrelated refactoring.
- **Status vocab mismatch (existing bug, document only):** admin `STATUS_OPTIONS = ['on','off','special','regular']` but the public page only special-cases `off` and `special` (everything else renders as a normal/"on" row). `'on'` vs `'regular'` are functionally identical on the public side. Not in scope to fix; note it so the grid work doesn't accidentally depend on the distinction. Status dot/label via `STATUS_ACCENT` already handles all four.

## Error handling

- Admin load/save failures: existing `message` banner + `DEFAULT_SCHEDULE` fallback, unchanged.
- Public cover-fetch failure: page still renders (cells show "NO ART" / static), unchanged.
- Drawer with no valid day (shouldn't happen): guard `editingIndex == null` before rendering drawer.

## Testing

No automated tests are wired into CI; existing unit tests don't cover these pages. Manual verification:

1. **Admin:** load `/admin/schedule` → 7-cell week grid renders in Mon→Sun order with correct status dots/times. Click a cell → drawer opens with that day's fields seeded. Edit fields → close → cell summary reflects edits. Save → success banner; reload → persisted. Esc/backdrop close works; focus returns to cell.
2. **Public desktop (`≥1024px`):** `/schedule` shows 7 poster cells across, covers loaded, TODAY highlighted, off-days show static, special tagged.
3. **Public mobile (`<1024px`):** row list identical to today.
4. **All-dark week:** `DarkWeekNotice` still shows (both breakpoints).
5. **Loading:** `LoadingRow`s still show.
6. **Reduced motion:** drawer appears without slide; scanlines/ping already gated.

## Files touched

- `src/pages/AdminSchedulePage.js` — grid + drawer rewrite.
- `src/pages/SchedulePage.js` — add desktop poster grid, gate row list to mobile.
- `src/utils/scheduleWeek.js` — **new**, shared `WEEK_ORDER` / `DAY_INDEX` / `dayAbbrev`.
- No API, hook, constant-shape, or Firestore-rule changes.
