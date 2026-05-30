# Live Share Link — Design

**Date:** 2026-05-30
**Status:** Approved (design) — build AFTER the opening-slots phase
**New files:** `src/pages/LiveHuntPage.js`
**Modified:** `firestore.rules`, `src/hooks/useHuntStore.js`, `src/components/HuntTracker.js`, `src/App.js`

## Goal

Let the operator share a live, read-only view of the current bonus hunt with
people not on the site (e.g. stream chat) via an unguessable link. Spectators
see live stats, the bonus list + current/next slot, and the squad split,
updating in real time. The owner can revoke the link anytime.

## Decisions (from brainstorming)

- **Storage:** a top-level `shared_hunts/{shareId}` collection (public read,
  owner-only write). `users/*` stays fully private — spectators only ever see
  the mirrored doc. `shareId` is a random unguessable token.
- **Mirror sync:** while sharing is ON, every `updateHunt` also writes the
  mirror doc, so the spectator view stays live (one extra write per edit, only
  when shared).
- **Content:** live hunt stats, bonus list + current/next slot, squad split.
- **Privacy:** read-only spectators; owner can revoke (turning off deletes the
  mirror doc → link dies instantly).

## Data Model

New top-level collection:

```
shared_hunts/{shareId}
  {
    ownerTwitchId,        // who shared (for ownership checks on write)
    name, startBalance, finishBalance,
    bonuses: [...], gamblers: [...], bannedSlots,
    phase, openingIndex,  // so spectators see the opening live
    updatedAt,
  }
```

The active hunt doc (`users/{id}/active_hunt/current`) gains:
- `shareId`: string | null — the current share token (null when not shared).

`shareId` lets the tracker know it's sharing and which mirror doc to update/
delete.

## Firestore Rules

```
// Live-shared hunt snapshots. Public read (spectators, no login). Writes are
// owner-only: the signed-in user may write a doc whose ownerTwitchId matches
// their uid. Anyone can read by shareId (the token is the capability).
match /shared_hunts/{shareId} {
  allow read: if true;
  allow create, update: if isSignedIn()
    && request.resource.data.ownerTwitchId == request.auth.uid;
  allow delete: if isSignedIn()
    && resource.data.ownerTwitchId == request.auth.uid;
}
```

Notes:
- Read is fully public (the unguessable `shareId` is the access capability).
- Write/delete require the authed owner (uid == ownerTwitchId), so no one can
  forge or tamper with someone else's shared hunt.
- This is a client-write collection (like `suggestions`) — the owner's browser
  writes the mirror directly; no server endpoint needed.
- Anon users can't share (they have no uid) — sharing is a logged-in feature.
  (Anon hunts are local-only anyway; they have no cross-device identity to gate
  writes on.)

## Sharing Logic (useHuntStore)

Add to the hook:
- `shareId` (from the active hunt doc).
- `startSharing()`:
  - generate `shareId = makeId()`.
  - write `shared_hunts/{shareId}` with the current hunt + `ownerTwitchId = uid`.
  - set `shareId` on the active hunt (`updateHunt({ shareId })`).
- `stopSharing()`:
  - `deleteDoc(shared_hunts/{shareId})`.
  - clear `shareId` on the active hunt.
- **Mirror on save:** in `writeActive` (logged-in branch), if the hunt being
  written has a `shareId`, also `setDoc(shared_hunts/{shareId}, mirrorShape)`.
  Debounced together with the active write.

Sharing is **logged-in only** (anon path has no uid → `startSharing` is a no-op /
hidden in UI).

Mirror shape excludes nothing sensitive (hunt data is already
spectator-appropriate) but is built explicitly so we control exactly what's
public: name, balances, bonuses, gamblers, bannedSlots, phase, openingIndex,
ownerTwitchId, updatedAt.

## Tracker UI (HuntTracker)

In the active hunt header (logged-in only):
- **"Share live"** button when not sharing → calls `startSharing()`.
- When sharing: show a **"Live" indicator + copyable link** (`/live/<shareId>`)
  and a **"Stop sharing"** button → `stopSharing()`.
- Small "copied!" affordance on copy.

## Public Page — `src/pages/LiveHuntPage.js`

Route `/live/:shareId` (outside the admin/auth shell — fully public).

- Subscribes via `onSnapshot(doc(db, 'shared_hunts', shareId))`.
- **Live:** stats band (name, start/finish, profit, req X, best X via
  `computeStats`), bonus list (with markers + current/next highlight using
  `phase`/`openingIndex`), squad split (using the same render shapes as the
  tracker/history).
- **Missing doc** (never shared / revoked) → friendly "This hunt isn't live
  right now" state.
- Read-only — no inputs, no auth. Styled to the site register (dark broadcast).
- Reuses `fmt`/`fmtX`/`computeStats` from `huntCalc`.

## Routing

`src/App.js`: `<Route path="/live/:shareId" element={<LiveHuntPage />} />` —
placed with the other public top-level routes (not under `/admin`), and not
requiring either auth context.

## Edge Cases

- Revoke while a spectator is watching → their `onSnapshot` fires with a
  non-existent doc → page flips to the "not live" state. Instant.
- Owner completes the hunt while shared → the active hunt clears; we also delete
  the mirror in `completeHunt` (if `shareId` set) so the live link ends cleanly.
  (Alternatively mirror the final state once then delete — v1: delete on
  complete, link ends.)
- Multiple shares of the same hunt → only one `shareId` at a time (stored on the
  hunt). Re-sharing after stopping generates a new token (old link stays dead).
- Anon user → no share UI; if they later log in and claim the local hunt, they
  can share it then.
- Writes are debounced with the active write, so spectator lag ≤ ~0.5s.

## Out of Scope (v1)

- Spectator chat / reactions.
- Sharing completed hunts from history (only the active hunt).
- Custom vanity share slugs (random token only).
- Server-side rendering / OG preview image for the live link.

## Files

- `firestore.rules` — add `shared_hunts/{shareId}` rule.
- `src/hooks/useHuntStore.js` — `shareId`, `startSharing`, `stopSharing`,
  mirror-on-save, delete-on-complete.
- `src/components/HuntTracker.js` — share button + live link UI in header.
- `src/pages/LiveHuntPage.js` — public spectator page.
- `src/App.js` — `/live/:shareId` route.

## Dependencies

Builds on the opening-slots phase (`phase`, `openingIndex`) so the live view can
show the current/next slot. Build the opening phase first.
