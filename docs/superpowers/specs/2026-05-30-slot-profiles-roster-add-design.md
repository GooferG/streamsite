# Slot Profiles + Host Roster-Add â€” Design Spec

**Date:** 2026-05-30

## Overview

Logged-in Twitch viewers can save a short list of their default/favorite slots
once ("slot profile"). A hunt host, on the live hunt tracker, can search opted-in
viewers by name and add a viewer's default slots straight into the current hunt's
suggestion list â€” without that viewer being online or submitting via the
password link.

This realizes the request: *"I add Walker and he's in bed but he chose his base 3
slots â€” auto-add those to The List."* The host pulls from a registry of saved
favorites for any viewer who opted in.

The added picks flow through the existing suggestion pipeline unchanged: they land
in the hunt's `suggestions[]` array, the host hits "Got in" on each, and they
become real bonuses â€” identical to password-link submissions, just tagged
`source: 'roster'`.

---

## Decisions (resolved during brainstorming)

| Question | Decision |
| --- | --- |
| Whose identity backs a profile? | **Twitch-logged-in viewers** (existing `TwitchAuthContext`). No new auth. |
| How does the host add someone? | **Search box â†’ pick â†’ auto-add** on the HuntTracker screen. |
| Who is findable? | **Opt-in toggle.** Only viewers who set "let hosts add my slots" appear in search. |
| Where does the viewer edit their profile? | **A card on the existing `/me` MyAccountPage** (no new route). |
| Dedup when a same-name entry already exists? | **Merge by name** â€” roster add fills only missing slots, never clobbers an existing entry. |
| Does roster-add require the intake link to be open? | **No.** Independent of the link; host is authenticated on their own hunt. |
| Search backed by an index? | **Composite index** on `users` (discoverable + name prefix). |

---

## Storage

Default slots and the opt-in flag live on the **existing `users/{twitchId}`
document** under a `slotProfile` sub-object. No new collection â€” the doc is
already subscribed live on `/me` via `useUserDoc`, so the editor reads with zero
extra cost.

```
users/{twitchId}: {
  ...existing fields (tickets, totalEarned, stats, discordId, ...),
  slotProfile: {
    defaultSlots: string[],    // 1â€“6 slot names, trimmed, capped at MAX_SLOTS (6)
    discoverable: boolean,     // the opt-in toggle; default false
    twitchNameLower: string,   // lowercased display name â€” search key, set SERVER-SIDE
    updatedAt: Timestamp,
  }
}
```

- `twitchNameLower` is written **server-side from the verified Firebase token**,
  never from client input, so a viewer can't make themselves searchable under
  someone else's name.
- One profile per viewer (doc id = twitchId). Saving upserts the `slotProfile`
  field via `{ merge: true }`.

### Why not a separate `slot_profiles` collection?

The earlier draft proposed one. Rejected because the `users/{uid}` doc already
holds per-viewer profile state, is already subscribed on `/me`, and keeps reads
to one document. A separate collection would duplicate identity and add a read.

### Trust boundary â€” why writes go through the server

`firestore.rules` sets `users/{uid}` to **`allow write: if false`** (line 60):
the user doc is mutated only by API endpoints holding admin credentials (tickets,
stats, Discord link all work this way). Therefore the viewer **cannot** write
their own `slotProfile` directly from the client. Saving goes through a new
authenticated endpoint. Reads stay client-side and live: `isSelf(uid)` already
permits the viewer to read their own doc (line 59), which is how `useUserDoc`
already works.

---

## API endpoints

All are Vercel function handlers using `firebase-admin` (via the existing
`api/_lib/firebaseAdmin.js`) and `requireAuth` (via `api/_lib/verifyAuth.js`),
following the established `/api/me/*` and `/api/hunt-suggest/*` patterns.

### `POST /api/me/slot-profile`

Viewer saves their own profile. Auth: Firebase ID token (the caller).

- Body: `{ defaultSlots: string[], discoverable: boolean }`.
- Server validates: trims each slot, drops empties, caps at `MAX_SLOTS = 6`,
  each slot â‰¤ `MAX_SLOT_LEN = 80`. `discoverable` coerced to boolean.
- Server derives `twitchNameLower` from the token's name claim (falls back to a
  lookup of the existing user doc's stored Twitch name if the token lacks it).
- Writes `slotProfile` onto `users/{uid}` with `{ merge: true }` +
  `updatedAt: serverTimestamp()`.
- Returns `{ ok: true }`.

### `GET /api/roster/search?q=<prefix>`

Host searches opted-in viewers. Auth: Firebase ID token (any signed-in user;
this is the host).

- `q` trimmed, lowercased, min length 1, else return `{ results: [] }`.
- Query: `users where slotProfile.discoverable == true` and a standard
  Firestore prefix range on `slotProfile.twitchNameLower` (`>= q` and `< q`
  with a very-high-codepoint sentinel appended, which sorts after any normal
  character), `limit(10)`.
- Returns `{ results: [{ twitchId, twitchName, defaultSlots }] }`.
  Excludes profiles with an empty `defaultSlots` (nothing to add).
- **Requires the composite index below.**

### `POST /api/roster/add`

Host adds a viewer's defaults into their own active hunt. Auth: Firebase ID
token (the host).

- Body: `{ twitchId }` â€” the viewer whose defaults to add.
- Loads `users/{twitchId}`; requires `slotProfile.discoverable === true` and a
  non-empty `defaultSlots`, else `404 / 409`.
- Loads `users/{callerUid}/active_hunt/current`; if missing â†’ `409 NO_ACTIVE_HUNT`.
- Runs a Firestore transaction mirroring `api/hunt-suggest/submit.js`:
  - **Merge by name**: find an existing `suggestions[]` entry whose
    `person.toLowerCase()` equals the viewer's lowercased name (any `source`).
  - If found: append only slots whose name isn't already present in that entry;
    leave existing slot statuses untouched; don't create a second entry.
  - If not found and `suggestions.length < MAX_PEOPLE (300)`: push a new entry
    `{ id, person: twitchName, slots: [{id, name, status:'open'}], source:'roster', submittedAt }`.
  - If list full â†’ `409 LIST_FULL`.
- Returns `{ ok: true, added: <count of slots actually added>, merged: <bool> }`.

Error codes reuse the submit.js vocabulary where they overlap
(`NO_ACTIVE_HUNT â†’ HUNT_ENDED`, `LIST_FULL`, `NOT_FOUND`).

---

## Firestore rules

`users/{uid}` already allows `read: if isSelf(uid) || isStaff()` and
`write: if false`. **No rule change needed** â€” the viewer reads their own
`slotProfile` through the existing self-read; all writes (profile save, roster
search/add) go through admin-credential endpoints that bypass rules. The
server-only write posture is exactly what we want for cross-user reads during
search.

---

## Firestore index

Add one composite index to `firestore.indexes.json`:

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

Deploy once: `firebase deploy --only firestore:indexes --project goofer-website`.
(No `.firebaserc` in repo â€” pass `--project` explicitly, per project memory.)

---

## UI

### `/me` MyAccountPage â€” new "Default slots" card

Placed near the existing "Suggestion record" block (`SuggestionRecord`), matching
the card chrome already used on the page (`border border-white/8 bg-zinc-card/30`,
mono eyebrow header, emerald accent).

- Six `SlotAutocomplete` rows (the same component HuntSuggestPage uses) bound to
  `defaultSlots`.
- A toggle: **"Let hunt hosts add my slots"** â†’ `discoverable`.
- A **Save** button â†’ `POST /api/me/slot-profile`. Optimistic local state;
  the `useUserDoc` snapshot reconciles. Show a saving/saved/error affordance
  consistent with the page's existing patterns.
- First-visit empty state: one line explaining what saving defaults does
  ("Hosts running a bonus hunt can drop these into their list for you").
- The whole card only renders for the logged-in branch (the page already gates
  on `twitchUser`).

### HuntTracker â€” roster search block

Placed near the existing suggestion-intake-link panel (the owner-facing controls
around `createIntakeLink`).

- A labeled search input: "Add a registered viewer".
- On input (debounced ~250ms, min 1 char): `GET /api/roster/search?q=` â†’
  render up to 10 results, each showing `twitchName` + a preview of their
  default slots.
- Click a result â†’ `POST /api/roster/add { twitchId }`. On success the added
  picks appear via the existing `suggestions` snapshot (no new client state).
  Show a brief "added"/"merged"/"already on the list" affordance.
- Errors map to friendly text (`HUNT_ENDED`, `LIST_FULL`, network).
- Only rendered for the owner of the active hunt (same gate as the intake-link
  controls).

### Reused without change

- `SlotAutocomplete` â€” both surfaces.
- Merge-by-name logic â€” identical semantics to `submit.js`.
- `source: 'roster'` rides the existing `suggestions[]` â†’ "Got in" â†’
  `confirmLanding()` â†’ bonus path with zero changes (it only ever reads
  `person` and `slots`).

---

## Edge cases

- **Viewer changes defaults after being added**: no retro-effect. Roster-add is
  a point-in-time copy into the hunt; later profile edits don't touch a hunt
  already populated.
- **Same viewer added twice in one hunt**: merge-by-name â†’ second add only fills
  slots not already present; idempotent for identical defaults.
- **Viewer also submitted via the password link**: merge-by-name catches it
  regardless of `source`; no duplicate person row.
- **Viewer opts out after opting in**: `discoverable:false` immediately drops
  them from search; already-added picks stay in any live hunt (point-in-time).
- **Empty defaults but discoverable true**: excluded from search results
  (nothing to add) and `/api/roster/add` returns `409`.
- **No active hunt when host clicks add**: `409 NO_ACTIVE_HUNT` â†’ friendly
  "Start a hunt first."

---

## New files

- `api/me/slot-profile.js`
- `api/roster/search.js`
- `api/roster/add.js`

## Modified files

- `src/pages/MyAccountPage.js` â€” add the "Default slots" card.
- `src/components/HuntTracker.js` â€” add the roster search block.
- `firestore.indexes.json` â€” add the `users` composite index.
- `src/setupProxy.js` â€” mirror the three new `/api/*` endpoints for `npm start`
  dev (the existing proxy already mirrors `/api/bonus-hunts` and `/api/slots`;
  keep parity so the feature works under the CRA dev server, not only
  `vercel dev`).

## New dependencies

None. `firebase-admin`, `SlotAutocomplete`, `authedFetch`, `useUserDoc`,
`requireAuth`, and `applyCors` all already exist.

---

## Out of scope (YAGNI)

- A dedicated `/profile` route (folded into `/me`).
- Per-host allowlist / choosing which streamers may add you.
- Voting/upvoting on roster picks.
- Non-Twitch (name+PIN) profiles.
- Notifying a viewer that their slots were added to a hunt.
- Bulk multi-select roster panel (single pick â†’ add is enough for now).
- Editing another viewer's profile from the host side.
