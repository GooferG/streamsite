# Admin Community Hunts — Design

**Date:** 2026-05-29
**Status:** Approved (design)
**New files:** `api/admin/community-hunts.js`, `src/pages/AdminCommunityHuntsPage.js`
**Modified:** `src/App.js`, `src/components/AdminLayout.js`, `firestore.indexes.json`

## Goal

Give staff a backend view of the community's logged bonus hunts (the viewer
tracker hunts saved at `users/{twitchId}/hunts`). Show aggregate community
stats and a recent-hunts list with per-hunt drill-in, so the streamer can see
how the tracker is being used and surface biggest wins / best calls.

## Decisions (from brainstorming)

- **Access:** staff (owner + moderators), like Suggestions/Hunts.
- **Data access:** server endpoint using `firebase-admin` (not client
  collection-group). Matches the existing `/api/admin/*` pattern, avoids the
  naming collision with the top-level `hunts` (prediction rounds) collection,
  and keeps raw cross-user data off the client.
- **Layout:** community aggregate stat cards on top, recent completed-hunts list
  below with expand-to-detail.
- **Stats:** biggest wins / best calls highlights + per-hunt detail access.
- **Scale:** aggregate stats computed over the result set; hunt list capped to
  the most recent 200.

## Architecture

### Endpoint — `api/admin/community-hunts.js`

Follows the established admin-endpoint pattern (see `api/admin/users.js`):

```js
import { adminDb } from '../_lib/firebaseAdmin.js';
import { applyCors, requireAdmin } from '../_lib/verifyAuth.js';

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  // ... gather + aggregate, return { stats, hunts }
}
```

**Gathering hunts (collection-group + parent disambiguation):**

The viewer tracker hunts live at `users/{twitchId}/hunts/{huntId}`. The
top-level `hunts` collection (admin prediction rounds) is a *different* dataset
with the same leaf collection name. A `collectionGroup('hunts')` query matches
both, so we disambiguate by parent path — the exact technique already used in
`api/admin/users.js`:

```js
const snap = await adminDb
  .collectionGroup('hunts')
  .where('status', '==', 'completed')   // viewer hunts use status:'completed'
  .orderBy('completedAt', 'desc')
  .limit(200)
  .get();

const hunts = snap.docs
  .filter((doc) => doc.ref.parent.parent?.parent?.id === 'users') // users/{id}/hunts only
  .map((doc) => ({
    id: doc.id,
    ownerTwitchId: doc.ref.parent.parent.id,
    ...doc.data(),
  }));
```

Note: the prediction-rounds `hunts` use `status: 'open'|'locked'|'settled'`, so
the `status == 'completed'` filter already excludes them; the parent-path filter
is a belt-and-suspenders guard.

**Owner enrichment:** collect distinct `ownerTwitchId`s, batch-fetch their user
docs (`users/{id}`), map to `{ displayName, twitchName, profileImageUrl }`.
Small N (≤ number of hunts). Attach `owner` to each hunt.

**Aggregate stats** (computed server-side over the fetched set):
- `totalHunts` — count.
- `uniquePlayers` — distinct owners.
- `biggestWin` — highest single bonus `win` across all hunts, with
  `{ amount, x, slot, caller, owner, huntName }`.
- `bestCallX` — highest single bonus X (win/stake), with the same context.
- `topHuntsByProfit` — top 5 hunts by `finishBalance - startBalance`, with
  `{ huntName, owner, profit }`.

Stat helpers (`computeStats`-equivalent reductions) are reimplemented inline in
the endpoint (server can't import `src/utils`). Logic mirrors
`src/utils/huntCalc.js`; kept simple (a few reduces). This is acceptable
duplication — the alternative (sharing a module across `src` and `api`) is a
larger restructure not justified here.

**Response shape:**

```js
{
  stats: { totalHunts, uniquePlayers, biggestWin, bestCallX, topHuntsByProfit },
  hunts: [
    { id, ownerTwitchId, owner: { displayName, ... }, name, startBalance,
      finishBalance, completedAt, bonuses: [...], gamblers: [...] },
    ...
  ],
}
```

Hunts include full `bonuses`/`gamblers` so the client can render per-hunt detail
without a second request (200-cap keeps payload bounded).

### Firestore index

The `collectionGroup('hunts')` query with `where status` + `orderBy completedAt`
needs a composite index. Add to `firestore.indexes.json`:

```json
{
  "collectionGroup": "hunts",
  "queryScope": "COLLECTION_GROUP",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "completedAt", "order": "DESCENDING" }
  ]
}
```

Deploy with `firebase deploy --only firestore:indexes --project goofer-website`.
(If the index is missing, the endpoint errors with a console link to create it.)

No `firestore.rules` change — `firebase-admin` bypasses rules.

### Client — `src/pages/AdminCommunityHuntsPage.js`

- Fetches once via `authedFetch('/api/admin/community-hunts')` on mount.
- **Header:** module eyebrow (matches other admin pages), title "Community
  hunts".
- **Stat cards:** total hunts, unique players, biggest win (amount · slot ·
  owner), best call (X · slot · caller · owner).
- **Recent hunts list:** rows of `owner · hunt name · date · profit · #bonuses`.
  Click a row → expand to read-only detail: bonus list (super/5-scat/caller
  markers), squad split, and per-hunt caller stats. Detail rendering reuses the
  visual shapes from `src/components/HuntHistory.js` (caller markers, split
  table) — extracted to shared presentational pieces if cleanly reusable, else
  duplicated minimally.
- Loading + error + empty states (no hunts yet) in the admin register.

### Routing & nav

- `src/App.js`: `<Route path="community-hunts" element={<AdminCommunityHuntsPage />} />`
  under the `/admin` `AdminLayout` outlet.
- `src/components/AdminLayout.js`: nav entry
  `{ to: '/admin/community-hunts', label: 'Community Hunts', code: 'CHT', icon: <icon> }`
  — staff-visible (no `ownerOnly`). Distinct from the existing `/admin/hunts`
  (prediction rounds).

## Dev vs prod

`src/setupProxy.js` does NOT mirror `/api/admin/*` (confirmed) — those endpoints
only run in production or under `vercel dev`. So this page's data won't load
under plain `npm start`. Testing requires `vercel dev` or a deploy. No dev-mirror
work needed. (Noted so the implementer isn't surprised by an empty page in dev.)

## Edge Cases

- No completed hunts yet → endpoint returns empty list + zeroed stats; page
  shows empty state.
- Hunt with no bonuses/gamblers → still listed; stats skip it where it has no
  data (biggest win ignores hunts with no wins).
- Owner user doc missing/deleted → fall back to showing the raw twitchId.
- `completedAt` is a Firestore Timestamp from admin SDK → serialize to ms/ISO in
  the response so the client formats it without Timestamp methods.
- 200-cap: aggregate stats reflect the capped set (most recent 200). Acceptable
  for a dashboard; note in the UI if the cap is hit ("showing latest 200").

## Out of Scope (v1)

- Pagination beyond the 200 cap / infinite scroll.
- All-time cross-community caller leaderboard (biggest-wins/best-calls only for
  now).
- Editing or deleting viewer hunts from admin (read-only view).
- CSV export.

## Files

- `api/admin/community-hunts.js` — **new.** Endpoint (gather + aggregate).
- `src/pages/AdminCommunityHuntsPage.js` — **new.** Admin page.
- `src/App.js` — add route.
- `src/components/AdminLayout.js` — add nav entry.
- `firestore.indexes.json` — add collection-group index for `hunts`.
