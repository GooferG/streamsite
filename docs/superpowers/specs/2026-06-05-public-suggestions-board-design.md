# Spec — Public suggestions board on HuntSuggestPage

**Date:** 2026-06-05
**Page:** `/hunt-suggest/:linkId` — `src/pages/HuntSuggestPage.js` (the public, password-gated viewer submission page)
**Branch:** continues on `feat/hunt-tracker-redesign`

## Goal
On the public suggestion-submission page, show a live board of everyone's submitted slots and whether each **got in / was skipped / is pending**, beside the existing submit form. Viewers submit while watching the board fill in.

## Decisions locked (from brainstorming)
- **Visibility:** full transparency — show submitter **names** + their slots + status to anyone with the link.
- **Freshness:** auto-refresh by **polling every 12s** (no real-time infra). Plus an immediate re-fetch right after a successful submit. Include a small visible disclaimer that the board refreshes every ~12s.
- **Status mapping (4 internal → 3 public):** `done`→**Got in**, `passed`→**Skipped**, `open`/`in_bonus`→**Pending**.
- **Layout:** two columns — submit form left, board right; stacks on mobile (`lg:grid-cols-2`).

## Architecture

The suggestions live in the owner's private hunt doc (`users/{ownerUid}/active_hunt/current`), which the public page cannot read directly. A new server endpoint brokers a **curated, minimal** public projection.

### New endpoint: `GET /api/hunt-suggest/board?linkId=...`
Mirrors the existing `api/hunt-suggest/info.js` pattern (public, capability = unguessable linkId, admin-cred read).

1. Validate `linkId` (string). Look up `suggestion_intakes/{linkId}` → 404 `NOT_FOUND` if absent. Read `ownerUid` + `open`.
2. Read `users/{ownerUid}/active_hunt/current`. If absent (hunt ended) → return `{ huntName, open, board: [] }` (NOT an error).
3. Project the hunt's `suggestions[]` into a minimal public board. For each person `{ person, slots:[{name,status,...}] }`:
   - Emit `{ person: <string>, slots: [ { name: <string>, status: <'in'|'skipped'|'pending'> } ] }`.
   - Status map: `done`→`'in'`, `passed`→`'skipped'`, `open`→`'pending'`, `in_bonus`→`'pending'`, anything else→`'pending'`.
   - **Strip** every internal field: slot `id`, person `id`, `source`, `submittedAt`, and never touch password hash/salt/ownerUid. Only `person` (name) + `[{name,status}]` leave the server.
4. Response shape:
   ```json
   { "huntName": "Friday Hunt", "open": true,
     "board": [ { "person": "Ana", "slots": [ { "name": "Big Bass", "status": "in" }, { "name": "Gates", "status": "pending" } ] } ] }
   ```
5. Errors: 400 `MISSING_LINK_ID`, 404 `NOT_FOUND`, 500 `INTERNAL`. Method guard: GET only (405 otherwise). Apply CORS + OPTIONS like the sibling endpoints.

> Note: `huntName`/`open` are already public via `info.js`; the board adds names+slots+status. No password hash, owner uid, slot ids, or timestamps are ever serialized.

### Client: `HuntSuggestPage.js`
- New state: `board` (array | null), `boardLoading` (first load only), `boardError` (silent — board just hides on persistent error, page still usable for submitting).
- `fetchBoard()` — GET `/api/hunt-suggest/board?linkId=...`, set `board` from `data.board`. On error, leave the last good board (don't blank it on a transient poll failure).
- Polling effect: call `fetchBoard()` on mount; `setInterval(fetchBoard, 12000)`; clear on unmount. Skip the poll tick when `document.hidden` (avoid background churn); fetch once on `visibilitychange` back to visible.
- After a successful submit (existing `submit()` success path), call `fetchBoard()` immediately so the submitter sees their picks.
- "Your own" highlight: track the last-submitted name (the form already has `name`); a board group whose `person` matches (case-insensitive, trimmed) gets an emerald ring + "you" tag.

### Layout & component
- Wrap the page's existing centered content in a `lg:grid-cols-2 gap-*` grid: **left** = the existing form block (unchanged), **right** = a new `<SuggestionBoard>` panel.
- Extract `src/components/SuggestionBoard.js` (presentational): props `{ board, loading, myName }`. Keeps `HuntSuggestPage` from growing and isolates the board UI.
- On mobile (`< lg`), the board stacks BELOW the form (form is the primary action).

### Board UI (`/gamba` register — reuse the page's existing tokens)
- Panel header: "Suggestions so far" + a live dot + count summary (`{totalPicks} picks · {inCount} in`). Small muted disclaimer line: "Refreshes every 12s."
- Grouped by person. Each group: name (purple-bright), then slot rows: slot name (left) + a status chip (right).
- Status chips:
  - **Got in** — ✓ emerald (`text-emerald-signal`, check icon).
  - **Skipped** — ✕ muted-red (`text-red-destructive/80`, x icon).
  - **Pending** — — muted (`text-white/45`, dash).
- "You" group: emerald ring (`ring-1 ring-emerald-signal/40`) + a small "you" tag by the name.
- Empty state (`board.length === 0`): "No picks yet — be the first." Loading (first load only): a simple skeleton or the tuning-phrase pattern used elsewhere; subsequent polls update silently (no flash).
- Board column is height-capped with internal scroll (e.g. `max-h-[70vh] overflow-y-auto`) so long lists don't balloon the page.

## Edge cases
- **Link closed** (`open: false`): board still renders (read-only view of the history); the form keeps its existing closed/disabled state. Board does not error.
- **Hunt ended / no active hunt**: board endpoint returns `board: []`; UI shows the empty state.
- **Transient poll failure**: keep the last good board; do not blank or error-out the panel (the page must stay usable for submitting).
- **User-submitted names/slots are free text**: render as text (React escapes — no HTML injection). Slot/name lengths already capped server-side (`MAX_SLOT_LEN`, `MAX_NAME_LEN`).
- **Background tab**: polling pauses when `document.hidden`; resumes (with one immediate fetch) on return.
- **Large boards**: internal scroll; the projection is already bounded by `MAX_PEOPLE` (150) × `MAX_SLOTS` (20) server-side.

## What is NOT changing
- The submit form, its validation, cooldown, and caps.
- `info.js`, `submit.js`, `manage.js` endpoints.
- No new Firestore collections or security-rules changes — the board endpoint reads via admin creds, exactly like `info.js`.

## Target files
- **Create** `api/hunt-suggest/board.js` — the public projection endpoint.
- **Create** `src/components/SuggestionBoard.js` — the board panel (presentational).
- **Modify** `src/pages/HuntSuggestPage.js` — two-column layout, board state + 12s polling + post-submit refetch + "you" highlight.

## Testing
- Unit test the status-projection mapping (pure function): extract `projectBoard(suggestions)` (or the status map) into a testable helper — e.g. `src/utils/suggestionBoard.js` with `toPublicStatus(status)` and `projectBoard(suggestions)` — and assert: done→in, passed→skipped, open/in_bonus→pending, internal fields stripped, empty/missing input → []. (Server handlers aren't unit-tested in this repo, but the pure projection helper can be, and the endpoint imports it.)
- `SuggestionBoard` render test (repo convention: `@testing-library/react`, `toBeTruthy`, no jest-dom): renders groups, status chips, empty state, and the "you" highlight when `myName` matches.
- Manual: open a link, submit from one name, mark slots got-in/skipped on the owner side, confirm the board reflects within ~12s; confirm names/slots/status show and no internal fields leak (check the network response).

## Build order
1. `src/utils/suggestionBoard.js` (`toPublicStatus`, `projectBoard`) + unit tests — pure, derisks the mapping.
2. `api/hunt-suggest/board.js` — endpoint using the helper.
3. `src/components/SuggestionBoard.js` + render test.
4. `HuntSuggestPage.js` — layout + polling + wiring.
