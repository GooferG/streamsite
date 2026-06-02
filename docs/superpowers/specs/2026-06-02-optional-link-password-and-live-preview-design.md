# Optional collect-link password + per-hunt live-share preview

Date: 2026-06-02

Two independent changes to the hunt tracker's two share links:

- **Feature A** — make the password on the *collect link* (`/hunt-suggest/<id>`)
  optional instead of mandatory.
- **Feature B** — give the *live-share link* (`/live/<shareId>`) a per-hunt
  social preview (Open Graph) card so pasting it into Discord/Twitch/Twitter
  shows the hunt name + stats instead of the generic site card.

The two features touch disjoint files and can be built/shipped independently.

---

## Background — current state

Two separate links exist on an active hunt:

| Link | Route | Backing store | Purpose |
|------|-------|---------------|---------|
| Collect link | `/hunt-suggest/<linkId>` | `suggestion_intakes/<linkId>` (server-only, admin SDK) | Viewers submit slot picks into the owner's active hunt. |
| Live-share link | `/live/<shareId>` | `shared_hunts/<shareId>` (public Firestore mirror) | Read-only live view of the hunt. |

Collect link today **forces** a password: `manage.js` `create` rejects
`password.length < 8`; `submit.js` always hashes + compares; the public
`HuntSuggestPage` always shows a required password field.

Live-share link today has **no per-hunt preview**: `vercel.json` rewrites
everything non-`/api` to the static `index.html`, whose OG tags are the generic
homepage card (`goofer.tv` / `homepage-share.jpg`).

---

## Feature A — Optional password on the collect link

### Goal

Owner decides per-link whether a password is required. Default = **no
password** (open link). Password is still set at create time only — to change or
add/remove it, delete the link and recreate. No live password editing.

### Data model

`suggestion_intakes/<linkId>` doc:

- **Password-protected link:** has `passwordHash` + `passwordSalt` (as today).
- **Open link:** these two fields are **absent**. Absence *is* the "open"
  state — no separate flag, nothing that can disagree with the hash's presence.

Owner-side, the active hunt doc gains `intakeRequiresPassword: boolean`, stored
next to the existing `intakeLinkId` / `intakeOpen`, so the owner UI can show the
link's protection state after a reload without an extra server read.

### Server changes

**`api/hunt-suggest/manage.js` — `create` action**
- Remove the unconditional `password.length < 8 → 400`.
- New rule:
  - `password` non-empty → enforce min length 8 (`PASSWORD_TOO_SHORT` on miss),
    hash + store `passwordHash`/`passwordSalt` as today.
  - `password` empty/absent → create the doc with **no** hash/salt fields.
- Idempotent-reuse branch (existing open link for this owner): apply the same
  rule. When the new request supplies a password, set hash/salt; when it does
  not, **delete** any existing `passwordHash`/`passwordSalt` (via
  `FieldValue.delete()`) so re-creating as open clears a stale password.
- Response unchanged shape (`{ ok, linkId, open }`).

**`api/hunt-suggest/submit.js`**
- After loading the intake doc: if it has **no** `passwordHash`, skip the
  password check entirely and proceed to the transaction.
- If it has a `passwordHash`, behavior is unchanged (timing-safe compare,
  `BAD_PASSWORD` on mismatch).
- All other guards (open/closed, cooldown, 300 cap, same-name overwrite) are
  unchanged and apply to open links too.

**`api/hunt-suggest/info.js`**
- Add `requiresPassword: Boolean(data.passwordHash)` to the JSON response.
- Still never returns the hash/salt or owner uid.

### Client changes

**`src/pages/HuntSuggestPage.js`** (public submit page)
- Read `info.requiresPassword`.
- When `false`:
  - Hide the password field + its "it's in chat" helper line.
  - Drop `password` from the `canSubmit` predicate.
  - Omit `password` from the submit request body.
  - Collapse the name/password two-column grid to a single name field.
- When `true`: unchanged.

**`src/components/HuntLinkControls.js`** (owner control)
- Create panel: add a **"Require a password"** toggle, **OFF by default**.
  - Off → password input hidden; "Create link" enabled immediately; calls
    `onCreateLink('')`.
  - On → password input shown; "Create link" gated on `pw.trim().length >= 8`
    (today's behavior); calls `onCreateLink(pw)`.
- Existing-link panel: replace the static "Password set when created. Recreate
  to change it." line with the link's actual protection state, driven by a new
  `linkRequiresPassword` prop:
  - `true` → `🔒 Password protected`
  - `false` → `🔓 Open — anyone with the link`
  - Keep the "recreate to change" hint.

**`src/components/HuntTracker.js`**
- `createIntakeLink(password)`: `password` may be an empty string (open link).
  On success, persist `intakeRequiresPassword: Boolean(password)` alongside
  `intakeLinkId` / `intakeOpen` via `updateHunt`.
- Pass `linkRequiresPassword={activeHunt.intakeRequiresPassword}` into
  `HuntLinkControls`.
- `PASSWORD_TOO_SHORT` error handling stays (only reachable when the toggle is
  on).

### Security note (open links)

An open collect link means anyone with the unguessable 24-char `linkId` can
submit picks into the live hunt. Accepted — existing guards are deemed
sufficient: unguessable capability URL, 300-submitter cap, 5s per-name
cooldown, same-name overwrite, and the owner's Close/Kill toggle. No new
rate-limiting. Owner closes the link if abused.

---

## Feature B — Per-hunt live-share preview card

### Goal

Pasting `https://goofer.tv/live/<shareId>` into a chat/social app shows a card
reflecting that hunt:

- **Title:** `<Hunt Name> — LIVE on GooferG`
- **Description:** `$<startBalance> in the hunt · <N> bonuses collected`
  (e.g. `$1,200 in the hunt · 8 bonuses collected`)
- **Image:** the existing static `homepage-share.jpg` (a dedicated branded
  `live-share.jpg` is an optional later upgrade; not required for this feature).

This is **static image + dynamic text** — no per-hunt image generation, no new
dependencies. The numbers live in the description text.

### Routing — `vercel.json`

Add a rewrite for the live route **before** the existing catch-all (Vercel
takes the first matching rewrite):

```json
{
  "rewrites": [
    { "source": "/live/:shareId", "destination": "/api/live-preview" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

`/live` with no id is not matched by the first rule and falls through to the
SPA, unchanged. `crons` block is untouched.

### New serverless function — `api/live-preview.js`

Request handling for every `/live/<shareId>` hit (crawlers **and** browsers —
no user-agent sniffing):

1. Extract `shareId` from the request path.
2. Read `shared_hunts/<shareId>` via the admin SDK (`adminDb`, same as the
   hunt-suggest functions).
3. Read the built `index.html` from the deployment's filesystem at runtime
   (resolve the path relative to the function; the file is part of the build
   output served by the deploy).
4. Compute the description figures from the mirror doc:
   - amount = `startBalance` (the buy-in), formatted as currency (`$1,200`).
   - count = `Array.isArray(bonuses) ? bonuses.length : 0`.
5. String-replace the head tags in the HTML:
   - `<title>`
   - `og:title`, `twitter:title`
   - `og:description`, `twitter:description`
   - `og:url` → `https://goofer.tv/live/<shareId>`
   - (image tags left as-is → homepage image)
6. Return the modified HTML with `Content-Type: text/html`. React boots
   normally on top — no behavior change for human visitors.

**Fallbacks (never 500 a page a human may be opening):**
- Doc missing / `NOT_FOUND` / read error / hunt already ended → return the
  **unmodified** `index.html` (generic homepage card).
- Missing `startBalance` → omit the amount clause; description becomes
  `<N> bonuses collected` (or `LIVE bonus hunt` if count is 0 too).

### Stat freshness (documented, not coded)

OG unfurlers cache the card on first fetch. The mirror updates live in
Firestore, but the preview reflects the stats at first-unfurl time until the
unfurler's cache expires or the link is re-pasted/cache-busted. This is
inherent to OG previews and is accepted as-is.

### No client changes

The live-share copy button in `HuntTracker.js` already produces
`/live/<shareId>`; nothing on the client changes for Feature B.

---

## Out of scope

- Live password editing on an existing link (set-at-create only).
- Per-IP / global rate limiting on open collect links.
- Dynamically rendered per-hunt preview *image* (numbers painted on the
  picture) — explicitly deferred; would require `@vercel/og`/satori + fonts +
  caching.
- A preview card for the collect link (`/hunt-suggest`) — only the live-share
  link gets one.

## Testing

- **A — server:** unit-cover `manage.js` create (open vs. password, reuse-clears
  -password) and `submit.js` (open link bypasses check; protected link still
  enforces). These are Vercel handlers; test the pure hash/branch logic where
  factored out.
- **A — client:** `HuntSuggestPage` hides/show password field by
  `requiresPassword`; `HuntLinkControls` toggle gates the create button
  correctly.
- **B:** `live-preview` produces per-hunt tags for a present mirror doc and
  falls back to the untouched HTML for a missing doc. Manually verify a real
  unfurl (Discord paste / opengraph debugger) against a deployed preview URL.
