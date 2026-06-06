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

## Duplicate-game blocking (first caller wins)

A game can appear on a hunt's suggestion board **at most once**, across all callers, for the life of the hunt. Whichever intake path adds it first holds it; later attempts to add the same game (by anyone, via any path) drop that one game.

### The rule (symmetric — no privileged path)
- **Matching:** case-insensitive, trimmed. `"Big Bass"`, `"big bass "`, `"BIG BASS"` collide.
- **`taken` set:** every slot name (lowercased, trimmed) already present in `hunt.suggestions[].slots[]`, across ALL people and ALL statuses (open / in_bonus / passed / done — any prior suggestion blocks; a skipped game stays locked for the hunt).
- **Scope:** per-hunt. A game blocked this hunt is free again in the next hunt (taken is rebuilt from the current hunt's suggestions).
- **Partial-accept:** only the clashing game(s) drop; every other slot in the submission still goes in. A submission is never rejected wholesale for one clash.
- **Both intake paths enforce it identically:** the public link submit (`api/hunt-suggest/submit.js`) AND the host roster pull (`api/roster/add.js`) check the same global `taken` set. Example sequence: Bo submits "Big Bass" via link first → it's held. Host then roster-pulls Ana (profile: Big Bass + Gates) → Ana's Big Bass is skipped (Bo holds it), Ana's Gates is added. Ana's other slots are unaffected by the one clash. The reverse order yields the reverse result — strictly first-come-first-served.

### `api/hunt-suggest/submit.js` changes
Inside the transaction, after building `cleanSlots`:
1. Build `taken` = Set of lowercased-trimmed slot names from `suggestions[].slots[]`. **Exclude** the slots of the entry being replaced when this is a same-name re-submit (so a returning submitter doesn't self-collide against their own prior picks).
2. Dedup **within the incoming batch** too (a viewer listing the same game twice keeps one).
3. Partition `cleanSlots` → `acceptedSlots` (name not in `taken`) and `droppedSlots` (in `taken`).
4. Build the person's `slots` from `acceptedSlots` only.
5. If `acceptedSlots` is empty (every game already taken): do NOT create/replace an empty person entry; return a soft success `{ ok: true, added: 0, dropped: [...names] }` (the form shows "All your picks were already called" — not an error).
6. Otherwise proceed with the existing add/replace, and return `{ ok: true, added: acceptedSlots.length, dropped: droppedSlots, replaced }`.

### `api/roster/add.js` changes
Currently dedups per-person (a Set of the target entry's own slot names). Extend to the **global** `taken` set: build `taken` from ALL `suggestions[].slots[]` (excluding, for a merge into an existing same-name entry, that entry's own slots), then append only the viewer's default slots whose name is not in `taken`. Keeps the two paths consistent so the owner can't create a duplicate the public form forbids. Return value keeps `{ added, merged }`; `added` now reflects post-dedup count.

### Client message (`HuntSuggestPage.js`)
On submit success, surface `dropped`: e.g. "Added 2 · Big Bass was already called." When `added === 0`, "All your picks were already called — try different games." This is additive to the existing success handling.

### Board display
No special dup UI is needed (there are no dups by construction). The board naturally shows each game once under its single (first) caller, reinforcing first-caller-wins.

## Edge cases
- **Duplicate game, different casing/spacing**: blocked via normalized (lowercased, trimmed) match.
- **Returning submitter re-submits their own game**: not blocked against themselves — `taken` excludes the replaced entry's slots.
- **Submission entirely duplicates**: soft "all taken" response, no error, no empty person entry created.
- **Link closed** (`open: false`): board still renders (read-only view of the history); the form keeps its existing closed/disabled state. Board does not error.
- **Hunt ended / no active hunt**: board endpoint returns `board: []`; UI shows the empty state.
- **Transient poll failure**: keep the last good board; do not blank or error-out the panel (the page must stay usable for submitting).
- **User-submitted names/slots are free text**: render as text (React escapes — no HTML injection). Slot/name lengths already capped server-side (`MAX_SLOT_LEN`, `MAX_NAME_LEN`).
- **Background tab**: polling pauses when `document.hidden`; resumes (with one immediate fetch) on return.
- **Large boards**: internal scroll; the projection is already bounded by `MAX_PEOPLE` (150) × `MAX_SLOTS` (20) server-side.

## What is NOT changing
- The submit form's layout-independent validation, cooldown, and the per-person slot/people caps.
- `info.js`, `manage.js` endpoints.
- No new Firestore collections or security-rules changes — the board endpoint reads via admin creds, exactly like `info.js`.
- (`submit.js` and `roster/add.js` DO change — they gain the global duplicate-game block; see above.)

## Target files
- **Create** `api/hunt-suggest/board.js` — the public projection endpoint.
- **Create** `src/components/SuggestionBoard.js` — the board panel (presentational).
- **Create** `src/utils/suggestionBoard.js` — pure helpers: `toPublicStatus(status)`, `projectBoard(suggestions)` (board projection + field-stripping), and `takenSlotSet(suggestions, { excludePersonId })` + `dedupeAgainstTaken(names, taken)` (the shared dup-block logic, so submit + roster + tests use one implementation).
- **Modify** `api/hunt-suggest/submit.js` — global dup-block on link submissions (partial-accept, `dropped` in response).
- **Modify** `api/roster/add.js` — same global dup-block on roster pulls (replaces its per-person-only dedup).
- **Modify** `src/pages/HuntSuggestPage.js` — two-column layout, board state + 12s polling + post-submit refetch + "you" highlight + the `dropped`/"already called" message.

## Testing
- Unit test `src/utils/suggestionBoard.js` (pure):
  - `toPublicStatus`: done→in, passed→skipped, open/in_bonus/other→pending.
  - `projectBoard`: strips internal fields (id, source, submittedAt), maps status, empty/missing input → [].
  - `takenSlotSet`: lowercased+trimmed names across all people/statuses; honors `excludePersonId` (returning submitter doesn't self-collide).
  - `dedupeAgainstTaken`: case/space-insensitive match; partitions accepted vs dropped; dedups within the incoming batch.
- `SuggestionBoard` render test (repo convention: `@testing-library/react`, `toBeTruthy`, no jest-dom): renders groups, status chips, empty state, "you" highlight when `myName` matches.
- Manual: (board) open a link, submit from one name, mark slots got-in/skipped on the owner side, confirm the board reflects within ~12s and no internal fields leak (check the network response). (dup-block) submit "Big Bass" as Bo, then submit "Big Bass" + "Gates" as Cy → only Gates lands, message names Big Bass; roster-pull a viewer whose profile includes an already-taken game → that game is skipped, the rest add.

## Build order
1. `src/utils/suggestionBoard.js` (`toPublicStatus`, `projectBoard`, `takenSlotSet`, `dedupeAgainstTaken`) + unit tests — pure, derisks both the projection and the dup-block.
2. `api/hunt-suggest/board.js` — projection endpoint using the helper.
3. `api/hunt-suggest/submit.js` + `api/roster/add.js` — dup-block using the shared helper.
4. `src/components/SuggestionBoard.js` + render test.
5. `HuntSuggestPage.js` — layout + polling + wiring + dup message.
