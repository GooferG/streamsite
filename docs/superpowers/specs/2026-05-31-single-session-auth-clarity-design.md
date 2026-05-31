# Single-Session Auth Clarity — Design Spec

**Date:** 2026-05-31

## Overview

The site has two auth contexts sharing **one** Firebase `auth` instance:

- **`AuthContext`** — admin/staff via email/password (`luimeneghim@gmail.com` = owner;
  Twitch-uid moderators via `admin_users/{uid}`).
- **`TwitchAuthContext`** — viewers via Twitch OAuth → Firebase custom token.

Firebase Web SDK allows exactly **one** `auth.currentUser` per instance. So the two
identities cannot coexist — signing into one replaces the other. Today this is
silent and confusing: `twitchUser` is stored in `localStorage` **independently** of
the real Firebase session, so after one login clobbers the other the navigation can
display **both** a Twitch avatar and the Admin link, while `authedFetch`
(`auth.currentUser.getIdToken()`) actually sends whichever identity signed in last.

This caused the observed bug: logged in as admin *and* Twitch at once → API calls
used the wrong/last token, and the UI showed a contradictory state.

## Goal

One identity active at a time, always clearly shown, with an explicit warning when
switching. No silent session clobber. No change to which token `authedFetch` sends —
once the session is unambiguous, the correct token flows automatically.

## Decisions (resolved during brainstorming)

| Question | Decision |
| --- | --- |
| Coexist or single session? | **Single session.** Accept the Firebase one-user limit; do NOT add a second auth instance. |
| Switch behavior? | **Auto-switch with a confirm warning** at both login entry points. |
| Indicator? | Navigation shows **mutually exclusive, labeled** identity (Admin vs Twitch), driven off the real `auth.currentUser`. |

## Root cause (precise)

`TwitchAuthContext` seeds `twitchUser` from `localStorage` and only clears it when
`onAuthStateChanged` fires with `user == null` (full sign-out). It does **not** clear
`twitchUser` when `auth.currentUser` becomes a *different* identity (the admin). So:

1. Viewer signs in with Twitch → `auth.currentUser` = viewer (uid = twitchId),
   `twitchUser` set in localStorage.
2. Admin signs in with email/password → `signInWithEmailAndPassword` **replaces**
   `auth.currentUser` with the admin. `onAuthStateChanged` fires with the admin user
   (non-null), so the `if (!user)` branch never runs → **`twitchUser` stays in
   localStorage**.
3. Nav reads `twitchUser` (stale localStorage) AND `currentUser.email === ADMIN_EMAIL`
   (real) → renders both the Twitch avatar and the Admin link. `authedFetch` sends
   the admin token. Contradiction.

The reverse (Twitch login while admin active) clobbers the admin session, which
`AuthContext` *does* handle correctly because it derives purely from `currentUser`.
So the asymmetric fix is: make `twitchUser` follow the real session too.

## Architecture

### Source of truth

`auth.currentUser` is the single source of truth for "who is signed in." Both
contexts already subscribe to `onAuthStateChanged(auth)`. The fix makes
`TwitchAuthContext` derive `twitchUser` validity from that subscription instead of
trusting localStorage independently.

A signed-in user is the **Twitch viewer** iff:
- `auth.currentUser` is non-null, AND
- `auth.currentUser.email` is falsy (custom-token viewers have no email), AND
- the stored `twitchUser.twitchId` equals `auth.currentUser.uid`.

A signed-in user is **admin/staff** iff `auth.currentUser.email` is truthy (owner is
the email match; the existing `AuthContext` role logic is unchanged).

> Note on moderators: a Twitch-uid moderator signs in via the **same** Twitch custom
> token (no email), and `AuthContext` separately resolves their `admin_users` role.
> Such a user is legitimately "Twitch viewer" in `TwitchAuthContext` AND "moderator"
> in `AuthContext` — that is not a conflict (same underlying `currentUser`, same uid,
> same token). The clobber bug is specifically the **owner email/password** account
> vs a **viewer** account, which are different `currentUser`s. The guard below keys
> off `email` presence + uid match, which correctly keeps a mod's `twitchUser` intact
> (no email, uid matches) while clearing it when the owner-email account is active
> (email present).

### Piece 1 — Session-truth guard (`TwitchAuthContext`)

In the `onAuthStateChanged` handler, replace the current logic:

- `user == null` → clear `twitchUser` + localStorage (unchanged).
- `user != null` AND (`user.email` is truthy OR stored `twitchUser` exists with a
  `twitchId !== user.uid`) → the Twitch session is no longer the active one →
  **clear `twitchUser` + localStorage**.
- otherwise (viewer session matches) → keep / set `firebaseUser`.

This stops the phantom-avatar state after an admin login clobbers the viewer.

### Piece 2 — Auto-switch confirm at both entry points

A shared confirm gate (small helper, see Files) shows a `window.confirm` before a
login that would replace an active *different* identity:

- **Twitch login** (`loginWithTwitch`): if `auth.currentUser` is currently an
  admin/staff session (`auth.currentUser?.email` truthy), confirm
  *"You're signed in as Admin. Continuing with Twitch will sign you out of Admin.
  Continue?"* before redirecting to Twitch OAuth. If declined, do nothing.
- **Admin login** (`AdminLoginPage` submit + its "Continue with Twitch" button): if a
  viewer `twitchUser` is active, confirm *"You're signed in as <name> (Twitch).
  Signing in as Admin will sign you out of Twitch. Continue?"* before
  `signInWithEmailAndPassword`. If declined, abort the submit.

On confirm, the new sign-in proceeds; Piece 1 clears the stale opposite identity.

### Piece 3 — Mutually exclusive, labeled indicator (`Navigation`)

Drive the nav identity off the **real session**, not the independent localStorage
flag:

- Compute `isAdmin = currentUser?.email === ADMIN_EMAIL` (already present) and treat
  `twitchUser` as valid only when it now reflects the real session (guaranteed by
  Piece 1).
- **Desktop right cluster:** render the Twitch avatar control **OR** the Admin link,
  never both. When admin: show an "Operator" identity (avatar control hidden) plus the
  Admin nav link. When Twitch viewer: show the avatar control; hide the Admin link.
- **Mobile drawer:** the viewer block already shows "Signed in · Twitch". Add a
  parallel **Operator** identity block shown when admin is the active session, and
  ensure the two are mutually exclusive.

After Piece 1, `twitchUser` is already falsy whenever admin is active, so "mutually
exclusive" mostly falls out — Piece 3 is the explicit guard + labels so the states
read clearly and never overlap during the brief auth-loading window.

### Out of scope (YAGNI)

- Second Firebase `auth` instance / coexisting sessions.
- Any change to `authedFetch`, `/api/*` endpoints, or Firestore rules.
- Changes to the owner-email model or the moderator allowlist flow.
- A full "account switcher" UI (no quick-toggle between identities; switching = log
  out one, log in the other, with the confirm).

## Edge cases

- **Auth-loading window:** while `loading` is true in either context, the nav already
  hides the viewer control (`if (loading) return null` in `ViewerAuthControl`). Keep
  that; the Admin link is gated on `isAdmin` which is false until resolved. So no
  double-render during hydration.
- **Moderator (Twitch uid on allowlist):** keeps `twitchUser` (no email, uid matches)
  AND gets `role: 'moderator'`. Nav shows the Twitch avatar; the Admin link shows
  because `isAdmin` (owner-email) is false but staff access is via role — confirm
  current behavior: the Admin link in `Navigation` is gated on
  `currentUser?.email === ADMIN_EMAIL` (owner only), so a mod does NOT see the Admin
  link in the main nav today. This spec does not change that; mods reach admin via the
  existing `/admin` route guard. No regression.
- **Declining a switch confirm:** no state changes; the user stays on their current
  identity.
- **Stale localStorage from before this change:** Piece 1 self-heals on the next
  `onAuthStateChanged` (clears a `twitchUser` that doesn't match the real session).

## Files

**Modify:**
- `src/contexts/TwitchAuthContext.js` — session-truth guard in `onAuthStateChanged`;
  confirm gate in `loginWithTwitch`.
- `src/pages/AdminLoginPage.js` — confirm gate before email login and before the
  "Continue with Twitch" button when the opposite identity is active.
- `src/components/Navigation.js` — mutually exclusive, labeled identity (desktop +
  mobile).

**Create (optional, only if it reduces duplication):**
- `src/utils/authSwitch.js` — shared confirm-message constants + a tiny
  `confirmSwitch(kind)` helper so both entry points show identical wording. If it
  ends up trivial, inline instead and skip the file.

## New dependencies

None.
