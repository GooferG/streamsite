# Public Suggestions Board + Duplicate-Game Blocking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a live public suggestions board to the viewer submission page, and enforce global first-caller-wins duplicate-game blocking across both the link-submit and roster-add intake paths.

**Architecture:** A single pure helper module (`src/utils/suggestionBoard.js`) holds both the public board projection (field-stripping + status mapping) and the shared dup-block logic (`takenSlotSet` + `dedupeAgainstTaken`), so the server endpoints and the UI share one tested implementation. A new public read endpoint (`api/hunt-suggest/board.js`) serves the curated projection; `submit.js` and `roster/add.js` adopt the shared dedup; `HuntSuggestPage.js` gains a two-column layout, 12s polling, and a "dropped" message.

**Tech Stack:** Vercel serverless functions (Node, `firebase-admin` via `api/_lib/firebaseAdmin.js`), React 19 (CRA), Tailwind, Jest + React Testing Library (no jest-dom — assert with `toBeTruthy`).

**Spec:** `docs/superpowers/specs/2026-06-05-public-suggestions-board-design.md`

---

## Conventions
- **Test runner:** `npm test -- --watchAll=false --testPathPattern=<name>`. No jest-dom: use `toBeTruthy()`, `getByText`, `getByRole`, `queryBy*`.
- **Tokens (`/gamba`/page register):** `text-emerald-signal` (got-in/positive), `text-red-destructive` (skipped), `text-purple-bright` (names), `text-white/45` (pending/muted), surfaces `bg-zinc-card/40`, `bg-zinc-broadcast`, borders `border-white/8`. Mono labels `font-mono tracking-eyebrow-*`.
- **Server endpoints:** ESM (`export default async function handler(req, res)`), `import { adminDb } from '../_lib/firebaseAdmin.js'`, `import { applyCors } from '../_lib/verifyAuth.js'` (or `requireAuth` for roster). Set CORS, handle OPTIONS, guard method.
- **Commit style:** short imperative subject, NO `Co-Authored-By` trailer.
- Status values in the hunt data: a slot's `status` ∈ `'open' | 'in_bonus' | 'passed' | 'done'`.

## File Structure
**Create:**
- `src/utils/suggestionBoard.js` — pure helpers: `toPublicStatus`, `projectBoard`, `normalizeSlotName`, `takenSlotSet`, `dedupeAgainstTaken`.
- `src/utils/__tests__/suggestionBoard.test.js` — unit tests for all helpers.
- `api/hunt-suggest/board.js` — public projection endpoint.
- `src/components/SuggestionBoard.js` — presentational board panel.
- `src/components/__tests__/SuggestionBoard.test.js` — render test.

**Modify:**
- `api/hunt-suggest/submit.js` — global dup-block (partial-accept + `dropped` in response).
- `api/roster/add.js` — global dup-block (replaces per-person-only dedup).
- `src/pages/HuntSuggestPage.js` — two-column layout, board state + polling, post-submit refetch, "you" highlight, dropped message.

---

## Task 1: Pure helpers — projection + dedup

**Files:**
- Create: `src/utils/suggestionBoard.js`
- Test: `src/utils/__tests__/suggestionBoard.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/utils/__tests__/suggestionBoard.test.js`:

```javascript
import {
  toPublicStatus,
  projectBoard,
  normalizeSlotName,
  takenSlotSet,
  dedupeAgainstTaken,
} from '../suggestionBoard';

describe('toPublicStatus', () => {
  test('maps the four internal states to three public ones', () => {
    expect(toPublicStatus('done')).toBe('in');
    expect(toPublicStatus('passed')).toBe('skipped');
    expect(toPublicStatus('open')).toBe('pending');
    expect(toPublicStatus('in_bonus')).toBe('pending');
    expect(toPublicStatus('anything-else')).toBe('pending');
    expect(toPublicStatus(undefined)).toBe('pending');
  });
});

describe('projectBoard', () => {
  const SUGGESTIONS = [
    {
      id: 'p1', person: 'Ana', source: 'link', submittedAt: 123,
      slots: [
        { id: 's1', name: 'Big Bass', status: 'done' },
        { id: 's2', name: 'Gates', status: 'open' },
      ],
    },
    {
      id: 'p2', person: 'Bo', source: 'roster', submittedAt: 456,
      slots: [{ id: 's3', name: 'Doom', status: 'passed' }],
    },
  ];

  test('projects person + slots with public status, stripping internal fields', () => {
    const board = projectBoard(SUGGESTIONS);
    expect(board).toEqual([
      { person: 'Ana', slots: [
        { name: 'Big Bass', status: 'in' },
        { name: 'Gates', status: 'pending' },
      ] },
      { person: 'Bo', slots: [{ name: 'Doom', status: 'skipped' }] },
    ]);
  });

  test('never leaks id / source / submittedAt', () => {
    const board = projectBoard(SUGGESTIONS);
    const json = JSON.stringify(board);
    expect(json).not.toMatch(/submittedAt|source|"id"|s1|p1/);
  });

  test('empty / missing input returns []', () => {
    expect(projectBoard([])).toEqual([]);
    expect(projectBoard(undefined)).toEqual([]);
    expect(projectBoard(null)).toEqual([]);
  });

  test('tolerates a person with no slots array', () => {
    expect(projectBoard([{ person: 'X' }])).toEqual([{ person: 'X', slots: [] }]);
  });
});

describe('normalizeSlotName', () => {
  test('lowercases and trims', () => {
    expect(normalizeSlotName('  Big Bass ')).toBe('big bass');
    expect(normalizeSlotName('BIG BASS')).toBe('big bass');
    expect(normalizeSlotName(null)).toBe('');
  });
});

describe('takenSlotSet', () => {
  const SUGGESTIONS = [
    { id: 'p1', person: 'Ana', slots: [
      { name: 'Big Bass', status: 'done' }, { name: 'Gates', status: 'passed' },
    ] },
    { id: 'p2', person: 'Bo', slots: [{ name: 'Doom', status: 'open' }] },
  ];

  test('collects all slot names lowercased across people and statuses', () => {
    const taken = takenSlotSet(SUGGESTIONS);
    expect(taken.has('big bass')).toBe(true); // done still blocks
    expect(taken.has('gates')).toBe(true);    // passed still blocks
    expect(taken.has('doom')).toBe(true);
    expect(taken.size).toBe(3);
  });

  test('excludePersonId omits that entry’s own slots (returning submitter)', () => {
    const taken = takenSlotSet(SUGGESTIONS, { excludePersonId: 'p1' });
    expect(taken.has('big bass')).toBe(false);
    expect(taken.has('gates')).toBe(false);
    expect(taken.has('doom')).toBe(true);
  });

  test('handles empty / missing', () => {
    expect(takenSlotSet([]).size).toBe(0);
    expect(takenSlotSet(undefined).size).toBe(0);
  });
});

describe('dedupeAgainstTaken', () => {
  test('partitions accepted vs dropped by the taken set (case-insensitive)', () => {
    const taken = new Set(['big bass']);
    const { accepted, dropped } = dedupeAgainstTaken(['BIG BASS', 'Gates', 'Doom'], taken);
    expect(accepted).toEqual(['Gates', 'Doom']);
    expect(dropped).toEqual(['BIG BASS']);
  });

  test('dedups within the incoming batch (keeps first occurrence)', () => {
    const { accepted, dropped } = dedupeAgainstTaken(['Gates', 'gates', 'Doom'], new Set());
    expect(accepted).toEqual(['Gates', 'Doom']);
    expect(dropped).toEqual(['gates']); // second occurrence dropped as in-batch dup
  });

  test('empty input yields empty partitions', () => {
    expect(dedupeAgainstTaken([], new Set())).toEqual({ accepted: [], dropped: [] });
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- --watchAll=false --testPathPattern=suggestionBoard`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/utils/suggestionBoard.js`**

```javascript
// src/utils/suggestionBoard.js
// Shared, pure helpers for the public suggestion board projection and the
// global first-caller-wins duplicate-game block. Used by the board endpoint,
// submit.js, roster/add.js, and the UI so all paths agree on one implementation.

// Internal slot status (open|in_bonus|passed|done) -> public (pending|skipped|in).
export function toPublicStatus(status) {
  if (status === 'done') return 'in';
  if (status === 'passed') return 'skipped';
  return 'pending'; // open, in_bonus, or anything unexpected
}

// Curated public projection: person name + [{name, status}], nothing else.
// Strips slot/person ids, source, submittedAt, and never serializes anything else.
export function projectBoard(suggestions) {
  if (!Array.isArray(suggestions)) return [];
  return suggestions.map((p) => ({
    person: String(p?.person ?? ''),
    slots: (Array.isArray(p?.slots) ? p.slots : []).map((s) => ({
      name: String(s?.name ?? ''),
      status: toPublicStatus(s?.status),
    })),
  }));
}

// Normalized key for matching slot names (case-insensitive, trimmed).
export function normalizeSlotName(name) {
  return String(name ?? '').trim().toLowerCase();
}

// Set of every slot name already claimed in the hunt (all people, all statuses).
// opts.excludePersonId omits one person entry's own slots so a returning
// submitter (same person id) doesn't collide against their own prior picks.
export function takenSlotSet(suggestions, opts = {}) {
  const { excludePersonId } = opts;
  const set = new Set();
  if (!Array.isArray(suggestions)) return set;
  for (const p of suggestions) {
    if (excludePersonId != null && p?.id === excludePersonId) continue;
    for (const s of Array.isArray(p?.slots) ? p.slots : []) {
      const key = normalizeSlotName(s?.name);
      if (key) set.add(key);
    }
  }
  return set;
}

// Partition incoming slot names into accepted vs dropped against the taken set,
// also dropping in-batch duplicates (keeps the first occurrence). Preserves the
// original (un-normalized) strings in the output so the UI can echo them.
export function dedupeAgainstTaken(names, taken) {
  const accepted = [];
  const dropped = [];
  const seen = new Set();
  for (const raw of Array.isArray(names) ? names : []) {
    const key = normalizeSlotName(raw);
    if (!key) continue;
    if (taken.has(key) || seen.has(key)) {
      dropped.push(raw);
    } else {
      seen.add(key);
      accepted.push(raw);
    }
  }
  return { accepted, dropped };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- --watchAll=false --testPathPattern=suggestionBoard`
Expected: PASS (all helper tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/suggestionBoard.js src/utils/__tests__/suggestionBoard.test.js
git commit -m "feat(hunt): shared suggestion board projection + dedup helpers"
```

---

## Task 2: Public board endpoint

**Files:**
- Create: `api/hunt-suggest/board.js`

No unit test (the repo doesn't test serverless handlers; the projection logic is already tested in Task 1). Verified manually + by the build.

- [ ] **Step 1: Implement `api/hunt-suggest/board.js`**

```javascript
// api/hunt-suggest/board.js
import { adminDb } from '../_lib/firebaseAdmin.js';
import { applyCors } from '../_lib/verifyAuth.js';
import { projectBoard } from '../../src/utils/suggestionBoard.js';

// Public read of a hunt's suggestion board for the submission page. Capability =
// the unguessable linkId (same model as info.js). Returns ONLY the curated
// projection (person + slot names + public status) — never internal fields,
// password material, or the owner uid.
export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const linkId = req.query?.linkId;
  if (!linkId || typeof linkId !== 'string') {
    return res.status(400).json({ error: 'MISSING_LINK_ID' });
  }

  try {
    const intakeSnap = await adminDb.doc(`suggestion_intakes/${linkId}`).get();
    if (!intakeSnap.exists) return res.status(404).json({ error: 'NOT_FOUND' });
    const intake = intakeSnap.data();

    const huntName = intake.huntName || 'Bonus hunt';
    const open = intake.open !== false;

    const activeSnap = await adminDb.doc(`users/${intake.ownerUid}/active_hunt/current`).get();
    if (!activeSnap.exists) {
      // Hunt ended or not started — board is simply empty, not an error.
      return res.status(200).json({ huntName, open, board: [] });
    }
    const hunt = activeSnap.data();
    const board = projectBoard(Array.isArray(hunt.suggestions) ? hunt.suggestions : []);
    return res.status(200).json({ huntName, open, board });
  } catch (err) {
    console.error('hunt-suggest/board error', err);
    return res.status(500).json({ error: 'INTERNAL' });
  }
}
```

- [ ] **Step 2: Verify the import path resolves + build**

The endpoint imports from `../../src/utils/suggestionBoard.js`. Confirm that relative path is correct from `api/hunt-suggest/board.js` (api/hunt-suggest → ../../ → repo root → src/utils). Serverless functions can import from `src/` in this repo (ESM). Run the production build to catch any resolution/syntax error in the bundled client (the endpoint itself isn't bundled by CRA, but the shared util is imported by client code too, so a syntax error would surface):

Run: `npm run build`
Expected: Compiled successfully (only the known pre-existing warnings, if any).

- [ ] **Step 3: Commit**

```bash
git add api/hunt-suggest/board.js
git commit -m "feat(hunt): public suggestion board read endpoint"
```

---

## Task 3: Dup-block in submit.js

**Files:**
- Modify: `api/hunt-suggest/submit.js`

Adopt the shared dedup. Build `taken` from the current suggestions (excluding the replaced entry for a returning submitter), partition incoming slots, build the person from accepted only, and return `dropped`. If everything was a dup, return a soft success with `added: 0` (no empty person entry).

- [ ] **Step 1: Add the import**

At the top of `api/hunt-suggest/submit.js`, with the other imports:

```javascript
import { takenSlotSet, dedupeAgainstTaken } from '../../src/utils/suggestionBoard.js';
```

- [ ] **Step 2: Apply the dedup inside the transaction**

Find the transaction body. After the `existingIdx` lookup + the cooldown/LIST_FULL guards, and BEFORE building `slotObjs`, insert the dedup. Replace the block that currently builds `slotObjs`/`person`/`next` with this (the engineer should read the current code ~lines 87-107 and replace from the `const slotObjs = ...` through the `tx.update(...)`):

```javascript
      // Global first-caller-wins dedup. taken = every slot name already on the
      // board EXCEPT this submitter's own prior entry (a re-submit replaces it,
      // so their old picks must not block their new ones).
      const replacedId = existingIdx !== -1 ? suggestions[existingIdx].id : null;
      const taken = takenSlotSet(suggestions, { excludePersonId: replacedId });
      const { accepted, dropped } = dedupeAgainstTaken(cleanSlots, taken);

      // Everything was already called — don't create/replace with an empty entry.
      if (accepted.length === 0) {
        return { added: 0, dropped, replaced: existingIdx !== -1, empty: true };
      }

      const slotObjs = accepted.map((nm) => ({
        id: crypto.randomUUID(),
        name: nm,
        status: 'open',
      }));
      const person = {
        id: existingIdx !== -1 ? suggestions[existingIdx].id : crypto.randomUUID(),
        person: cleanName,
        slots: slotObjs,
        source: 'link',
        submittedAt: Date.now(),
      };

      const next =
        existingIdx !== -1
          ? suggestions.map((p, i) => (i === existingIdx ? person : p))
          : [...suggestions, person];

      tx.update(activeRef, { suggestions: next });
      return { added: accepted.length, dropped, replaced: existingIdx !== -1 };
```

NOTE: the `cleanSlots.slice(0, MAX_SLOTS)` cap already happened before the transaction — `dedupeAgainstTaken` operates on the already-capped `cleanSlots`. Keep that.

- [ ] **Step 3: Update the success response**

Find the success return after the transaction (currently `return res.status(200).json({ ok: true, ...result });`). It already spreads `result`, so `added`/`dropped`/`replaced`/`empty` flow through automatically. Confirm it reads:

```javascript
    return res.status(200).json({ ok: true, ...result });
```

(No change needed if it already spreads `result`. If it returned a narrower object, widen it to spread `result`.)

- [ ] **Step 4: Build check**

Run: `npm run build`
Expected: Compiled successfully. (The shared util is now imported by a second server file; a syntax error would surface via the client import too.)

Run: `npm test -- --watchAll=false --testPathPattern=suggestionBoard`
Expected: PASS (helpers unchanged; sanity).

- [ ] **Step 5: Commit**

```bash
git add api/hunt-suggest/submit.js
git commit -m "feat(hunt): global duplicate-game block on link submissions"
```

---

## Task 4: Dup-block in roster/add.js

**Files:**
- Modify: `api/roster/add.js`

Replace the per-person-only dedup with the global `takenSlotSet`. A host bulk-adding a viewer's defaults skips any game already on the board (any person), but still adds the rest. For a merge into an existing same-name entry, exclude that entry's own slots from `taken` (so re-adding the same viewer doesn't self-block their existing picks).

- [ ] **Step 1: Add the import**

At the top of `api/roster/add.js`:

```javascript
import { takenSlotSet, normalizeSlotName } from '../../src/utils/suggestionBoard.js';
```

- [ ] **Step 2: Replace the dedup logic**

The current transaction (around lines 58-92) computes `addedCount`/`next` with a per-person `have` Set in the merge branch and no dedup in the new-entry branch. Replace that whole block — from `let addedCount = 0;` through the `tx.update(activeRef, { suggestions: next });` and its `return` — with the version below.

Two filters apply to the viewer's `defaultSlots`:
- **Global** (`freshNames`): drop any name already on the board (any person), via `takenSlotSet` excluding this viewer's own entry so a re-add doesn't self-block.
- **Own-entry** (merge branch only, `have`): when merging into the viewer's existing same-name entry, also drop names that entry already lists (since `excludePersonId` removed them from the global set, they'd otherwise re-add as a self-duplicate).

The new-entry branch needs only the global filter.

```javascript
      // Global first-caller-wins dedup: skip any default slot already on the
      // board (any person). Exclude this viewer's own existing entry so a re-add
      // doesn't self-block; the merge branch re-applies an own-entry filter below.
      const excludeId = existingIdx !== -1 ? suggestions[existingIdx].id : null;
      const taken = takenSlotSet(suggestions, { excludePersonId: excludeId });
      const freshNames = defaultSlots.filter(
        (nm) => !taken.has(normalizeSlotName(nm))
      );

      let addedCount = 0;
      let next;
      if (existingIdx !== -1) {
        const entry = suggestions[existingIdx];
        // Own-entry filter: don't re-add a game this entry already lists.
        const have = new Set(
          (Array.isArray(entry.slots) ? entry.slots : []).map((s) => normalizeSlotName(s.name))
        );
        const newSlots = freshNames
          .filter((nm) => !have.has(normalizeSlotName(nm)))
          .map((nm) => ({ id: crypto.randomUUID(), name: nm, status: 'open' }));
        addedCount = newSlots.length;
        const merged = {
          ...entry,
          slots: [...(Array.isArray(entry.slots) ? entry.slots : []), ...newSlots],
        };
        next = suggestions.map((p, i) => (i === existingIdx ? merged : p));
      } else {
        const slotObjs = freshNames.map((nm) => ({
          id: crypto.randomUUID(),
          name: nm,
          status: 'open',
        }));
        addedCount = slotObjs.length;
        // Don't create an empty person row if every default was already taken.
        if (addedCount === 0) {
          return { added: 0, merged: false };
        }
        const person = {
          id: crypto.randomUUID(),
          person: personName,
          slots: slotObjs,
          source: 'roster',
          submittedAt: Date.now(),
        };
        next = [...suggestions, person];
      }

      tx.update(activeRef, { suggestions: next });
      return { added: addedCount, merged: existingIdx !== -1 };
```

- [ ] **Step 3: Build + sanity**

Run: `npm run build`
Expected: Compiled successfully.

Run: `npm test -- --watchAll=false --testPathPattern=suggestionBoard`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add api/roster/add.js
git commit -m "feat(hunt): global duplicate-game block on roster pulls"
```

---

## Task 5: SuggestionBoard component

**Files:**
- Create: `src/components/SuggestionBoard.js`
- Test: `src/components/__tests__/SuggestionBoard.test.js`

Presentational panel. Props `{ board, loading, myName, refreshSeconds }`. Groups by person (board is already grouped), renders status chips, empty/loading states, "you" highlight, and the "Refreshes every Ns" disclaimer.

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/SuggestionBoard.test.js`:

```javascript
import { render, screen } from '@testing-library/react';
import SuggestionBoard from '../SuggestionBoard';

const BOARD = [
  { person: 'Ana', slots: [
    { name: 'Big Bass', status: 'in' },
    { name: 'Gates', status: 'pending' },
  ] },
  { person: 'Bo', slots: [{ name: 'Doom', status: 'skipped' }] },
];

test('renders each person and their slots', () => {
  render(<SuggestionBoard board={BOARD} loading={false} myName="" refreshSeconds={12} />);
  expect(screen.getByText('Ana')).toBeTruthy();
  expect(screen.getByText('Bo')).toBeTruthy();
  expect(screen.getByText('Big Bass')).toBeTruthy();
  expect(screen.getByText('Doom')).toBeTruthy();
});

test('shows the refresh disclaimer', () => {
  render(<SuggestionBoard board={BOARD} loading={false} myName="" refreshSeconds={12} />);
  expect(screen.getByText(/refreshes every 12s/i)).toBeTruthy();
});

test('empty board shows the be-the-first state', () => {
  render(<SuggestionBoard board={[]} loading={false} myName="" refreshSeconds={12} />);
  expect(screen.getByText(/be the first/i)).toBeTruthy();
});

test('highlights the viewer’s own group (case-insensitive match)', () => {
  render(<SuggestionBoard board={BOARD} loading={false} myName="  ana " refreshSeconds={12} />);
  // The "you" tag renders only on the matching group.
  expect(screen.getByText(/you/i)).toBeTruthy();
});

test('loading (first load, no board yet) shows a loading state', () => {
  render(<SuggestionBoard board={null} loading={true} myName="" refreshSeconds={12} />);
  expect(screen.getByText(/loading/i)).toBeTruthy();
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- --watchAll=false --testPathPattern=SuggestionBoard`
Expected: FAIL — not found.

- [ ] **Step 3: Implement `src/components/SuggestionBoard.js`**

```javascript
// src/components/SuggestionBoard.js
import { Check, X, Radio } from 'lucide-react';

// Public, read-only board of everyone's suggested slots + got-in/skipped/pending
// status. Driven by the projected board from /api/hunt-suggest/board.
function StatusChip({ status }) {
  if (status === 'in') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-eyebrow-md font-mono text-emerald-signal">
        <Check size={11} aria-hidden="true" /> Got in
      </span>
    );
  }
  if (status === 'skipped') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-eyebrow-md font-mono text-red-destructive/80">
        <X size={11} aria-hidden="true" /> Skipped
      </span>
    );
  }
  return (
    <span className="text-[10px] font-bold uppercase tracking-eyebrow-md font-mono text-white/45">
      — Pending
    </span>
  );
}

export default function SuggestionBoard({ board, loading, myName, refreshSeconds = 12 }) {
  const me = String(myName || '').trim().toLowerCase();
  const groups = Array.isArray(board) ? board : [];
  const totalPicks = groups.reduce((n, g) => n + (g.slots?.length || 0), 0);
  const inCount = groups.reduce(
    (n, g) => n + (g.slots || []).filter((s) => s.status === 'in').length,
    0
  );

  return (
    <div className="border border-white/8 bg-zinc-card/40 flex flex-col max-h-[70vh]">
      <div className="px-4 py-3 border-b border-white/8">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-eyebrow-md font-mono">
          <Radio size={13} className="text-purple-bright" aria-hidden="true" />
          <span className="text-purple-bright">Suggestions so far</span>
          {groups.length > 0 && (
            <span className="ml-auto text-white/45 tabular-nums">
              {totalPicks} picks · {inCount} in
            </span>
          )}
        </div>
        <p className="text-[10px] font-mono text-white/35 mt-1">
          Refreshes every {refreshSeconds}s.
        </p>
      </div>

      <div className="overflow-y-auto [scrollbar-width:thin] flex-1">
        {loading && !groups.length ? (
          <p className="text-center text-white/45 py-10 text-[11px] font-bold tracking-eyebrow-lg uppercase font-mono">
            Loading…
          </p>
        ) : groups.length === 0 ? (
          <p className="text-center text-white/50 py-10 text-[12px] font-mono">
            No picks yet — be the first.
          </p>
        ) : (
          <ul className="divide-y divide-white/5">
            {groups.map((g, gi) => {
              const isMe = me && String(g.person || '').trim().toLowerCase() === me;
              return (
                <li
                  key={`${g.person}-${gi}`}
                  className={`px-4 py-2.5 ${isMe ? 'ring-1 ring-emerald-signal/40 bg-emerald-signal/[0.04]' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[11px] font-bold tracking-eyebrow-md uppercase text-purple-bright font-mono truncate">
                      {g.person}
                    </span>
                    {isMe && (
                      <span className="text-[9px] font-bold uppercase tracking-eyebrow-md font-mono text-emerald-signal border border-emerald-signal/40 px-1 leading-tight">
                        you
                      </span>
                    )}
                  </div>
                  <ul className="space-y-1">
                    {(g.slots || []).map((s, si) => (
                      <li key={si} className="flex items-center justify-between gap-2">
                        <span className="text-[13px] text-white-body truncate">{s.name}</span>
                        <StatusChip status={s.status} />
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- --watchAll=false --testPathPattern=SuggestionBoard`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/SuggestionBoard.js src/components/__tests__/SuggestionBoard.test.js
git commit -m "feat(hunt): public suggestion board panel component"
```

---

## Task 6: Wire board + polling + dropped message into HuntSuggestPage

**Files:**
- Modify: `src/pages/HuntSuggestPage.js`

Add board state + 12s polling (pause on hidden tab), refetch after submit, the two-column layout, and the dropped-games message in the success screen.

- [ ] **Step 1: Add imports + board state**

At the top of `src/pages/HuntSuggestPage.js`, add the board import:

```javascript
import SuggestionBoard from '../components/SuggestionBoard';
```

Add state near the other `useState` calls (after `sentCount`):

```javascript
  const [board, setBoard] = useState(null);
  const [boardLoading, setBoardLoading] = useState(true);
  const [dropped, setDropped] = useState([]); // games dropped as already-called on last submit
  const REFRESH_SECONDS = 12;
```

- [ ] **Step 2: Add the fetchBoard function + polling effect**

After the existing info-loading `useEffect`, add:

```javascript
  // Public board polling. Fetch on mount + every REFRESH_SECONDS; pause when the
  // tab is hidden; refetch once on return. Keep the last good board on a
  // transient error so the panel never blanks mid-hunt.
  useEffect(() => {
    if (!linkId) return;
    let alive = true;
    async function fetchBoard() {
      try {
        const r = await fetch(`/api/hunt-suggest/board?linkId=${encodeURIComponent(linkId)}`);
        const data = await r.json().catch(() => ({}));
        if (!alive || !r.ok) return;
        setBoard(Array.isArray(data.board) ? data.board : []);
      } catch {
        /* keep last good board */
      } finally {
        if (alive) setBoardLoading(false);
      }
    }
    fetchBoard();
    const id = setInterval(() => {
      if (!document.hidden) fetchBoard();
    }, REFRESH_SECONDS * 1000);
    const onVis = () => {
      if (!document.hidden) fetchBoard();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [linkId]);
```

Expose `fetchBoard` to the submit handler: the simplest approach is to lift `fetchBoard` out via a ref, OR re-fetch inline in `submit()` by calling the same endpoint. To keep it simple and avoid ref plumbing, in `submit()`'s success branch trigger a board refetch by calling a small standalone refetch. Implement a `refetchBoard` callback with `useCallback` that the effect ALSO uses:

Replace the effect above with this version that shares one `useCallback`:

```javascript
  const refetchBoard = useCallback(async () => {
    if (!linkId) return;
    try {
      const r = await fetch(`/api/hunt-suggest/board?linkId=${encodeURIComponent(linkId)}`);
      const data = await r.json().catch(() => ({}));
      if (!r.ok) return;
      setBoard(Array.isArray(data.board) ? data.board : []);
    } catch {
      /* keep last good board */
    } finally {
      setBoardLoading(false);
    }
  }, [linkId]);

  useEffect(() => {
    if (!linkId) return;
    refetchBoard();
    const id = setInterval(() => {
      if (!document.hidden) refetchBoard();
    }, REFRESH_SECONDS * 1000);
    const onVis = () => { if (!document.hidden) refetchBoard(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [linkId, refetchBoard]);
```

Add `useCallback` to the React import at the top:

```javascript
import { useEffect, useState, useCallback } from 'react';
```

- [ ] **Step 3: Capture `dropped` + refetch in submit success**

In `submit()`, the success branch currently does:

```javascript
      } else {
        setSentCount(count);
        setDone(true);
      }
```

Replace with (read `added`/`dropped` from the response, refetch the board):

```javascript
      } else {
        setSentCount(typeof data.added === 'number' ? data.added : count);
        setDropped(Array.isArray(data.dropped) ? data.dropped : []);
        setDone(true);
        refetchBoard();
      }
```

- [ ] **Step 4: Show the dropped message in the success screen**

In the `done ?` success block, find the "Sent N picks" paragraph. Below it, add a conditional dropped notice. Locate:

```javascript
                <p className="text-white/55 text-sm mt-1">
                  Sent {sentCount} {sentCount === 1 ? 'pick' : 'picks'} to{' '}
                  {info?.huntName}. Resubmit anytime to update them.
                </p>
```

Add immediately after that `</p>`:

```javascript
                {dropped.length > 0 && (
                  <p className="text-white/45 text-[12px] mt-1.5">
                    {sentCount === 0
                      ? 'All your picks were already called — try different games.'
                      : `Already called (skipped): ${dropped.join(', ')}.`}
                  </p>
                )}
```

Also handle the `sentCount === 0` empty-add case so the headline isn't a triumphant "Sent!" when nothing landed. Find the success headline:

```javascript
                <p className="font-black text-white-body text-lg">Sent!</p>
```

Replace with:

```javascript
                <p className="font-black text-white-body text-lg">
                  {sentCount === 0 ? 'Nothing new added' : 'Sent!'}
                </p>
```

- [ ] **Step 5: Two-column layout**

The page root is `<div className="min-h-screen ... flex items-center justify-center px-4 py-12">` wrapping `<div className="w-full max-w-lg border ...">` (the form card). Widen the outer container and place the board beside the card. Change the inner wrapper from a single card to a two-column grid on `lg`.

Replace the outer structure: change `max-w-lg` to a grid wrapper. Specifically, wrap the existing form card and a `<SuggestionBoard>` in a grid:

```javascript
    <div className="min-h-screen bg-zinc-broadcast text-white-body flex items-start justify-center px-4 py-12">
      <div className="w-full max-w-4xl grid lg:grid-cols-2 gap-4 items-start">
        {/* LEFT — existing form card (unchanged inner content) */}
        <div className="w-full border border-white/8 bg-zinc-card/40">
          {/* ...all the existing card content (header + px-5 py-6 block)... */}
        </div>
        {/* RIGHT — public board */}
        <SuggestionBoard
          board={board}
          loading={boardLoading}
          myName={name}
          refreshSeconds={REFRESH_SECONDS}
        />
      </div>
    </div>
```

IMPORTANT: keep ALL existing inner card content (the loading/error/closed/done/form states) exactly as-is inside the LEFT `<div>` — only the OUTER wrapper changes (max-w-lg → max-w-4xl grid, items-center → items-start so the columns top-align). On mobile (`< lg`) the grid is one column and the board naturally stacks below the form.

- [ ] **Step 6: Verify**

Run: `npm test -- --watchAll=false --testPathPattern="SuggestionBoard|suggestionBoard"`
Expected: PASS.

Run: `npm run build`
Expected: Compiled successfully (no new ESLint warnings — watch for an unused var if `boardLoading` or `dropped` is left unwired).

- [ ] **Step 7: Manual smoke (if running locally)**

`npm start`, open a valid `/hunt-suggest/:linkId`. Confirm: board panel shows beside the form (stacks on mobile), "Refreshes every 12s" disclaimer present, submitting shows your picks within 12s, your group gets the "you" highlight, and submitting an already-called game shows the "Already called (skipped): …" note. Check the `/api/hunt-suggest/board` network response contains NO `id`/`source`/`submittedAt`.

- [ ] **Step 8: Commit**

```bash
git add src/pages/HuntSuggestPage.js
git commit -m "feat(hunt): live suggestions board + dup message on submission page"
```

---

## Task 7: Final verification

- [ ] **Step 1: Full suite**

Run: `CI=true npm test -- --watchAll=false`
Expected: all pass (suggestionBoard + SuggestionBoard + all pre-existing).

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: Compiled successfully, no new ESLint warnings.

- [ ] **Step 3: Privacy spot-check (read the projection path)**

Confirm `projectBoard` is the ONLY thing serialized by `board.js` (no raw `hunt.suggestions` ever returned). Grep:

Run: `grep -n "suggestions" api/hunt-suggest/board.js`
Expected: only the `projectBoard(... hunt.suggestions ...)` line — the raw array is never put on the response.

- [ ] **Step 4: Commit any cleanup**

```bash
git add -A && git commit -m "chore(hunt): board + dedup verification" || echo "nothing to commit"
```

---

## Self-review notes (for the executor)
- **Spec coverage:** board endpoint → Task 2; projection/status map → Task 1; dup-block (symmetric, both paths) → Tasks 1,3,4; two-column layout + polling + disclaimer + you-highlight → Tasks 5,6; dropped message → Task 6; privacy (no field leak) → Task 1 test + Task 7 spot-check.
- **Shared implementation:** submit.js and roster/add.js both import `takenSlotSet`/`dedupeAgainstTaken` from the one tested helper — they cannot drift.
- **Naming consistency:** helper names (`toPublicStatus`, `projectBoard`, `normalizeSlotName`, `takenSlotSet`, `dedupeAgainstTaken`) identical across Tasks 1–4. Response fields (`added`, `dropped`, `replaced`) consistent between submit.js (Task 3) and the page (Task 6). `REFRESH_SECONDS`/`refreshSeconds` threaded consistently.
- **Returning-submitter self-collision:** handled via `excludePersonId` in `takenSlotSet`, tested in Task 1.
- **No new Firestore rules:** board.js reads via admin creds like info.js — confirmed in spec.
