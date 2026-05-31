# Viewer Rainbet payout handle — design

**Date:** 2026-05-31
**Status:** Approved (design)

## Goal

Let a signed-in viewer save their **Rainbet username** on the `/me` account page,
next to their default slots, so when a bonus hunt pays out the host can see where
to send the viewer's cut. The Rainbet handle is profile data attached to the
person — not a payout-engine feature wired into the squad-split math.

## Scope decisions (locked)

- **Method:** Rainbet username only. No crypto wallet, no free-form note.
- **Storage shape:** rides on the user profile, like `slotProfile`.
- **Host access:** read-only. Only the viewer sets their own handle.
- **Host surface:** the roster-add flow (where discoverable viewers already surface
  for picking into a hunt). No changes to the squad-split tracker.
- **No account-linking of gambler rows.** Squad-split gamblers stay free-text
  `{ id, name, inFor }`; no `userId`, no data migration.
- **Never on the PNG export.** Payout handles stay in on-screen admin UI only,
  so a host can't accidentally post someone's handle in a shared image.
- **Roster visibility unchanged (option a).** Rainbet surfaces only for viewers who
  are already discoverable AND have ≥1 default slot — the existing roster population.
  A viewer with a Rainbet handle but no slots does not appear; that is acceptable.

## Data model

One new field on `users/{uid}`, sibling to `slotProfile`:

```text
users/{uid}.payoutProfile = {
  rainbetUsername: string,   // trimmed, max 50 chars, stored verbatim
  updatedAt: serverTimestamp
}
```

Separate object from `slotProfile` (different concern + sensitivity), saved through
the same UX pattern.

**No Firestore rules change.** `users/{uid}` is already `read: isSelf(uid) || isStaff()`
and `write: false` (server-only). Self can read their own handle; staff can read all;
all writes go through the server endpoint.

## Components

### 1. `/api/me/payout-profile.js` (new)

Clone of `api/me/slot-profile.js`. The user doc is server-only write, so this is the
sole path for a viewer to persist their Rainbet handle.

- `POST { rainbetUsername }`, `Authorization: Bearer <Firebase ID token>`.
- `applyCors`, handle `OPTIONS`, reject non-POST with 405.
- `requireAuth` → `uid`.
- Sanitize: `String(rainbetUsername || '').trim().slice(0, 50)`.
- `userRef.get()`; 404 `USER_NOT_FOUND` if missing (matches slot-profile).
- `userRef.set({ payoutProfile: { rainbetUsername, updatedAt: serverTimestamp } }, { merge: true })`.
- Return `{ ok: true, rainbetUsername }`. 500 `INTERNAL` on error.

Empty string is allowed (clears the handle).

> Note: unlike `slot-profile.js`, this endpoint does **not** compute/write
> `twitchNameLower`. That search key is maintained by the slots save and lives on
> `slotProfile`; roster search keys off it. Don't copy that block into the clone.

### 2. MyAccountPage — Rainbet payout card

New presentational card component (e.g. `PayoutProfileCard`), placed next to
`SlotProfileCard`. Mirrors `SlotProfileCard`'s structure and save/saved/error states.

- Single text input, initial value from `user?.payoutProfile?.rainbetUsername`.
- Save button → `authedFetch('/api/me/payout-profile', { method:'POST', body: JSON.stringify({ rainbetUsername }) })`.
- Saved / error UI identical in spirit to the slots card (`savedAt`, `error`).
- Copy states the purpose plainly, e.g. *"Where hosts send your cut when a hunt pays out."*
- Use the same `key={user?.payoutProfile ? 'loaded' : 'empty'}` re-init trick the
  slots card uses, since `useUserDoc()` streams in async.

### 3. `/api/roster/search.js` — include the handle

In the result mapper, add one field:

```js
rainbetUsername: data.payoutProfile?.rainbetUsername || '',
```

No change to the query or the `defaultSlots.length > 0` filter.

### 4. SuggestionsPanel roster result row — show the handle

In the result `<li>` (`src/components/SuggestionsPanel.js`, the roster picker rows),
render the Rainbet handle under the name + slots:

- When present: show it (small, mono, muted) so the host sees it at pick time.
- When absent: a subtle "no Rainbet set" hint so the host isn't left guessing.

## Data flow

```text
Viewer (/me)
  └─ types Rainbet username, Save
       └─ POST /api/me/payout-profile  (Bearer ID token)
            └─ users/{uid}.payoutProfile.rainbetUsername

Host (active hunt → "Add a registered viewer")
  └─ search by name → GET /api/roster/search?q=
       └─ results include rainbetUsername
            └─ rendered in the picker row beside the viewer
```

## Error handling

- Endpoint: 405 non-POST; 404 `USER_NOT_FOUND`; 500 `INTERNAL`. Mirrors slot-profile.
- Client (card): network/!ok → inline error, button re-enabled. Same as slots card.
- Roster row: missing handle is a normal state (hint text), not an error.

## Testing

- Manual: save a handle on /me, confirm it persists across reload (reads from
  `useUserDoc`). Clear it (empty save) and confirm it clears.
- Manual: as host with an active hunt, search a discoverable viewer who has slots +
  a saved handle; confirm the handle shows in the picker row. Confirm a viewer with
  no handle shows the hint.
- Confirm the recap PNG export is unchanged (no handle on it).
- No new unit tests required; matches the untested slot-profile precedent.

## Out of scope (explicit)

- Crypto wallet / multiple payout methods.
- Free-form payout note.
- Squad-split gambler → account linking, `userId` on gamblers, migration.
- Rainbet on the recap/split PNG export.
- Staff/host editing of a viewer's handle.
- Surfacing Rainbet for viewers who are not discoverable or have zero slots.
