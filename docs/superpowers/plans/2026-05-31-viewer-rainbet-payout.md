# Viewer Rainbet Payout Handle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in viewer save a Rainbet username on `/me` so the host can see where to send their payout when a bonus hunt ends.

**Architecture:** A new `payoutProfile.rainbetUsername` field on `users/{uid}`, written through a new server endpoint `/api/me/payout-profile` (cloned from the existing `slot-profile.js` pattern, since the user doc is server-only write). A new card on `MyAccountPage` saves it. The handle is added to `/api/roster/search` results and shown in the host's roster-picker row in `SuggestionsPanel`. No Firestore rules change; the existing `users/{uid}` self+staff read covers it.

**Tech Stack:** React 19, Vercel serverless functions (`firebase-admin`), Firestore, Tailwind. No test harness for API/page code in this repo — verification is manual, matching the `slot-profile` / `roster` precedent.

**Spec:** `docs/superpowers/specs/2026-05-31-viewer-rainbet-payout-design.md`

---

## File Structure

- **Create** `api/me/payout-profile.js` — sole write path for a viewer's Rainbet handle. POST-only, Bearer auth, writes `users/{uid}.payoutProfile`.
- **Modify** `src/pages/MyAccountPage.js` — add a `PayoutProfileCard` component and mount it next to `SlotProfileCard`.
- **Modify** `api/roster/search.js` — include `rainbetUsername` in each result object.
- **Modify** `src/components/SuggestionsPanel.js` — render the handle (or a hint) in the roster result row.

Each change is self-contained. The endpoint must land before the card is useful, and the search field must land before the row can show it — but each commits independently and leaves the app working.

---

## Task 1: Create the `/api/me/payout-profile` endpoint

**Files:**
- Create: `api/me/payout-profile.js`

This is the only path a viewer has to persist their handle (the user doc is `write: false` in `firestore.rules`). It mirrors `api/me/slot-profile.js` but writes a different field and does **not** compute `twitchNameLower` (that key belongs to `slotProfile` and is maintained by the slots save; roster search reads it from there).

- [ ] **Step 1: Write the endpoint**

Create `api/me/payout-profile.js` with exactly this content:

```js
import { adminDb, FieldValue } from '../_lib/firebaseAdmin.js';
import { applyCors, requireAuth } from '../_lib/verifyAuth.js';

// Viewer saves their own Rainbet payout handle onto users/{uid}.payoutProfile.
// users/{uid} is server-only write (firestore.rules), so this endpoint is the
// sole path for a viewer to persist it. Host reads it (self+staff read rule)
// via /api/roster/search. Host is read-only — there is no staff write path.
//
// POST { rainbetUsername: string }
//   Authorization: Bearer <Firebase ID token>
//
// An empty/blank username is allowed and clears the stored handle.

const MAX_LEN = 50;

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const decoded = await requireAuth(req, res);
  if (!decoded) return;
  const uid = decoded.uid;

  const { rainbetUsername } = req.body || {};
  const clean = String(rainbetUsername || '').trim().slice(0, MAX_LEN);

  const userRef = adminDb.collection('users').doc(uid);

  try {
    const snap = await userRef.get();
    if (!snap.exists) return res.status(404).json({ error: 'USER_NOT_FOUND' });

    await userRef.set(
      {
        payoutProfile: {
          rainbetUsername: clean,
          updatedAt: FieldValue.serverTimestamp(),
        },
      },
      { merge: true }
    );

    return res.status(200).json({ ok: true, rainbetUsername: clean });
  } catch (err) {
    console.error('me/payout-profile error', err);
    return res.status(500).json({ error: 'INTERNAL' });
  }
}
```

- [ ] **Step 2: Verify the import surface matches the sibling endpoint**

Run: `node --check api/me/payout-profile.js`
Expected: no output (syntax OK). The imports (`adminDb`, `FieldValue` from `../_lib/firebaseAdmin.js`; `applyCors`, `requireAuth` from `../_lib/verifyAuth.js`) are the exact ones `api/me/slot-profile.js` uses — confirm by eye against that file.

- [ ] **Step 3: Commit**

```bash
git add api/me/payout-profile.js
git commit -m "feat: add /api/me/payout-profile endpoint for viewer Rainbet handle"
```

---

## Task 2: Add the PayoutProfileCard to MyAccountPage

**Files:**
- Modify: `src/pages/MyAccountPage.js`

Add a card component modeled on `SlotProfileCard` (same file, lines ~144-250) with its save/saved/error states, then mount it right after `<SlotProfileCard … />`.

- [ ] **Step 1: Add a `Wallet` icon to the lucide import**

In the import block at the top of `src/pages/MyAccountPage.js` (the `from 'lucide-react'` group, currently ending with `ListPlus,`), add `Wallet,`:

```js
import {
  Ticket,
  Gift,
  Clock,
  ArrowDownRight,
  ArrowUpRight,
  Sparkles,
  AlertCircle,
  Link2,
  CheckCircle2,
  ListChecks,
  ListPlus,
  Wallet,
} from 'lucide-react';
```

- [ ] **Step 2: Add the `PayoutProfileCard` component**

Insert this component definition immediately **after** the closing brace of `SlotProfileCard` (just before the `const REASON_LABELS = {` line):

```jsx
function PayoutProfileCard({ user }) {
  const initial = user?.payoutProfile?.rainbetUsername || '';
  const [rainbet, setRainbet] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  const [error, setError] = useState(null);

  async function save() {
    setSaving(true);
    setError(null);
    const rainbetUsername = rainbet.trim();
    try {
      const res = await authedFetch('/api/me/payout-profile', {
        method: 'POST',
        body: JSON.stringify({ rainbetUsername }),
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
          <Wallet size={11} aria-hidden="true" />
          <span>Rainbet payout</span>
        </span>
      </div>
      <div className="px-5 py-5 space-y-4">
        <p className="text-sm text-white/65">
          Save your Rainbet username so the host knows where to send your cut
          when a hunt pays out.
        </p>

        <input
          type="text"
          value={rainbet}
          onChange={(e) => setRainbet(e.target.value)}
          placeholder="Rainbet username"
          maxLength={50}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className={inputCls}
        />

        {error && <p className="text-red-destructive text-sm">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150 disabled:opacity-40"
          >
            <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
              {saving ? 'Saving…' : 'Save Rainbet'}
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

- [ ] **Step 3: Mount the card after the slots card**

Find this line in the JSX (around line 473):

```jsx
        <SlotProfileCard key={user?.slotProfile ? 'loaded' : 'empty'} user={user} />
```

Add the payout card right after it. The `key` re-inits local state once `useUserDoc` streams the doc in (same reason as the slots card):

```jsx
        <SlotProfileCard key={user?.slotProfile ? 'loaded' : 'empty'} user={user} />

        {/* key re-inits the card's local state once the user doc streams in. */}
        <PayoutProfileCard key={user?.payoutProfile ? 'payout-loaded' : 'payout-empty'} user={user} />
```

- [ ] **Step 4: Verify it builds and renders**

Run: `npm start`
Then:
1. Sign in with Twitch, open `/me`.
2. Confirm a "Rainbet payout" card appears below "Default slots".
3. Type a username, click **Save Rainbet** → "Saved" appears.
4. Reload the page → the value is still in the field (read back from `useUserDoc`).
5. Clear the field, Save → reload → field is empty (empty save clears it).

Expected: all five hold. (Requires `vercel dev` or a deployed endpoint for the POST to succeed, since `/api/me/*` only runs under Vercel — `npm start`'s `setupProxy.js` does not mirror it. If running plain `npm start`, the card renders and the field reads correctly from Firestore, but Save will network-error; verify Save against `vercel dev` or a preview deploy.)

- [ ] **Step 5: Commit**

```bash
git add src/pages/MyAccountPage.js
git commit -m "feat: Rainbet payout card on /me account page"
```

---

## Task 3: Include the handle in roster search results

**Files:**
- Modify: `api/roster/search.js`

The host's roster picker calls this endpoint. Add the handle to each result so the row can display it.

- [ ] **Step 1: Add `rainbetUsername` to the result mapper**

In `api/roster/search.js`, find the result-mapping block (around lines 34-45). Add one field to the returned object:

```js
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
          rainbetUsername: data.payoutProfile?.rainbetUsername || '',
        };
      })
      // A discoverable profile with no slots has nothing to add — hide it.
      .filter((r) => r.defaultSlots.length > 0);
```

The query and the `defaultSlots.length > 0` filter are unchanged (per spec: visibility stays as-is).

- [ ] **Step 2: Verify syntax**

Run: `node --check api/roster/search.js`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add api/roster/search.js
git commit -m "feat: return Rainbet handle from roster search"
```

---

## Task 4: Show the handle in the roster picker row

**Files:**
- Modify: `src/components/SuggestionsPanel.js`

Render the handle under the name + slots in each roster result row. When absent, show a subtle hint so the host isn't left guessing.

- [ ] **Step 1: Add the handle line to the result row**

In `src/components/SuggestionsPanel.js`, find the roster result `<li>` (around lines 170-186). The inner `<div className="min-w-0">` currently holds the name and the comma-joined slots. Add a third line below the slots:

```jsx
            <li key={v.twitchId} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm text-white-body truncate">{v.twitchName}</p>
                <p className="text-xs text-white/40 truncate">{v.defaultSlots.join(', ')}</p>
                {v.rainbetUsername ? (
                  <p className="text-[10px] font-mono tracking-eyebrow-md uppercase text-emerald-signal/80 truncate mt-0.5">
                    Rainbet: {v.rainbetUsername}
                  </p>
                ) : (
                  <p className="text-[10px] font-mono tracking-eyebrow-md uppercase text-white/30 truncate mt-0.5">
                    No Rainbet set
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => add(v)}
                disabled={busy}
                className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150 disabled:opacity-40"
              >
                <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
                  Add
                </span>
              </button>
            </li>
```

- [ ] **Step 2: Verify the host sees it**

Run: `npm start` (with `vercel dev` or a preview deploy backing `/api/roster/*`).
Then, signed in as the host with an active hunt:
1. Open the panel with the "Add a registered viewer" search.
2. Search for a viewer who is discoverable, has ≥1 default slot, and saved a Rainbet handle (set one via Task 2 first).
3. Confirm the row shows `Rainbet: <handle>` under the slots.
4. Search for a discoverable viewer with slots but no handle → row shows "No Rainbet set".

Expected: both hold.

- [ ] **Step 3: Commit**

```bash
git add src/components/SuggestionsPanel.js
git commit -m "feat: show viewer Rainbet handle in roster picker row"
```

---

## Final verification

- [ ] **Step 1: Confirm the PNG export is untouched**

Run: `git diff --name-only main` (or review the four commits).
Expected: only `api/me/payout-profile.js`, `src/pages/MyAccountPage.js`, `api/roster/search.js`, `src/components/SuggestionsPanel.js` changed. `src/utils/huntExport.js` is **not** in the list — the handle never reaches the exported image (spec requirement).

- [ ] **Step 2: Confirm no Firestore rules change was needed**

Run: `git status`
Expected: `firestore.rules` is unmodified. The `users/{uid}` self+staff read already covers the host reading the handle; writes go through the server endpoint.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds with no new ESLint errors (CRA fails the build on lint errors).
