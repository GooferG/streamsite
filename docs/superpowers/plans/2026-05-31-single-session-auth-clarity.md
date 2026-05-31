# Single-Session Auth Clarity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make admin (email/password) and Twitch (custom token) logins mutually exclusive and unambiguous on one shared Firebase auth instance — no silent session clobber, a confirm before switching, and a nav that shows exactly one identity at a time.

**Architecture:** `auth.currentUser` is the single source of truth. A pure helper `isViewerSession(currentUser, storedTwitchUser)` decides whether the stored Twitch profile reflects the real session; `TwitchAuthContext` uses it to clear stale `twitchUser` when the admin account takes over. A shared `confirmSwitch` gate warns before a login that would replace the other identity. `Navigation` renders the Twitch control XOR the Admin link, driven off the real session.

**Tech Stack:** React 19, Firebase Web SDK (one `auth` instance), Jest + @testing-library/react for the pure-logic unit test, Tailwind. No new dependencies.

**Reference spec:** [docs/superpowers/specs/2026-05-31-single-session-auth-clarity-design.md](../specs/2026-05-31-single-session-auth-clarity-design.md)

---

## Conventions for this plan

- The **session-truth rule** is extracted as a pure function so it can be unit-tested
  (Task 1, TDD). Everything else is React wiring / UI verified by `npm run build` +
  manual checks, matching the project's testing norms (Jest covers a few `src/**`
  units only; auth/UI flows are validated by running the app).
- A user is the **Twitch viewer session** iff `currentUser` is non-null, `currentUser.email`
  is falsy, and `storedTwitchUser?.twitchId === currentUser.uid`. Otherwise the stored
  Twitch profile is stale and must be cleared.
- Shared switch wording lives in one helper (`src/utils/authSwitch.js`) so both entry
  points read identically.

---

## File Structure

**Create:**
- `src/utils/authSwitch.js` — pure `isViewerSession()` + `confirmSwitch()` gate + message constants.
- `src/utils/__tests__/authSwitch.test.js` — unit tests for `isViewerSession`.

**Modify:**
- `src/contexts/TwitchAuthContext.js` — use `isViewerSession` in `onAuthStateChanged`; confirm gate in `loginWithTwitch`.
- `src/pages/AdminLoginPage.js` — confirm gate before email login and the "Continue with Twitch" button.
- `src/components/Navigation.js` — Twitch control XOR Admin link; labeled identity (desktop + mobile).

---

## Task 1: Pure session-truth helper + tests

**Files:**
- Create: `src/utils/authSwitch.js`
- Test: `src/utils/__tests__/authSwitch.test.js`

The riskiest logic — "is the stored Twitch profile still the real session?" — as a pure,
testable function.

- [ ] **Step 1: Write the failing test**

Create `src/utils/__tests__/authSwitch.test.js`:

```js
import { isViewerSession } from '../authSwitch';

describe('isViewerSession', () => {
  it('false when no one is signed in', () => {
    expect(isViewerSession(null, null)).toBe(false);
    expect(isViewerSession(null, { twitchId: '123' })).toBe(false);
  });

  it('false when the signed-in user is an admin (has email)', () => {
    const admin = { uid: 'abc', email: 'luimeneghim@gmail.com' };
    expect(isViewerSession(admin, { twitchId: '123' })).toBe(false);
  });

  it('false when a viewer is signed in but no stored twitch profile', () => {
    const viewer = { uid: '123', email: null };
    expect(isViewerSession(viewer, null)).toBe(false);
  });

  it('false when stored twitch id does not match the signed-in uid', () => {
    const viewer = { uid: '123', email: null };
    expect(isViewerSession(viewer, { twitchId: '999' })).toBe(false);
  });

  it('true when a viewer is signed in and the stored id matches', () => {
    const viewer = { uid: '123', email: null };
    expect(isViewerSession(viewer, { twitchId: '123' })).toBe(true);
  });

  it('treats empty-string email as no email (viewer)', () => {
    const viewer = { uid: '123', email: '' };
    expect(isViewerSession(viewer, { twitchId: '123' })).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx react-scripts test --watchAll=false --testPathPattern=authSwitch`
Expected: FAIL — `isViewerSession is not a function` / cannot find module `../authSwitch`.

- [ ] **Step 3: Write the helper**

Create `src/utils/authSwitch.js`:

```js
// Single source of truth for "which identity is signed in" on the shared Firebase
// auth instance. The site has ONE auth.currentUser; admin (email/password) and
// Twitch viewer (custom token, no email) cannot coexist. These helpers keep the
// stored Twitch profile honest and warn before a login replaces the other identity.

/**
 * True iff the stored Twitch profile reflects the REAL current session.
 * A Twitch viewer signs in via custom token (no email) with uid === twitchId.
 * Any admin/staff session (email present) or a uid mismatch means the stored
 * Twitch profile is stale and should be cleared.
 *
 * @param {{uid: string, email?: string|null}|null} currentUser - auth.currentUser
 * @param {{twitchId: string}|null} storedTwitchUser - persisted Twitch profile
 */
export function isViewerSession(currentUser, storedTwitchUser) {
  if (!currentUser) return false;
  if (currentUser.email) return false; // admin/staff email account
  if (!storedTwitchUser) return false;
  return storedTwitchUser.twitchId === currentUser.uid;
}

export const SWITCH_TO_TWITCH_MSG =
  "You're signed in as Admin. Continuing with Twitch will sign you out of Admin. Continue?";

/**
 * Build the "switching to Admin" warning, naming the active Twitch viewer.
 * @param {string} [name] - the active Twitch display name
 */
export function switchToAdminMsg(name) {
  const who = name ? `${name} (Twitch)` : 'Twitch';
  return `You're signed in as ${who}. Signing in as Admin will sign you out of Twitch. Continue?`;
}

/**
 * Show a confirm() warning before a login that replaces the other identity.
 * Returns true if the user agreed to proceed (or no warning was needed).
 *
 * @param {string} message - the warning to show
 * @param {boolean} needed - whether a conflicting identity is currently active
 */
export function confirmSwitch(message, needed) {
  if (!needed) return true;
  // eslint-disable-next-line no-alert
  return window.confirm(message);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx react-scripts test --watchAll=false --testPathPattern=authSwitch`
Expected: PASS — 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/utils/authSwitch.js src/utils/__tests__/authSwitch.test.js
git commit -m "feat: pure session-truth helper for single-session auth"
```

---

## Task 2: Session-truth guard + confirm in TwitchAuthContext

**Files:**
- Modify: `src/contexts/TwitchAuthContext.js`

Make `twitchUser` follow the real session (clears the phantom-avatar state), and warn
before a Twitch login that would clobber an active admin session.

- [ ] **Step 1: Add the import**

At the top of `src/contexts/TwitchAuthContext.js`, after the existing
`import { auth } from '../config/firebase';` line, add:

```js
import { isViewerSession, confirmSwitch, SWITCH_TO_TWITCH_MSG } from '../utils/authSwitch';
```

- [ ] **Step 2: Replace the `onAuthStateChanged` handler**

Replace the current effect (the `useEffect` calling `onAuthStateChanged`) with:

```js
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      // Keep the stored Twitch profile honest: clear it whenever the real
      // session isn't this viewer (signed out, or an admin account took over).
      setTwitchUser((prev) => {
        if (isViewerSession(user, prev)) return prev;
        localStorage.removeItem('twitch_user');
        return null;
      });
      setLoading(false);
    });
    return unsub;
  }, []);
```

> Why a functional `setTwitchUser`: the handler must compare against the *latest*
> stored profile without adding `twitchUser` to the effect deps (which would
> re-subscribe on every login). Reading `prev` inside the updater avoids that.

- [ ] **Step 3: Add the confirm gate to `loginWithTwitch`**

Replace the `loginWithTwitch` function with:

```js
  const loginWithTwitch = () => {
    // If an admin/staff session is active, warn before clobbering it.
    const adminActive = !!auth.currentUser?.email;
    if (!confirmSwitch(SWITCH_TO_TWITCH_MSG, adminActive)) return;
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'user:read:email',
    });
    window.location.href = `https://id.twitch.tv/oauth2/authorize?${params}`;
  };
```

- [ ] **Step 4: Build gate**

Run: `npm run build`
Expected: compiles with no errors referencing `TwitchAuthContext` or `authSwitch`.
(If `web-vitals` resolution errors recur, run `npm install web-vitals@^2.1.4 --no-save` first — pre-existing env issue, not part of this change.)

- [ ] **Step 5: Commit**

```bash
git add src/contexts/TwitchAuthContext.js
git commit -m "fix: twitchUser tracks real session + confirm before Twitch login clobbers admin"
```

---

## Task 3: Confirm gate in AdminLoginPage

**Files:**
- Modify: `src/pages/AdminLoginPage.js`

Warn before an admin login (or the page's "Continue with Twitch" button) replaces an
active Twitch viewer session.

- [ ] **Step 1: Add the import**

After the existing `import { useTwitchAuth } from '../contexts/TwitchAuthContext';`
line, add:

```js
import { confirmSwitch, switchToAdminMsg } from '../utils/authSwitch';
```

- [ ] **Step 2: Read the active Twitch user in the component**

The component already destructures `useTwitchAuth()`. Change that line to also pull
`twitchUser`:

```js
  const { loginWithTwitch, twitchUser } = useTwitchAuth();
```

- [ ] **Step 3: Gate the email-login submit**

In `handleSubmit`, add the confirm at the very top of the `try` (before `await login`):

```js
    try {
      if (!confirmSwitch(switchToAdminMsg(twitchUser?.displayName), !!twitchUser)) {
        setLoading(false);
        return;
      }
      await login(email, password);
      onLoginSuccess();
```

> `setLoading(false)` before the early return because `setLoading(true)` already ran
> above; without it the button would stay stuck on "AUTH...".

- [ ] **Step 4: Note on the "Continue with Twitch" button**

That button calls `loginWithTwitch` from `TwitchAuthContext`, which already has its own
confirm gate (Task 2, Step 3). No change needed here — it will warn if an admin session
is active and is a no-op clobber-wise when a viewer is already signed in. Leave the
button as-is.

- [ ] **Step 5: Build gate**

Run: `npm run build`
Expected: compiles with no errors referencing `AdminLoginPage`.

- [ ] **Step 6: Commit**

```bash
git add src/pages/AdminLoginPage.js
git commit -m "fix: confirm before admin login replaces active Twitch session"
```

---

## Task 4: Mutually exclusive, labeled identity in Navigation

**Files:**
- Modify: `src/components/Navigation.js`

Render the Twitch control XOR the Admin identity, never both, with clear labels.
After Task 2, `twitchUser` is already falsy whenever admin is the real session — this
task makes the exclusivity explicit and adds the Operator label so the states read
clearly even during the brief auth-loading window.

- [ ] **Step 1: Desktop — hide the viewer control when admin is active**

In the desktop right cluster (the `<div className="hidden md:flex items-center gap-2 lg:gap-3 flex-shrink-0">` block), the current code renders `<ViewerAuthControl/>` then conditionally the Admin `NavLink`. Replace that block's contents with mutually exclusive rendering:

```jsx
          <div className="hidden md:flex items-center gap-2 lg:gap-3 flex-shrink-0">
            {isAdmin ? (
              <div className="flex items-center gap-2 lg:gap-3">
                <span className="inline-flex items-center gap-1.5 px-2 py-1 border border-orange-admin/30 bg-orange-admin/5 text-[10px] font-bold tracking-eyebrow-lg uppercase text-orange-admin font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-admin" aria-hidden="true" />
                  Operator
                </span>
                <div className="pl-2 lg:pl-3 border-l border-white/10">
                  <NavLink
                    item={ADMIN_ITEM}
                    active={currentPage === ADMIN_ITEM.id}
                    accent="orange"
                    onClick={() => setPage(ADMIN_ITEM.id)}
                  />
                </div>
              </div>
            ) : (
              <ViewerAuthControl onNavigate={(id) => setPage(id)} />
            )}
          </div>
```

> When admin is active: Operator badge + Admin link, no Twitch avatar. Otherwise: the
> existing viewer control (which itself shows "Sign in" or the avatar menu).

- [ ] **Step 2: Mobile — make the identity block mutually exclusive**

In the mobile drawer's "Viewer identity / login" block (the
`<div className="px-5 py-4 border-b border-white/10">` containing the `twitchUser ? ... : ...`
ternary), wrap it so the admin Operator identity shows instead when admin is active.
Replace the opening of that block:

```jsx
        {/* Identity / login */}
        <div className="px-5 py-4 border-b border-white/10">
          {isAdmin ? (
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 inline-flex items-center justify-center border border-orange-admin/40 bg-orange-admin/5">
                <span className="w-2 h-2 rounded-full bg-orange-admin" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white-body truncate">Operator</p>
                <p className="text-[9px] font-bold tracking-eyebrow-lg uppercase text-orange-admin/80 font-mono">
                  Signed in · Admin
                </p>
              </div>
            </div>
          ) : twitchUser ? (
```

Then the existing `twitchUser ? (...) : (...)` content follows unchanged, EXCEPT the
leading `{twitchUser ? (` is now replaced by the `) : twitchUser ? (` shown above, and
the block still closes with the existing `)}` after the Twitch sign-in button. (Net:
the ternary becomes `isAdmin ? <Operator> : twitchUser ? <ViewerSignedIn> : <SignInButton>`.)

> The existing mobile Admin entry under the "Operator" nav separator (gated on
> `isAdmin`) stays — it's the actual nav link. This identity block is just the
> header showing *who* you are.

- [ ] **Step 3: Build gate**

Run: `npm run build`
Expected: compiles with no errors referencing `Navigation`. Verify no JSX
unbalanced-tag errors from the ternary edit.

- [ ] **Step 4: Commit**

```bash
git add src/components/Navigation.js
git commit -m "feat: mutually exclusive labeled identity in nav (admin xor twitch)"
```

---

## Task 5: End-to-end manual verification

**Files:** none (verification only)

Auth/session flows aren't unit-testable here (one shared live Firebase instance).
Verify against a running app (`npm start` or a preview deploy). The Task 1 unit test
already covers the session-truth logic.

- [ ] **Step 1: Clean single Twitch login**

Logged out. Sign in with Twitch. Expected: nav shows the Twitch avatar control, NO
Admin link, NO Operator badge. `/me` works.

- [ ] **Step 2: Switch Twitch → Admin (confirm warning)**

While signed in as Twitch, go to `/admin`, enter admin credentials, submit. Expected:
a confirm dialog *"You're signed in as <name> (Twitch). Signing in as Admin will sign
you out of Twitch. Continue?"*. Confirm. Expected: admin lands in the admin area; nav
now shows the Operator badge + Admin link and NO Twitch avatar. The phantom dual-state
is gone.

- [ ] **Step 3: Decline the switch**

Repeat Step 2 but click Cancel on the confirm. Expected: still signed in as Twitch,
admin login aborted, the AUTHENTICATE button is not stuck on "AUTH...".

- [ ] **Step 4: Switch Admin → Twitch (confirm warning)**

While signed in as admin, click "Sign in" / "Continue with Twitch". Expected: a confirm
*"You're signed in as Admin. Continuing with Twitch will sign you out of Admin.
Continue?"*. Confirm → Twitch OAuth → back signed in as the viewer; nav shows the Twitch
avatar and NO Admin link/Operator badge.

- [ ] **Step 5: authedFetch uses the right token**

As the viewer (after Step 4), open the hunt tracker / `/me` and perform an action that
calls an authed endpoint (e.g. save default slots on `/me`). Expected: 200, no 401 —
confirming `authedFetch` sends the viewer token, not a stale admin token.

- [ ] **Step 6: Stale-localStorage self-heal**

Simulate the old bug: in DevTools, while signed in as admin, manually set
`localStorage.twitch_user = '{"twitchId":"999","displayName":"ghost"}'` and reload.
Expected: nav does NOT show a Twitch avatar — `onAuthStateChanged` + `isViewerSession`
clear the mismatched profile on load (admin has an email / uid mismatch). Operator
state only.

---

## Self-Review Notes

- **Spec coverage:** Piece 1 session-truth guard (Task 1 helper + Task 2 wiring); Piece 2
  confirm at both entry points (Task 2 `loginWithTwitch`, Task 3 admin submit; the admin
  page's Twitch button reuses Task 2's gate); Piece 3 mutually exclusive labeled nav
  (Task 4 desktop + mobile). Edge cases — auth-loading window (ViewerAuthControl's
  `if (loading) return null` retained; Admin gated on `isAdmin`), moderator (keys off
  email presence, so a no-email mod keeps `twitchUser`; Admin nav link is owner-email
  gated, unchanged), decline (Task 5 Step 3), stale localStorage self-heal (Task 5 Step 6).
- **Placeholder scan:** none — every step has concrete code or an exact command.
- **Type consistency:** `isViewerSession(currentUser, storedTwitchUser)` signature is
  identical across Task 1 (def + tests) and Task 2 (call via the functional updater,
  `isViewerSession(user, prev)`). `confirmSwitch(message, needed)` and
  `switchToAdminMsg(name)` / `SWITCH_TO_TWITCH_MSG` consumed exactly as exported in
  Tasks 2 and 3. `twitchUser.displayName` / `twitchUser.twitchId` match the profile
  shape set in `signInWithTwitchCode` (`{ twitchId, displayName, profileImageUrl }`).
