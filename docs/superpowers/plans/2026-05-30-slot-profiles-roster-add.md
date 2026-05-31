# Slot Profiles + Host Roster-Add Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let logged-in Twitch viewers save default slots on `/me` (opt-in), and let a hunt host search opted-in viewers by name and drop their defaults into the live hunt's suggestion list.

**Architecture:** Default slots + opt-in flag live under a `slotProfile` field on the existing server-only `users/{twitchId}` doc. Three `firebase-admin` API endpoints handle save (`/api/me/slot-profile`), search (`/api/roster/search`), and add (`/api/roster/add`). Added picks land in the hunt's existing `suggestions[]` array tagged `source:'roster'` and ride the unchanged "Got in → bonus" pipeline. A "Default slots" card on `/me` and a roster search block in `HuntTracker` are the two UI surfaces.

**Tech Stack:** React 19, Vercel serverless functions (`api/*`), Firebase Admin SDK (Firestore), Tailwind. No new dependencies.

**Reference spec:** [docs/superpowers/specs/2026-05-30-slot-profiles-roster-add-design.md](../specs/2026-05-30-slot-profiles-roster-add-design.md)

---

## Conventions for this plan

- This project has **no API-layer test harness** (Jest exists for a few `src/**` units only; `/api/*` functions are tested by exercising the running app). API endpoints in this plan are verified by **reading the code back and a manual curl/console check**, not automated tests — matching how `api/me/claim-daily.js` and `api/hunt-suggest/*` are validated today. Each API task ends in a build/lint gate + commit.
- Shared constants reused across endpoints: `MAX_SLOTS = 6`, `MAX_SLOT_LEN = 80`, `MAX_PEOPLE = 300` (already defined in `api/hunt-suggest/submit.js:11-14`). Re-declare them locally in each new file — the existing code does not export them, and the codebase favors small self-contained handlers over a shared constants module.
- All new endpoints follow the exact handler shape in `api/me/claim-daily.js`: `applyCors(res)` → `OPTIONS` early return → method guard → `requireAuth`/transaction → coded JSON errors.
- The signed-in viewer's display name is available server-side as `decoded.twitchName` (set as a custom-token claim in `api/twitch-auth.js:72`). Fall back to the stored `users/{uid}.displayName` only if the claim is absent.

---

## File Structure

**Create:**
- `api/me/slot-profile.js` — viewer saves own `defaultSlots` + `discoverable`.
- `api/roster/search.js` — host searches discoverable profiles by name prefix.
- `api/roster/add.js` — host adds a viewer's defaults into their active hunt.

**Modify:**
- `firestore.indexes.json` — add the `users` composite index.
- `src/setupProxy.js` — mirror `/api/me/*` and `/api/roster/*` to the deployed functions for `npm start`.
- `src/pages/MyAccountPage.js` — add the "Default slots" card.
- `src/components/HuntTracker.js` — add the roster search block.

---

## Task 1: Firestore composite index for roster search

**Files:**
- Modify: `firestore.indexes.json`

The search endpoint queries `users` by `slotProfile.discoverable == true` plus a range on `slotProfile.twitchNameLower`. That two-field query requires a composite index. Add it first so it can be deploying while the rest is built.

- [ ] **Step 1: Add the index to the `indexes` array**

In `firestore.indexes.json`, add this object as a new entry in the top-level `"indexes"` array (after the existing `hunts` COLLECTION_GROUP entry, before the closing `]` of `indexes`):

```json
{
  "collectionGroup": "users",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "slotProfile.discoverable", "order": "ASCENDING" },
    { "fieldPath": "slotProfile.twitchNameLower", "order": "ASCENDING" }
  ]
}
```

Remember to add a comma after the preceding entry's closing `}` so the JSON stays valid.

- [ ] **Step 2: Validate the JSON parses**

Run: `node -e "JSON.parse(require('fs').readFileSync('firestore.indexes.json','utf8')); console.log('valid')"`
Expected: prints `valid` (no SyntaxError).

- [ ] **Step 3: Commit**

```bash
git add firestore.indexes.json
git commit -m "feat: add users composite index for roster search"
```

> **Deploy note (manual, not a code step):** the index must be deployed before `/api/roster/search` returns results in production:
> `firebase deploy --only firestore:indexes --project goofer-website`
> (No `.firebaserc` in repo — `--project` is required.) Building can proceed before this; search just errors until the index finishes building.

---

## Task 2: `/api/me/slot-profile` — viewer saves their profile

**Files:**
- Create: `api/me/slot-profile.js`

Writes `slotProfile` onto the caller's own `users/{uid}` doc. `users` is server-only write (`firestore.rules:60`), so this endpoint is the only way a viewer persists their profile. `twitchNameLower` is derived server-side from the verified token (never client input) so a viewer can't make themselves searchable under another name.

- [ ] **Step 1: Create the file**

Create `api/me/slot-profile.js`:

```js
import { adminDb, FieldValue } from '../_lib/firebaseAdmin.js';
import { applyCors, requireAuth } from '../_lib/verifyAuth.js';

// Viewer saves their own default-slots profile onto users/{uid}.slotProfile.
// users/{uid} is server-only write (firestore.rules), so this endpoint is the
// sole path for a viewer to persist defaults + the discoverable opt-in.
//
// POST { defaultSlots: string[], discoverable: boolean }
//   Authorization: Bearer <Firebase ID token>

const MAX_SLOTS = 6;
const MAX_SLOT_LEN = 80;

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const decoded = await requireAuth(req, res);
  if (!decoded) return;
  const uid = decoded.uid;

  const { defaultSlots, discoverable } = req.body || {};

  const cleanSlots = (Array.isArray(defaultSlots) ? defaultSlots : [])
    .map((s) => String(s || '').trim().slice(0, MAX_SLOT_LEN))
    .filter(Boolean)
    .slice(0, MAX_SLOTS);

  const userRef = adminDb.collection('users').doc(uid);

  try {
    const snap = await userRef.get();
    if (!snap.exists) return res.status(404).json({ error: 'USER_NOT_FOUND' });

    // Search key: lowercased display name. Prefer the token claim; fall back to
    // the stored profile name. Never trust a client-supplied name here.
    const displayName =
      decoded.twitchName || snap.data()?.displayName || snap.data()?.twitchName || '';
    const twitchNameLower = String(displayName).toLowerCase();

    await userRef.set(
      {
        slotProfile: {
          defaultSlots: cleanSlots,
          discoverable: Boolean(discoverable),
          twitchNameLower,
          updatedAt: FieldValue.serverTimestamp(),
        },
      },
      { merge: true }
    );

    return res.status(200).json({ ok: true, defaultSlots: cleanSlots });
  } catch (err) {
    console.error('me/slot-profile error', err);
    return res.status(500).json({ error: 'INTERNAL' });
  }
}
```

- [ ] **Step 2: Lint/build gate**

Run: `npx eslint api/me/slot-profile.js`
Expected: no errors. (If eslint isn't configured for `api/`, run `npm run build` instead and confirm it compiles — the file is plain ESM and won't be bundled by CRA, so a syntax check via `node --check api/me/slot-profile.js` is the reliable gate.)

Run: `node --check api/me/slot-profile.js`
Expected: exits 0, no output.

- [ ] **Step 3: Commit**

```bash
git add api/me/slot-profile.js
git commit -m "feat: add /api/me/slot-profile endpoint"
```

---

## Task 3: `/api/roster/add` — host adds a viewer's defaults

**Files:**
- Create: `api/roster/add.js`

Build `add` before `search` so the merge-by-name transaction (the riskiest logic) is locked in first; `search` only feeds it a `twitchId`. Mirrors the transaction in `api/hunt-suggest/submit.js:62-103`.

- [ ] **Step 1: Create the file**

Create `api/roster/add.js`:

```js
import crypto from 'crypto';
import { adminDb } from '../_lib/firebaseAdmin.js';
import { applyCors, requireAuth } from '../_lib/verifyAuth.js';

// Host adds a registered viewer's default slots into the host's own active
// hunt. Auth = the host (any signed-in user). The target viewer must have an
// opted-in (discoverable) slot profile with at least one default slot.
//
// Merge-by-name: if a suggestions[] entry with the same lowercased name already
// exists (any source), only slots not already present are appended; existing
// slot statuses are left untouched and no duplicate person row is created.
//
// POST { twitchId }   Authorization: Bearer <Firebase ID token>

const MAX_PEOPLE = 300;

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const decoded = await requireAuth(req, res);
  if (!decoded) return;
  const hostUid = decoded.uid;

  const { twitchId } = req.body || {};
  if (!twitchId || typeof twitchId !== 'string') {
    return res.status(400).json({ error: 'MISSING_TWITCH_ID' });
  }

  try {
    const profileSnap = await adminDb.collection('users').doc(twitchId).get();
    if (!profileSnap.exists) return res.status(404).json({ error: 'NOT_FOUND' });
    const profileData = profileSnap.data();
    const sp = profileData?.slotProfile;
    if (!sp || sp.discoverable !== true) return res.status(403).json({ error: 'NOT_DISCOVERABLE' });
    const defaultSlots = Array.isArray(sp.defaultSlots) ? sp.defaultSlots.filter(Boolean) : [];
    if (!defaultSlots.length) return res.status(409).json({ error: 'NO_DEFAULTS' });

    const personName = profileData.displayName || profileData.twitchName || 'Viewer';
    const activeRef = adminDb.doc(`users/${hostUid}/active_hunt/current`);

    const result = await adminDb.runTransaction(async (tx) => {
      const activeSnap = await tx.get(activeRef);
      if (!activeSnap.exists) throw new Error('NO_ACTIVE_HUNT');
      const hunt = activeSnap.data();
      const suggestions = Array.isArray(hunt.suggestions) ? hunt.suggestions : [];

      const key = personName.toLowerCase();
      const existingIdx = suggestions.findIndex(
        (p) => String(p.person || '').toLowerCase() === key
      );

      if (existingIdx === -1 && suggestions.length >= MAX_PEOPLE) {
        throw new Error('LIST_FULL');
      }

      let addedCount = 0;
      let next;
      if (existingIdx !== -1) {
        // Merge: append only slots whose name isn't already on this entry.
        const entry = suggestions[existingIdx];
        const have = new Set(
          (Array.isArray(entry.slots) ? entry.slots : []).map((s) =>
            String(s.name || '').toLowerCase()
          )
        );
        const newSlots = defaultSlots
          .filter((nm) => !have.has(String(nm).toLowerCase()))
          .map((nm) => ({ id: crypto.randomUUID(), name: nm, status: 'open' }));
        addedCount = newSlots.length;
        const merged = {
          ...entry,
          slots: [...(Array.isArray(entry.slots) ? entry.slots : []), ...newSlots],
        };
        next = suggestions.map((p, i) => (i === existingIdx ? merged : p));
      } else {
        const slotObjs = defaultSlots.map((nm) => ({
          id: crypto.randomUUID(),
          name: nm,
          status: 'open',
        }));
        addedCount = slotObjs.length;
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
    });

    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    const code = err.message;
    if (code === 'NO_ACTIVE_HUNT') return res.status(409).json({ error: 'NO_ACTIVE_HUNT' });
    if (code === 'LIST_FULL') return res.status(409).json({ error: 'LIST_FULL' });
    console.error('roster/add error', err);
    return res.status(500).json({ error: 'INTERNAL' });
  }
}
```

- [ ] **Step 2: Syntax check**

Run: `node --check api/roster/add.js`
Expected: exits 0, no output.

- [ ] **Step 3: Commit**

```bash
git add api/roster/add.js
git commit -m "feat: add /api/roster/add endpoint with merge-by-name"
```

---

## Task 4: `/api/roster/search` — host searches discoverable profiles

**Files:**
- Create: `api/roster/search.js`

- [ ] **Step 1: Create the file**

Create `api/roster/search.js`. The prefix range uses the high-codepoint sentinel `\uf8ff`, which sorts after any normal character — the standard Firestore prefix-query idiom:

```js
import { adminDb } from '../_lib/firebaseAdmin.js';
import { applyCors, requireAuth } from '../_lib/verifyAuth.js';

// Host searches opted-in viewers by display-name prefix. Returns viewers whose
// slotProfile.discoverable == true and whose twitchNameLower starts with q.
// Requires the users composite index (firestore.indexes.json).
//
// GET /api/roster/search?q=<prefix>   Authorization: Bearer <Firebase ID token>

const MAX_RESULTS = 10;

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const decoded = await requireAuth(req, res);
  if (!decoded) return;

  const q = String(req.query.q || '').trim().toLowerCase();
  if (!q) return res.status(200).json({ results: [] });

  try {
    const snap = await adminDb
      .collection('users')
      .where('slotProfile.discoverable', '==', true)
      .where('slotProfile.twitchNameLower', '>=', q)
      // '\uf8ff' is a very-high code point that sorts after any normal
      // character — the standard Firestore prefix-range upper bound.
      .where('slotProfile.twitchNameLower', '<', q + '\uf8ff')
      .limit(MAX_RESULTS)
      .get();

    const results = snap.docs
      .map((d) => {
        const data = d.data();
        const defaultSlots = Array.isArray(data.slotProfile?.defaultSlots)
          ? data.slotProfile.defaultSlots.filter(Boolean)
          : [];
        return {
          twitchId: d.id,
          twitchName: data.displayName || data.twitchName || 'Viewer',
          defaultSlots,
        };
      })
      // A discoverable profile with no slots has nothing to add — hide it.
      .filter((r) => r.defaultSlots.length > 0);

    return res.status(200).json({ results });
  } catch (err) {
    console.error('roster/search error', err);
    return res.status(500).json({ error: 'INTERNAL' });
  }
}
```

- [ ] **Step 2: Syntax check**

Run: `node --check api/roster/search.js`
Expected: exits 0, no output.

- [ ] **Step 3: Commit**

```bash
git add api/roster/search.js
git commit -m "feat: add /api/roster/search endpoint"
```

---

## Task 5: Dev proxy mirrors for the new endpoints

**Files:**
- Modify: `src/setupProxy.js`

`firebase-admin` can't run in the CRA dev server, so `npm start` must proxy the new endpoints to the deployed functions — exactly how `/api/hunt-suggest` already does (`src/setupProxy.js:99-107`).

- [ ] **Step 1: Add proxy blocks**

In `src/setupProxy.js`, immediately after the existing `/api/hunt-suggest` `app.use(...)` block (ends at the line with `);` before the final `};`), add:

```js
  // /api/me/* and /api/roster/* also need Firebase admin — proxy them to the
  // deployed functions so the slot-profile + roster UI work under `npm start`.
  app.use(
    '/api/me',
    createProxyMiddleware({
      target: HUNT_SUGGEST_TARGET,
      changeOrigin: true,
      secure: true,
      pathRewrite: { '^/api/me': '/api/me' },
    })
  );
  app.use(
    '/api/roster',
    createProxyMiddleware({
      target: HUNT_SUGGEST_TARGET,
      changeOrigin: true,
      secure: true,
      pathRewrite: { '^/api/roster': '/api/roster' },
    })
  );
```

> Note: `HUNT_SUGGEST_TARGET` is already defined at the top of the file (`src/setupProxy.js:13`); reuse it. The `/api/me/claim-daily` route is the only existing `/api/me/*` consumer and it currently has no dev mirror, so adding this `/api/me` proxy also fixes daily-claim under `npm start` — intended and harmless.

- [ ] **Step 2: Syntax check**

Run: `node --check src/setupProxy.js`
Expected: exits 0, no output.

- [ ] **Step 3: Commit**

```bash
git add src/setupProxy.js
git commit -m "chore: dev-proxy mirrors for /api/me and /api/roster"
```

---

## Task 6: "Default slots" card on `/me`

**Files:**
- Modify: `src/pages/MyAccountPage.js`

Add a card letting the viewer edit their default slots + opt-in. Reads current values from the live `user` doc (already subscribed via `useUserDoc`), saves via `/api/me/slot-profile`.

- [ ] **Step 1: Add imports**

In `src/pages/MyAccountPage.js`, add `ListPlus` and `Check` to the existing `lucide-react` import (the import block at lines 10-21), and add a `SlotAutocomplete` import after the existing imports (after line 25, `import { authedFetch } ...`):

```js
import SlotAutocomplete from '../components/SlotAutocomplete';
```

Within the `lucide-react` import list, add `ListPlus` (used for the card eyebrow). `Check` is already imported via `CheckCircle2`; use `CheckCircle2` to avoid a duplicate.

- [ ] **Step 2: Add the `SlotProfileCard` component**

Add this component definition above `export default function MyAccountPage()` (e.g. after the `SuggestionRecord` component, around line 138). `MAX_SLOTS` mirrors the server cap:

```js
const MAX_SLOTS = 6;

function SlotProfileCard({ user }) {
  const initialSlots = Array.isArray(user?.slotProfile?.defaultSlots)
    ? user.slotProfile.defaultSlots
    : [];
  const initialDiscoverable = user?.slotProfile?.discoverable === true;

  const [slots, setSlots] = useState(() => {
    const padded = [...initialSlots];
    while (padded.length < MAX_SLOTS) padded.push('');
    return padded.slice(0, MAX_SLOTS);
  });
  const [discoverable, setDiscoverable] = useState(initialDiscoverable);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  const [error, setError] = useState(null);

  function setSlot(i, val) {
    setSlots((arr) => arr.map((s, idx) => (idx === i ? val : s)));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const defaultSlots = slots.map((s) => s.trim()).filter(Boolean);
    try {
      const res = await authedFetch('/api/me/slot-profile', {
        method: 'POST',
        body: JSON.stringify({ defaultSlots, discoverable }),
      });
      if (!res.ok) {
        setError('Could not save. Try again.');
      } else {
        setSavedAt(Date.now());
      }
    } catch {
      setError('Network error.');
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    'w-full bg-zinc-broadcast/60 border border-white/10 px-3 py-2.5 text-sm text-white-body placeholder:text-white/40 focus:border-emerald-signal/70 focus:outline-none transition-colors duration-150';

  return (
    <div className="border border-white/8 bg-zinc-card/30">
      <div className="px-4 py-2.5 border-b border-white/8 text-[10px] font-bold uppercase tracking-eyebrow-md font-mono">
        <span className="inline-flex items-center gap-2 text-emerald-signal">
          <ListPlus size={11} aria-hidden="true" />
          <span>Default slots</span>
        </span>
      </div>
      <div className="px-5 py-5 space-y-4">
        <p className="text-sm text-white/65">
          Save your go-to slots. When a host runs a bonus hunt, they can drop
          these into their list for you — even while you're away.
        </p>

        <div className="space-y-2">
          {slots.map((s, i) => (
            <SlotAutocomplete
              key={i}
              value={s}
              onChange={(v) => setSlot(i, v)}
              placeholder={`Slot ${i + 1}`}
              className={inputCls}
            />
          ))}
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={discoverable}
            onChange={(e) => setDiscoverable(e.target.checked)}
            className="w-4 h-4 accent-emerald-signal"
          />
          <span className="text-sm text-white/75">
            Let hunt hosts add my slots
          </span>
        </label>

        {error && (
          <p className="text-red-destructive text-sm">{error}</p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150 disabled:opacity-40"
          >
            <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
              {saving ? 'Saving…' : 'Save defaults'}
            </span>
          </button>
          {savedAt > 0 && !saving && !error && (
            <span className="inline-flex items-center gap-1.5 text-emerald-signal text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
              <CheckCircle2 size={12} aria-hidden="true" /> Saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Render the card**

In the returned JSX of `MyAccountPage`, add `<SlotProfileCard user={user} />` immediately after the existing `<SuggestionRecord user={user} />` line (currently line 357):

```jsx
        <SuggestionRecord user={user} />

        <SlotProfileCard user={user} />
```

- [ ] **Step 4: Build gate**

Run: `npm run build`
Expected: compiles with no errors (warnings about pre-existing unused vars are fine; no new errors referencing `MyAccountPage`, `SlotProfileCard`, `ListPlus`, or `SlotAutocomplete`).

- [ ] **Step 5: Commit**

```bash
git add src/pages/MyAccountPage.js
git commit -m "feat: default-slots profile card on /me"
```

---

## Task 7: Roster search block in HuntTracker

**Files:**
- Modify: `src/components/HuntTracker.js`

Add an owner-facing search box that finds opted-in viewers and adds their defaults to the active hunt. Placed near the existing intake-link controls.

- [ ] **Step 1: Confirm the insertion point and existing imports**

Read `src/components/HuntTracker.js` around the intake-link panel (search for `createIntakeLink` and the JSX that renders the intake controls, near line 490+ for the handler and the corresponding render block). Confirm `authedFetch` is already imported (it is — used by `createIntakeLink`) and that `useState`/`useRef` are imported from React (they are). The new block reuses both.

- [ ] **Step 2: Add roster search state + handlers**

Inside the `HuntTracker` component body, near the other intake-link state (e.g. alongside `linkBusy`/`linkError`), add:

```js
  const [rosterQuery, setRosterQuery] = useState('');
  const [rosterResults, setRosterResults] = useState([]);
  const [rosterBusy, setRosterBusy] = useState(false);
  const [rosterMsg, setRosterMsg] = useState(null);
  const rosterDebounceRef = useRef(null);

  function onRosterQueryChange(value) {
    setRosterQuery(value);
    setRosterMsg(null);
    if (rosterDebounceRef.current) clearTimeout(rosterDebounceRef.current);
    const q = value.trim();
    if (!q) {
      setRosterResults([]);
      return;
    }
    rosterDebounceRef.current = setTimeout(async () => {
      try {
        const r = await authedFetch(`/api/roster/search?q=${encodeURIComponent(q)}`);
        const data = await r.json().catch(() => ({}));
        setRosterResults(r.ok && Array.isArray(data.results) ? data.results : []);
      } catch {
        setRosterResults([]);
      }
    }, 250);
  }

  async function addFromRoster(viewer) {
    setRosterBusy(true);
    setRosterMsg(null);
    try {
      const r = await authedFetch('/api/roster/add', {
        method: 'POST',
        body: JSON.stringify({ twitchId: viewer.twitchId }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        const map = {
          NO_ACTIVE_HUNT: 'Start a hunt first.',
          LIST_FULL: 'The list is full.',
          NOT_FOUND: 'That viewer is no longer available.',
          NO_DEFAULTS: 'That viewer has no saved slots.',
          NOT_DISCOVERABLE: 'That viewer is no longer shared.',
        };
        setRosterMsg(map[data.error] || 'Could not add.');
      } else if (data.added === 0) {
        setRosterMsg(`${viewer.twitchName} is already on the list.`);
      } else {
        setRosterMsg(
          `Added ${data.added} slot${data.added === 1 ? '' : 's'} for ${viewer.twitchName}.`
        );
        setRosterQuery('');
        setRosterResults([]);
      }
    } catch {
      setRosterMsg('Could not add.');
    } finally {
      setRosterBusy(false);
    }
  }
```

- [ ] **Step 3: Render the search block**

In the JSX where the intake-link panel renders (the owner controls block), add this directly after the intake-link UI. Match the surrounding panel chrome already used in `HuntTracker`:

```jsx
          {/* Add a registered viewer's default slots */}
          <div className="space-y-2">
            <span className="block text-[10px] font-bold uppercase tracking-eyebrow-md text-white/65 font-mono">
              Add a registered viewer
            </span>
            <input
              type="text"
              value={rosterQuery}
              onChange={(e) => onRosterQueryChange(e.target.value)}
              placeholder="Search by name…"
              className="w-full bg-zinc-broadcast/60 border border-white/10 px-3 py-2.5 text-sm text-white-body placeholder:text-white/40 focus:border-emerald-signal/70 focus:outline-none transition-colors duration-150"
            />
            {rosterResults.length > 0 && (
              <ul className="border border-white/10 divide-y divide-white/8">
                {rosterResults.map((v) => (
                  <li
                    key={v.twitchId}
                    className="flex items-center justify-between gap-3 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-white-body truncate">{v.twitchName}</p>
                      <p className="text-xs text-white/40 truncate">
                        {v.defaultSlots.join(', ')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => addFromRoster(v)}
                      disabled={rosterBusy}
                      className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150 disabled:opacity-40"
                    >
                      <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
                        Add
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {rosterMsg && (
              <p className="text-[11px] tracking-eyebrow uppercase text-white/55 font-mono">
                {rosterMsg}
              </p>
            )}
          </div>
```

> The whole block lives inside the owner-only controls region (the same conditional that gates `createIntakeLink`/intake UI), so non-owners never see it. If the intake controls are wrapped in an owner check, place this block inside that wrapper.

- [ ] **Step 4: Build gate**

Run: `npm run build`
Expected: compiles with no errors referencing `HuntTracker`, `rosterQuery`, `addFromRoster`, or `onRosterQueryChange`.

- [ ] **Step 5: Commit**

```bash
git add src/components/HuntTracker.js
git commit -m "feat: roster search block in HuntTracker"
```

---

## Task 8: End-to-end manual verification

**Files:** none (verification only)

Automated coverage isn't available for these `firebase-admin` endpoints (see Conventions). Verify against a deployed build (`vercel dev` or a preview deploy) since the dev server proxies these endpoints to deployed functions.

- [ ] **Step 1: Deploy the index**

Run: `firebase deploy --only firestore:indexes --project goofer-website`
Expected: index build completes (may take a few minutes; check Firebase console → Firestore → Indexes for "Enabled").

- [ ] **Step 2: Save a profile as a viewer**

Log in as a Twitch viewer, go to `/me`, enter 3 slots in the "Default slots" card, tick "Let hunt hosts add my slots", click Save. Expected: "Saved" appears; reloading `/me` shows the slots persisted (confirms the write + the `useUserDoc` read round-trip).

- [ ] **Step 3: Confirm opt-out hides you**

Untick the toggle, Save. Expected: a subsequent host search (Step 5) for that name returns nothing.

- [ ] **Step 4: Re-opt-in for the remaining steps**

Re-tick the toggle and Save.

- [ ] **Step 5: Roster-add as a host**

As the host (any logged-in user) with an **active hunt** open in the tracker, type the viewer's name in "Add a registered viewer". Expected: the viewer appears with their slots listed. Click Add. Expected: "Added N slots for <name>"; the picks appear in the hunt's suggestion list (streamed via the existing `suggestions` snapshot).

- [ ] **Step 6: Merge-by-name**

With the same viewer already on the list (from Step 5), click Add again. Expected: "is already on the list" (added === 0). Then, on `/me`, add a 4th slot and Save; back on the host, search + Add again. Expected: "Added 1 slot" — only the new slot is appended, no duplicate person row.

- [ ] **Step 7: Got-in still works**

Click "Got in" on a roster-sourced suggestion, enter a stake, confirm. Expected: it becomes a bonus with `caller` = the viewer's name, and the suggestion is marked done — identical to a link submission (confirms `source:'roster'` rides the unchanged pipeline).

- [ ] **Step 8: No-active-hunt guard**

End the hunt, then attempt a roster Add. Expected: "Start a hunt first."

---

## Self-Review Notes

- **Spec coverage:** storage on `users.slotProfile` (T2), three endpoints (T2/T3/T4), composite index (T1), dev proxy (T5), `/me` card (T6), HuntTracker search (T7), merge-by-name + point-in-time + opt-out + no-active-hunt edge cases (T3 + T8). No rule change needed (spec: existing `users` rules suffice) — correctly absent from tasks.
- **Type consistency:** suggestion entry shape `{ id, person, slots:[{id,name,status}], source, submittedAt }` matches `api/hunt-suggest/submit.js`. `source:'roster'` consumed unchanged by `confirmLanding()` (reads only `person` + `slot.name`/`slot.id`). Search returns `{twitchId, twitchName, defaultSlots}`; `add` consumes `{twitchId}` — consistent across T4→T7→T3.
- **Display name:** `twitchName` in roster results = the user doc's `displayName` (human-facing), search key = `twitchNameLower` = lowercased displayName, written server-side in T2 and queried in T4 — consistent.
