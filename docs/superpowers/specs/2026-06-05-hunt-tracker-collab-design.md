# Spec B — Hunt Tracker Collab (allowed mods)

**Date:** 2026-06-05
**Tool:** `/gamba` Hunt Tracker (CH 02)
**Builds on:** Spec A — Redesign (`2026-06-05-hunt-tracker-redesign-design.md`). The header reserves a **Collab** action; this spec fills it in.
**Risk:** Higher than A — touches Firestore rules, cross-user writes, and the store's subscription target. Build A first; B is a separate plan.

## Goal
Let a hunt **owner** grant specific people **full edit** access to their active hunt ("allowed mods"), so co-streamers/mods can log bonuses, enter wins, run opening, and edit squad/banned/suggestions on the owner's hunt in real time. Owner retains exclusive control of **Complete, Discard, Share/Go-live, and mod management**.

## Decisions locked (from brainstorming)
- **Mod scope:** full edit; owner-only = complete/discard/share/manage-mods.
- **Add methods:** (primary) search registered site users → resolved uid; (secondary) type a raw Twitch handle → pending, binds on that user's next login. Audience is mostly existing site mods/staff, so resolved-uid is the common path; pending-handle is built but lighter.
- **Storage:** keep the owner doc `users/{ownerUid}/active_hunt/current`; widen rules so mod uids can write. Concurrent edits = last-write-wins per field (existing 500ms debounce + field-merge already provides this).
- **Mod-with-own-hunt conflict:** while actively modding an owner's hunt, the mod sees the OWNER's board; their own active hunt is untouched in storage. "Leave collab" returns them to their own. v1 is owner-hunt-takes-over (no switcher; switcher is a documented future enhancement).

## B1 — Data model
Add to the hunt doc (`active_hunt/current`):
```js
allowedMods:    [ { uid, login, displayName } ],  // resolved mods (display)
allowedModUids: [ uid, … ],                       // FLAT mirror for the security rule
pendingMods:    [ 'lowercasedlogin', … ],         // typed handles not yet logged in
```
`allowedModUids` exists because Firestore rules can't cleanly index an array-of-objects; the rule checks `request.auth.uid in resource.data.allowedModUids`. Both arrays are written together by the server endpoint (never client-authored, to keep the flat mirror trustworthy).

**Discovery index** (top-level, server-written):
```js
collab_index/{modUid} = { ownerUid, ownerLogin, updatedAt }
```
One doc per mod, telling that mod which owner's hunt they can edit. Needed because the mod's client otherwise only knows its own path. (v1: a mod is on at most one hunt — single doc. If multi-hunt collab is wanted later, this becomes a subcollection.)

## B2 — Firestore rules
Single targeted change to the active-hunt rule:
```
match /active_hunt/{docId} {
  allow read, write: if isSelf(uid) || isStaff()
    || (isSignedIn()
        && request.auth.uid in resource.data.allowedModUids);
}
```
Notes:
- On **create**, `resource.data` is the existing doc; a mod never creates the owner's hunt (owner does), so create stays effectively owner/staff. Guard: only widen `update` (and `read`) for mods, not `create`.
- `collab_index/{modUid}`: `allow read: if isSelf(modUid) || isStaff(); allow write: if false;` (server-only).
- Keep `users/{uid}` doc-level `write: if false` (unchanged); the widening is only on the `active_hunt` subdoc.
- The live mirror (`shared_hunts`) write rule stays owner-only (`ownerTwitchId == auth.uid`) — so **mods do not write the mirror**. Either the owner's client keeps mirroring, or the mirror is only refreshed by owner edits (acceptable: mirror is spectator eye-candy; mod edits reach spectators on the owner's next write/heartbeat). Document this limitation; a server-side mirror refresh is a future option.

## B3 — Server endpoints (`/api/hunt-collab/*`)
Mirror the pattern of `/api/hunt-suggest/*` (admin-cred broker for cross-user writes).
- `manage` (owner-gated): `action: add | remove`.
  - `add` by uid: resolve display name, push to `allowedMods` + `allowedModUids`, write `collab_index/{uid}`.
  - `add` by handle: if a site user with that Twitch login exists → treat as uid add; else push to `pendingMods`.
  - `remove`: pull from all three arrays, delete `collab_index/{uid}` (if resolved).
- `claim` (called on the mod's login, or lazily when they open the tracker): look up `pending_collab/{myLogin}` → if it exists, promote pending→resolved on that owner's hunt (move the handle out of `pendingMods` into `allowedMods`/`allowedModUids`), write `collab_index/{myUid}`, and delete `pending_collab/{myLogin}`. The `pending_collab/{login}` doc (`{ ownerUid }`, server-written at add-time) is the lookup key, so claim is a single doc read — **no scan of all users' hunts**.

So a pending-handle add writes `pending_collab/{login} = { ownerUid }`; `claim` consumes it. The authoritative source for "who is pending" is this collection; `pendingMods[]` on the hunt is the owner-facing display mirror.

## B4 — Store changes (`useHuntStore.js`)
- On load, after auth resolves, read `collab_index/{myUid}`.
  - **If present** → set `collabContext = { ownerUid, ownerLogin }`; point the active-hunt subscription + all writes at `users/{ownerUid}/active_hunt/current` instead of the user's own path. The user's own active hunt is left subscribed-to-nothing (untouched in storage).
  - **If absent** → current behavior (own path).
- `writeActive`, `updateHunt`, `updateSuggestions` target the **effective** uid (owner's when in collab context, else self). The mirror write stays gated to owner only (skip mirror when in collab context).
- Owner-only actions (`completeHunt`, `discardActiveHunt`, `startSharing`, `stopSharing`, mod management) are **disabled when `collabContext` is set** (the editor is a mod, not the owner).
- Expose `collabContext`, `leaveCollab()` (clears local context for the session — does not change server state; they're still a mod, just viewing their own board until they reload / re-enter), and mod-management actions for owners.
- `claim`-on-login: call `/api/hunt-collab/claim` once after sign-in; if it promotes them, `collab_index` appears and the next load picks it up.

## B5 — UI
- **Owner — Collab manager** (header **Collab** button → modal/popover): list current `allowedMods` (avatar, name, remove ✕) + `pendingMods` (handle, "awaiting login", remove). Add field: search site users (primary) + accept a raw `@handle` (secondary). Reuse `Modal`. Owner-only (hidden when `collabContext` set).
- **Mod — collab banner**: when `collabContext` is set, a persistent banner atop the tracker: `▸ You're modding {ownerLogin}'s hunt` + **Leave collab**. Owner-only actions are absent/disabled for them; everything else is the full A redesign surface.
- **Presence (optional, v1-lite):** none required. Last-write-wins is acceptable. A "who's editing" indicator is a future enhancement.

## Target files
- `firestore.rules` — widen `active_hunt` update/read for `allowedModUids`; add `collab_index` rule.
- `api/hunt-collab/manage.js`, `api/hunt-collab/claim.js` — new endpoints (admin-cred broker, owner-gated manage).
- `src/hooks/useHuntStore.js` — collab context, effective-uid targeting, owner-only gating, claim call.
- `src/components/HuntTracker.js` — Collab button (enable from A's placeholder), collab banner, owner-only action gating.
- `src/components/CollabManager.js` — new (owner mod-management modal).
- Possibly a small `src/utils/authedFetch.js` reuse (already exists) for the endpoints.

## Edge cases to handle
- Owner removes a mod mid-hunt → mod's `collab_index` deleted → mod's next snapshot/load drops them back to their own board (handle gracefully: if the active subscription errors with permission-denied, clear `collabContext`).
- Mod added who has their own active hunt → their hunt stays in storage; collab context overrides the view; Leave collab restores it.
- Owner completes/discards the hunt while a mod is editing → the owner's `active_hunt` doc is deleted; the mod's subscription goes empty → show "This hunt ended" and offer back-to-own-board.
- Same person added twice / already staff → dedupe; staff already have write via `isStaff()`, but still add to `allowedMods` for display + discovery.
- Pending handle never logs in → harmless; stays in `pendingMods`/`pending_collab` until owner removes or hunt ends. Clean up `pending_collab` + `collab_index` on hunt complete/discard (extend the existing intake-cleanup pattern in `completeHunt`/`discardActiveHunt`).

## Out of scope (Spec B v1)
- Per-permission granularity (full-edit only).
- Multi-hunt-per-mod, board switcher (owner-hunt-takes-over chosen).
- Server-side live-mirror refresh on mod edits (mirror updates on owner writes only).
- Real-time presence / cursors / edit indicators.

## Build order
1. Rules change + `collab_index`/`pending_collab` shape (deploy rules to a test project first).
2. `/api/hunt-collab/manage` (add/remove by uid) + owner Collab manager UI — resolved-uid path only.
3. Store collab-context targeting + mod banner + owner-only gating.
4. Pending-handle add + `/api/hunt-collab/claim` on login.
5. Edge-case handling (removal mid-hunt, hunt-end, cleanup on complete/discard).
