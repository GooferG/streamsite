# Optional collect-link password + per-hunt live-share preview — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the hunt-tracker collect link's password optional, and give the live-share link a per-hunt Open Graph preview card.

**Architecture:** Two independent features. (A) `suggestion_intakes` docs created without a `passwordHash` are treated as open; the public submit page and owner control adapt to a `requiresPassword` flag. (B) A new public serverless function intercepts `/live/<shareId>`, fetches the deployed `index.html` over HTTPS, swaps the OG/Twitter text tags with per-hunt values from the `shared_hunts` mirror, and returns it; real browsers still boot the SPA.

**Tech Stack:** Vercel serverless functions (Node 18+, global `fetch`), `firebase-admin` (`adminDb`, `FieldValue`), React 19 (CRA), Jest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-06-02-optional-link-password-and-live-preview-design.md`

---

## File Structure

**Feature A (optional password):**
- Modify `api/hunt-suggest/manage.js` — `create` action: password optional, reuse clears stale hash.
- Modify `api/hunt-suggest/submit.js` — skip password check when intake has no hash.
- Modify `api/hunt-suggest/info.js` — expose `requiresPassword`.
- Modify `src/pages/HuntSuggestPage.js` — hide password field when not required.
- Modify `src/components/HuntLinkControls.js` — "Require a password" toggle (off by default) + show link protection state.
- Modify `src/components/HuntTracker.js` — `createIntakeLink('')` allowed; persist `intakeRequiresPassword`; pass new prop.

**Feature B (live preview):**
- Create `api/live-preview.js` — public fn, injects per-hunt OG tags.
- Modify `vercel.json` — route `/live/:shareId` to the fn before the SPA catch-all.

Features A and B share no files. Build A fully, then B.

---

## FEATURE A — Optional password on the collect link

### Task A1: `manage.js` create — make password optional + clear stale hash on reuse

**Files:**
- Modify: `api/hunt-suggest/manage.js:38-77`

- [ ] **Step 1: Relax the create-action password validation**

In `api/hunt-suggest/manage.js`, replace the `if (action === 'create')` block body's password handling. Find the current block (lines ~38-77):

```js
    if (action === 'create') {
      const { password } = req.body || {};
      if (!password || String(password).length < 8) {
        return res.status(400).json({ error: 'PASSWORD_TOO_SHORT' });
      }
      // Pull the active hunt name for display on the submit page.
      const activeSnap = await adminDb
        .doc(`users/${uid}/active_hunt/current`)
        .get();
      if (!activeSnap.exists) return res.status(404).json({ error: 'NO_ACTIVE_HUNT' });
      const huntName = activeSnap.data()?.name || 'Bonus hunt';

      const salt = crypto.randomBytes(16).toString('hex');
      const passwordHash = hashPassword(password, salt);

      // Idempotency: if this owner already has an open intake link, reuse it
      // (rotating its password) instead of minting a duplicate on retry. Query
      // is by ownerUid only (single-field, auto-indexed); filter open in code.
      const existing = await adminDb
        .collection('suggestion_intakes')
        .where('ownerUid', '==', uid)
        .get();
      const reuse = existing.docs.find((d) => d.data().open !== false);
      if (reuse) {
        await reuse.ref.update({ huntName, passwordHash, passwordSalt: salt, open: true });
        return res.status(200).json({ ok: true, linkId: reuse.id, open: true, reused: true });
      }

      const linkId = makeLinkId();
      await adminDb.doc(`suggestion_intakes/${linkId}`).set({
        ownerUid: uid,
        huntName,
        passwordHash,
        passwordSalt: salt,
        open: true,
        createdAt: FieldValue.serverTimestamp(),
      });

      return res.status(200).json({ ok: true, linkId, open: true });
    }
```

Replace it with:

```js
    if (action === 'create') {
      const { password } = req.body || {};
      // Password is OPTIONAL. If provided it must be >= 8 chars; if omitted/empty
      // the link is open (no hash stored — absence is the "open" state).
      const wantsPassword = Boolean(password);
      if (wantsPassword && String(password).length < 8) {
        return res.status(400).json({ error: 'PASSWORD_TOO_SHORT' });
      }
      // Pull the active hunt name for display on the submit page.
      const activeSnap = await adminDb
        .doc(`users/${uid}/active_hunt/current`)
        .get();
      if (!activeSnap.exists) return res.status(404).json({ error: 'NO_ACTIVE_HUNT' });
      const huntName = activeSnap.data()?.name || 'Bonus hunt';

      const salt = wantsPassword ? crypto.randomBytes(16).toString('hex') : null;
      const passwordHash = wantsPassword ? hashPassword(password, salt) : null;

      // Idempotency: if this owner already has an open intake link, reuse it
      // instead of minting a duplicate on retry. Query is by ownerUid only
      // (single-field, auto-indexed); filter open in code.
      const existing = await adminDb
        .collection('suggestion_intakes')
        .where('ownerUid', '==', uid)
        .get();
      const reuse = existing.docs.find((d) => d.data().open !== false);
      if (reuse) {
        // When recreating with a password, set hash/salt. When recreating as
        // open, DELETE any stale hash/salt so the old password stops working.
        const patch = wantsPassword
          ? { huntName, passwordHash, passwordSalt: salt, open: true }
          : {
              huntName,
              passwordHash: FieldValue.delete(),
              passwordSalt: FieldValue.delete(),
              open: true,
            };
        await reuse.ref.update(patch);
        return res
          .status(200)
          .json({ ok: true, linkId: reuse.id, open: true, reused: true });
      }

      const linkId = makeLinkId();
      const docData = {
        ownerUid: uid,
        huntName,
        open: true,
        createdAt: FieldValue.serverTimestamp(),
      };
      // Only write hash/salt for password-protected links.
      if (wantsPassword) {
        docData.passwordHash = passwordHash;
        docData.passwordSalt = salt;
      }
      await adminDb.doc(`suggestion_intakes/${linkId}`).set(docData);

      return res.status(200).json({ ok: true, linkId, open: true });
    }
```

- [ ] **Step 2: Manual sanity read**

Re-read the edited block. Confirm: `wantsPassword` false path never calls `hashPassword`; reuse-open path uses `FieldValue.delete()`; new-open path omits hash/salt entirely. `FieldValue` is already imported at the top of the file (line 2).

- [ ] **Step 3: Commit**

```bash
git add api/hunt-suggest/manage.js
git commit -m "feat: allow creating an open (no-password) collect link"
```

---

### Task A2: `submit.js` — bypass password check for open links

**Files:**
- Modify: `api/hunt-suggest/submit.js:49-58`

- [ ] **Step 1: Skip the password check when the intake has no hash**

In `api/hunt-suggest/submit.js`, find this section (lines ~50-58):

```js
    const intakeSnap = await intakeRef.get();
    if (!intakeSnap.exists) return res.status(404).json({ error: 'NOT_FOUND' });
    const intake = intakeSnap.data();
    if (intake.open === false) return res.status(403).json({ error: 'CLOSED' });

    const given = hashPassword(password, intake.passwordSalt);
    if (!hashesMatch(given, intake.passwordHash)) {
      return res.status(401).json({ error: 'BAD_PASSWORD' });
    }
```

Replace the password block (the last 4 lines above) with a guarded version:

```js
    const intakeSnap = await intakeRef.get();
    if (!intakeSnap.exists) return res.status(404).json({ error: 'NOT_FOUND' });
    const intake = intakeSnap.data();
    if (intake.open === false) return res.status(403).json({ error: 'CLOSED' });

    // Open links have no stored hash — skip the password gate entirely.
    // Password-protected links still require a timing-safe match.
    if (intake.passwordHash) {
      const given = hashPassword(password, intake.passwordSalt);
      if (!hashesMatch(given, intake.passwordHash)) {
        return res.status(401).json({ error: 'BAD_PASSWORD' });
      }
    }
```

- [ ] **Step 2: Manual sanity read**

Confirm: when `intake.passwordHash` is undefined (open link), no hashing happens and flow proceeds to the transaction. All other guards (cooldown, cap, overwrite) are below this and unchanged.

- [ ] **Step 3: Commit**

```bash
git add api/hunt-suggest/submit.js
git commit -m "feat: accept submissions on open collect links without a password"
```

---

### Task A3: `info.js` — expose `requiresPassword`

**Files:**
- Modify: `api/hunt-suggest/info.js:20-24`

- [ ] **Step 1: Add requiresPassword to the response**

In `api/hunt-suggest/info.js`, find:

```js
    const data = snap.data();
    return res.status(200).json({
      huntName: data.huntName || 'Bonus hunt',
      open: data.open !== false,
    });
```

Replace with:

```js
    const data = snap.data();
    return res.status(200).json({
      huntName: data.huntName || 'Bonus hunt',
      open: data.open !== false,
      requiresPassword: Boolean(data.passwordHash),
    });
```

- [ ] **Step 2: Commit**

```bash
git add api/hunt-suggest/info.js
git commit -m "feat: report requiresPassword on collect-link info"
```

---

### Task A4: `HuntSuggestPage.js` — hide password field when not required

**Files:**
- Modify: `src/pages/HuntSuggestPage.js`
- Test: `src/pages/__tests__/HuntSuggestPage.test.js` (create)

This page has no test yet. We add a focused render test, then make the field conditional.

- [ ] **Step 1: Write the failing test**

Create `src/pages/__tests__/HuntSuggestPage.test.js`:

```js
import { render, screen, waitFor } from '@testing-library/react';
import HuntSuggestPage from '../HuntSuggestPage';

// useParams is stubbed via the project's reactRouterDomStub; provide linkId.
jest.mock('react-router-dom', () => ({
  useParams: () => ({ linkId: 'test-link' }),
}));

function mockInfo(body) {
  global.fetch = jest.fn((url) => {
    if (String(url).includes('/api/hunt-suggest/info')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

afterEach(() => {
  jest.resetAllMocks();
});

test('shows password field when the link requires a password', async () => {
  mockInfo({ huntName: 'Hunt', open: true, requiresPassword: true });
  render(<HuntSuggestPage />);
  await waitFor(() =>
    expect(screen.getByText('Hunt')).toBeInTheDocument()
  );
  expect(document.querySelector('input[type=password]')).toBeInTheDocument();
});

test('hides password field when the link is open', async () => {
  mockInfo({ huntName: 'Hunt', open: true, requiresPassword: false });
  render(<HuntSuggestPage />);
  await waitFor(() =>
    expect(screen.getByText('Hunt')).toBeInTheDocument()
  );
  expect(document.querySelector('input[type=password]')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify the second case fails**

Run: `npm test -- --watchAll=false --testPathPattern=HuntSuggestPage`
Expected: the "hides password field" test FAILS (password input is currently always rendered).

- [ ] **Step 3: Make the password field conditional**

In `src/pages/HuntSuggestPage.js`:

(a) Update the `canSubmit` predicate (line ~53) from:

```js
  const canSubmit = name.trim() && password && filledSlots.length > 0 && !submitting;
```

to:

```js
  const requiresPassword = info?.requiresPassword !== false; // default to true until info loads
  const canSubmit =
    name.trim() &&
    (!requiresPassword || password) &&
    filledSlots.length > 0 &&
    !submitting;
```

(b) In `submit()`, build the body conditionally. Replace:

```js
        body: JSON.stringify({
          linkId,
          password,
          name: name.trim(),
          slots: filledSlots,
        }),
```

with:

```js
        body: JSON.stringify({
          linkId,
          ...(requiresPassword ? { password } : {}),
          name: name.trim(),
          slots: filledSlots,
        }),
```

(c) Wrap the password `<label>` block (the `<label className="block">` containing the `Lock` icon, lines ~186-210) in a conditional. Change the opening grid container so it only uses two columns when the password field is present. Replace:

```jsx
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-[10px] font-bold uppercase tracking-eyebrow-md text-white/65 mb-1.5 font-mono">
                    Your name <span className="text-emerald-signal">*</span>
                  </span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="your stream name"
                    className={inputCls}
                  />
                </label>
                <label className="block">
```

with:

```jsx
              <div
                className={`grid grid-cols-1 gap-3 ${
                  requiresPassword ? 'sm:grid-cols-2' : ''
                }`}
              >
                <label className="block">
                  <span className="block text-[10px] font-bold uppercase tracking-eyebrow-md text-white/65 mb-1.5 font-mono">
                    Your name <span className="text-emerald-signal">*</span>
                  </span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="your stream name"
                    className={inputCls}
                  />
                </label>
                {requiresPassword && (
                <label className="block">
```

Then find the matching close of that password `</label>` (immediately before the `</div>` that closes the grid, line ~210-211):

```jsx
                  <p className="text-[11.5px] text-white/45 mt-1.5">
                    It's in chat or on stream right now.
                  </p>
                </label>
              </div>
```

and change it to close the conditional:

```jsx
                  <p className="text-[11.5px] text-white/45 mt-1.5">
                    It's in chat or on stream right now.
                  </p>
                </label>
                )}
              </div>
```

(d) Update the helper text under the submit button (lines ~260-268) so it doesn't tell an open-link user to enter a password. Replace:

```jsx
              {!canSubmit && !submitting && (
                <p className="text-[11px] text-white/40 text-center font-mono">
                  {!name.trim()
                    ? 'Add your name to send.'
                    : !password
                      ? 'Enter the password to send.'
                      : 'Add at least one slot to send.'}
                </p>
              )}
```

with:

```jsx
              {!canSubmit && !submitting && (
                <p className="text-[11px] text-white/40 text-center font-mono">
                  {!name.trim()
                    ? 'Add your name to send.'
                    : requiresPassword && !password
                      ? 'Enter the password to send.'
                      : 'Add at least one slot to send.'}
                </p>
              )}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- --watchAll=false --testPathPattern=HuntSuggestPage`
Expected: both tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/HuntSuggestPage.js src/pages/__tests__/HuntSuggestPage.test.js
git commit -m "feat: hide password field on open collect-link submit page"
```

---

### Task A5: `HuntLinkControls.js` — "Require a password" toggle + link state

**Files:**
- Modify: `src/components/HuntLinkControls.js`

- [ ] **Step 1: Add the toggle to the create panel**

In `src/components/HuntLinkControls.js`, add a `linkRequiresPassword` prop and a `requirePw` toggle state. Change the function signature (line ~10-18):

```js
export default function HuntLinkControls({
  linkId,
  linkOpen,
  linkBusy,
  linkError,
  onCreateLink,
  onToggleLink,
  onDeleteLink,
}) {
  const [opening, setOpening] = useState(false);
  const [pw, setPw] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
```

to:

```js
export default function HuntLinkControls({
  linkId,
  linkOpen,
  linkBusy,
  linkError,
  linkRequiresPassword,
  onCreateLink,
  onToggleLink,
  onDeleteLink,
}) {
  const [opening, setOpening] = useState(false);
  const [pw, setPw] = useState('');
  const [requirePw, setRequirePw] = useState(false); // OFF by default
  const [confirmingDelete, setConfirmingDelete] = useState(false);
```

- [ ] **Step 2: Rework the create-panel body**

Replace the create-panel inner block — the `<>` fragment shown when `opening` is true (lines ~40-77, from `<p className="text-[11px] text-white/55 ...">` through the closing `</>`):

```jsx
          <>
            <p className="text-[11px] text-white/55 leading-snug">
              Set a password and share the link. Anyone with both can submit picks
              straight into this list.
            </p>
            <input
              type="text"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="Set a password (min 8 chars)"
              className={`w-full ${inputCls}`}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onCreateLink(pw)}
                disabled={linkBusy || pw.trim().length < 8}
                className="flex-1 px-3 py-2.5 bg-purple-gamba text-white-body hover:bg-purple-bright transition-colors duration-150 disabled:opacity-40"
              >
                <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
                  {linkBusy ? 'Creating…' : 'Create link'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpening(false);
                  setPw('');
                }}
                className="px-3 py-2.5 border border-white/10 text-white/60 hover:text-white-body transition-colors"
              >
                <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
                  Cancel
                </span>
              </button>
            </div>
            {linkError && <p className="text-red-destructive text-[11px]">{linkError}</p>}
          </>
```

with:

```jsx
          <>
            <p className="text-[11px] text-white/55 leading-snug">
              Share the link and anyone with it can submit picks straight into
              this list. Add a password if you want to gate it.
            </p>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={requirePw}
                onChange={(e) => setRequirePw(e.target.checked)}
                className="accent-purple-gamba w-3.5 h-3.5"
              />
              <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono text-white/70">
                Require a password
              </span>
            </label>
            {requirePw && (
              <input
                type="text"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="Set a password (min 8 chars)"
                className={`w-full ${inputCls}`}
              />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onCreateLink(requirePw ? pw : '')}
                disabled={linkBusy || (requirePw && pw.trim().length < 8)}
                className="flex-1 px-3 py-2.5 bg-purple-gamba text-white-body hover:bg-purple-bright transition-colors duration-150 disabled:opacity-40"
              >
                <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
                  {linkBusy ? 'Creating…' : 'Create link'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpening(false);
                  setPw('');
                  setRequirePw(false);
                }}
                className="px-3 py-2.5 border border-white/10 text-white/60 hover:text-white-body transition-colors"
              >
                <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
                  Cancel
                </span>
              </button>
            </div>
            {linkError && <p className="text-red-destructive text-[11px]">{linkError}</p>}
          </>
```

- [ ] **Step 3: Show the link's protection state in the existing-link panel**

In the existing-link panel, replace the static line (lines ~116-118):

```jsx
        <p className="text-[10px] text-white/40 font-mono">
          Password set when created. Recreate to change it.
        </p>
```

with:

```jsx
        <p className="text-[10px] text-white/40 font-mono">
          {linkRequiresPassword
            ? '🔒 Password protected · recreate to change'
            : '🔓 Open · anyone with the link can submit'}
        </p>
```

- [ ] **Step 4: Build check**

Run: `npm test -- --watchAll=false --testPathPattern=HuntSuggestPage`
Expected: still PASS (no regression; this file has no direct test, the build/compile is exercised by the suite import graph). If you prefer an explicit compile check, run `npm run build` and expect success.

- [ ] **Step 5: Commit**

```bash
git add src/components/HuntLinkControls.js
git commit -m "feat: optional-password toggle + link state on collect-link controls"
```

---

### Task A6: `HuntTracker.js` — allow open link, persist requiresPassword, pass prop

**Files:**
- Modify: `src/components/HuntTracker.js:557-583` and `:977-985`

- [ ] **Step 1: Persist intakeRequiresPassword on create**

In `src/components/HuntTracker.js`, in `createIntakeLink`, find (line ~576-577):

```js
      // Persist on the hunt so the link survives reloads + is owner-visible.
      updateHunt({ intakeLinkId: data.linkId, intakeOpen: true });
```

Replace with:

```js
      // Persist on the hunt so the link survives reloads + is owner-visible.
      // password === '' means an open link (no password gate).
      updateHunt({
        intakeLinkId: data.linkId,
        intakeOpen: true,
        intakeRequiresPassword: Boolean(password),
      });
```

(The function already takes `password`; an empty string flows through as an open link. The existing `PASSWORD_TOO_SHORT` handling stays — it's only reachable when the toggle is on.)

- [ ] **Step 2: Pass linkRequiresPassword into HuntLinkControls**

Find the `<HuntLinkControls ... />` usage (lines ~977-985) and add the prop:

```jsx
            <HuntLinkControls
              linkId={activeHunt.intakeLinkId || null}
              linkOpen={activeHunt.intakeOpen !== false}
              linkBusy={linkBusy}
              linkError={linkError}
              linkRequiresPassword={activeHunt.intakeRequiresPassword !== false && Boolean(activeHunt.intakeRequiresPassword)}
              onCreateLink={createIntakeLink}
              onToggleLink={toggleIntakeOpen}
              onDeleteLink={deleteIntakeLink}
            />
```

Note: `intakeRequiresPassword` is only meaningful when a link exists. For links created before this feature shipped (field absent), `Boolean(undefined)` → `false` → shows "Open" state. That is the safe/honest default: legacy links created under the old flow always had a password, but we cannot know it post-hoc, and the copy only affects the hint line, not behavior. Acceptable.

- [ ] **Step 3: Manual verification (dev server)**

Run: `npm start`. Log in as owner, start a hunt, open the Collect panel.
- Create link with toggle OFF → link created immediately, panel shows "🔓 Open".
- Open the `/hunt-suggest/<id>` URL in a private window → no password field, can submit.
- Kill link, recreate with toggle ON + 8-char password → panel shows "🔒 Password protected"; submit page shows the password field and rejects a wrong password.

- [ ] **Step 4: Commit**

```bash
git add src/components/HuntTracker.js
git commit -m "feat: support open collect links from the hunt tracker"
```

---

## FEATURE B — Per-hunt live-share preview card

### Task B1: `live-preview.js` — inject per-hunt OG tags

**Files:**
- Create: `api/live-preview.js`
- Test: `api/__tests__/livePreview.test.js` (create)

The function's testable core is the tag-injection + description-building logic. We factor those into pure exported helpers and unit-test them; the handler wires them to Firestore + the fetched HTML.

- [ ] **Step 1: Write the failing test for the pure helpers**

Create `api/__tests__/livePreview.test.js`:

```js
import { buildDescription, injectOgTags } from '../live-preview.js';

describe('buildDescription', () => {
  test('start balance + bonus count', () => {
    expect(
      buildDescription({ startBalance: 1200, bonuses: [{}, {}, {}] })
    ).toBe('$1,200 in the hunt · 3 bonuses collected');
  });

  test('singular bonus', () => {
    expect(
      buildDescription({ startBalance: 500, bonuses: [{}] })
    ).toBe('$500 in the hunt · 1 bonus collected');
  });

  test('no start balance omits the amount clause', () => {
    expect(buildDescription({ bonuses: [{}, {}] })).toBe('2 bonuses collected');
  });

  test('empty hunt falls back to a generic line', () => {
    expect(buildDescription({})).toBe('LIVE bonus hunt on GooferG');
  });
});

describe('injectOgTags', () => {
  const html =
    '<title>Goofer Live</title>' +
    '<meta property="og:title" content="GooferG" />' +
    '<meta property="og:description" content="streams, bonus hunts, clips and more." />' +
    '<meta property="og:url" content="https://goofer.tv" />' +
    '<meta name="twitter:title" content="GooferG" />' +
    '<meta name="twitter:description" content="streams, bonus hunts, clips and more." />';

  test('replaces title, description, and url tags', () => {
    const out = injectOgTags(html, {
      title: 'My Hunt — LIVE on GooferG',
      description: '$1,200 in the hunt · 3 bonuses collected',
      url: 'https://goofer.tv/live/abc',
    });
    expect(out).toContain('<title>My Hunt — LIVE on GooferG</title>');
    expect(out).toContain(
      '<meta property="og:title" content="My Hunt — LIVE on GooferG" />'
    );
    expect(out).toContain(
      '<meta property="og:description" content="$1,200 in the hunt · 3 bonuses collected" />'
    );
    expect(out).toContain(
      '<meta property="og:url" content="https://goofer.tv/live/abc" />'
    );
    expect(out).toContain(
      '<meta name="twitter:title" content="My Hunt — LIVE on GooferG" />'
    );
    expect(out).toContain(
      '<meta name="twitter:description" content="$1,200 in the hunt · 3 bonuses collected" />'
    );
  });

  test('escapes HTML-special characters in injected values', () => {
    const out = injectOgTags(html, {
      title: 'A & B "quote"',
      description: 'x',
      url: 'https://goofer.tv/live/abc',
    });
    expect(out).toContain('A &amp; B &quot;quote&quot;');
    expect(out).not.toContain('A & B "quote"');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --watchAll=false --testPathPattern=livePreview`
Expected: FAIL — `Cannot find module '../live-preview.js'` (or helpers undefined).

- [ ] **Step 3: Implement `api/live-preview.js`**

Create `api/live-preview.js`:

```js
import { adminDb } from './_lib/firebaseAdmin.js';

const SITE = 'https://goofer.tv';
const DEFAULT_TITLE = 'GooferG';

// --- pure helpers (unit-tested) ---

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return null;
  return '$' + num.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

// Build the OG description from a shared_hunts mirror doc.
// "$1,200 in the hunt · 3 bonuses collected"
export function buildDescription(mirror) {
  const amount = formatMoney(mirror?.startBalance);
  const count = Array.isArray(mirror?.bonuses) ? mirror.bonuses.length : 0;
  const parts = [];
  if (amount) parts.push(`${amount} in the hunt`);
  if (count > 0) parts.push(`${count} ${count === 1 ? 'bonus' : 'bonuses'} collected`);
  if (parts.length === 0) return 'LIVE bonus hunt on GooferG';
  return parts.join(' · ');
}

// Replace the title + OG/Twitter text tags in the built index.html.
// Values are HTML-escaped. Image tags are intentionally left untouched
// (static homepage image).
export function injectOgTags(html, { title, description, url }) {
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const u = escapeHtml(url);
  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${t}</title>`)
    .replace(
      /<meta property="og:title" content="[^"]*" \/>/,
      `<meta property="og:title" content="${t}" />`
    )
    .replace(
      /<meta property="og:description" content="[^"]*" \/>/,
      `<meta property="og:description" content="${d}" />`
    )
    .replace(
      /<meta property="og:url" content="[^"]*" \/>/,
      `<meta property="og:url" content="${u}" />`
    )
    .replace(
      /<meta name="twitter:title" content="[^"]*" \/>/,
      `<meta name="twitter:title" content="${t}" />`
    )
    .replace(
      /<meta name="twitter:description" content="[^"]*" \/>/,
      `<meta name="twitter:description" content="${d}" />`
    );
}

// --- handler ---

async function fetchIndexHtml() {
  // Fetch the deployed SPA shell over HTTPS. Robust against serverless
  // bundling not including the static build output on disk.
  const r = await fetch(`${SITE}/index.html`, {
    headers: { 'User-Agent': 'goofer-live-preview' },
  });
  if (!r.ok) throw new Error(`index fetch ${r.status}`);
  return r.text();
}

export default async function handler(req, res) {
  // Derive shareId from the path: /live/<shareId>
  const path = (req.url || '').split('?')[0];
  const shareId = decodeURIComponent(path.replace(/^\/live\//, '').replace(/\/$/, ''));

  let html;
  try {
    html = await fetchIndexHtml();
  } catch (err) {
    // Can't even get the shell — let Vercel's static routing take over by
    // 404'ing into the SPA is not possible here, so return a minimal page.
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(
      `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${SITE}/live/${encodeURIComponent(
        shareId
      )}"></head><body></body></html>`
    );
  }

  // Best-effort enrichment. Any failure → return the unmodified shell so a
  // human visitor still gets the working SPA (generic homepage card).
  try {
    if (!shareId) throw new Error('no shareId');
    const snap = await adminDb.doc(`shared_hunts/${shareId}`).get();
    if (!snap.exists) throw new Error('not found');
    const mirror = snap.data();
    const title = `${mirror?.name || 'Bonus hunt'} — LIVE on GooferG`;
    const description = buildDescription(mirror);
    const url = `${SITE}/live/${encodeURIComponent(shareId)}`;
    html = injectOgTags(html, { title, description, url });
  } catch {
    // fall through with the unmodified shell
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Short cache: unfurlers cache on their own; this just smooths repeat hits.
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
  return res.status(200).send(html);
}
```

Note: `DEFAULT_TITLE` is referenced for clarity of intent but only the per-hunt title is injected; if you prefer, drop the unused const. Leaving it out is fine — remove the `const DEFAULT_TITLE` line to avoid an unused-var lint warning.

- [ ] **Step 4: Remove the unused constant**

Delete the line `const DEFAULT_TITLE = 'GooferG';` from `api/live-preview.js` (not referenced anywhere; would trip the `react-app` ESLint no-unused-vars in build of `/api`? — `/api` is not linted by CRA, but keep it clean). 

- [ ] **Step 5: Run the helper tests to verify they pass**

Run: `npm test -- --watchAll=false --testPathPattern=livePreview`
Expected: all `buildDescription` + `injectOgTags` tests PASS.

- [ ] **Step 6: Commit**

```bash
git add api/live-preview.js api/__tests__/livePreview.test.js
git commit -m "feat: live-share OG preview function with per-hunt tags"
```

---

### Task B2: `vercel.json` — route /live/:shareId to the function

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Add the rewrite before the SPA catch-all**

Replace the contents of `vercel.json` with:

```json
{
  "rewrites": [
    { "source": "/live/:shareId", "destination": "/api/live-preview" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ],
  "crons": [
    { "path": "/api/cron/award-watchtime", "schedule": "*/5 * * * *" }
  ]
}
```

Order matters: Vercel applies the first matching rewrite, so `/live/:shareId`
must precede the catch-all. `/live` with no id is not matched by the first rule
and falls through to the SPA.

- [ ] **Step 2: Commit**

```bash
git add vercel.json
git commit -m "feat: route /live/<id> through the OG preview function"
```

- [ ] **Step 3: Post-deploy manual verification**

After deploying to a Vercel preview:
- Open `https://<preview>/live/<a-real-shareId>` in a browser → the hunt page
  still loads normally (SPA boots).
- View source → `<title>` and `og:*`/`twitter:*` text reflect the hunt.
- Paste the URL into the OpenGraph debugger (or a Discord test channel) → card
  shows `<Hunt> — LIVE on GooferG` + `$X in the hunt · N bonuses collected`.
- Open `https://<preview>/live/<garbage-id>` → falls back to the generic
  homepage card, page still loads.

---

## Notes for the implementer

- **Dev proxy:** `src/setupProxy.js` mirrors some `/api/*` routes for `npm start`. Feature B's `/live-preview` is only exercised by real unfurlers against a deployed build — **do not** add a dev mirror for it. Feature A's `manage`/`submit`/`info` already run via `vercel dev` or the existing proxy; no proxy change needed.
- **No new dependencies.** Node 18+ on Vercel provides global `fetch`. `firebase-admin` and `crypto` are already used by `/api`.
- **`/api` is not linted by CRA**, so the helper exports in `live-preview.js` are safe; they exist for unit testing.
- **Legacy collect links** (created before Feature A) have a `passwordHash` and keep requiring a password — fully backward compatible. Their owner-side hint may read "Open" only if `intakeRequiresPassword` was never stored; behavior is unaffected.

---

## Self-Review

**Spec coverage:**
- A: optional password create (A1), open-link submit (A2), info flag (A3), submit-page field (A4), owner toggle + state (A5), tracker persistence + prop (A6). ✓
- B: serverless fn (B1), routing (B2), static image (left untouched → homepage image, per spec). ✓
- Security note (existing guards only) — no code, documented. ✓
- Stat-freshness caveat — documented, no code. ✓

**Deviations from spec (intentional, more robust):**
- B reads `index.html` by HTTPS fetch of the deployed shell rather than the filesystem — avoids relying on serverless bundling of static output. Same result, no design change.

**Placeholder scan:** none — every code step shows full code.

**Type/name consistency:** `intakeRequiresPassword` (tracker ↔ controls prop `linkRequiresPassword`), `requiresPassword` (info ↔ submit page), `buildDescription`/`injectOgTags` (fn ↔ test) all consistent.
