# Game Suggestions Feature — Design Spec
**Date:** 2026-04-19

## Overview
Viewers log in with Twitch OAuth to suggest a slot/game during gambling streams. The streamer sees all suggestions in an admin panel, can highlight a picked game, remove individuals, or clear all. A separate browser-source route displays suggestions live in OBS.

---

## External Setup Required (instructions for streamer)

### 1. Twitch Developer Application
1. Go to https://dev.twitch.tv/console/apps and click **Register Your Application**.
2. Name: `goofer-live` (or anything).
3. OAuth Redirect URL: `https://goofer.tv/twitch-callback` (and `http://localhost:3000/twitch-callback` for dev).
4. Category: **Website Integration**.
5. Copy the **Client ID** — you'll need it as `REACT_APP_TWITCH_CLIENT_ID`.
6. Generate a **Client Secret** — you'll need it as `TWITCH_CLIENT_SECRET` (server-side only, never in frontend).

### 2. Firebase Admin SDK
1. In Firebase Console → Project Settings → Service Accounts → **Generate new private key**.
2. Download the JSON file.
3. Add these to your Vercel environment variables (never commit them):
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY` (the full private key string, keep newlines as `\n`)

### 3. Firestore Security Rules
Add these rules in Firebase Console → Firestore → Rules:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /suggestions/{twitchId} {
      // Anyone can read (overlay is public)
      allow read: true;
      // Only the authenticated user can write their own doc
      allow create, update: if request.auth != null
        && request.auth.uid == twitchId
        && request.resource.data.keys().hasAll(['twitchId','twitchName','gameName','status','createdAt'])
        && request.resource.data.gameName.size() <= 100;
      // Only admin (your Firebase email/password account) can delete
      allow delete: if request.auth != null
        && request.auth.token.email == 'YOUR_ADMIN_EMAIL';
    }
  }
}
```
Replace `YOUR_ADMIN_EMAIL` with the email you use for `/admin` login.

### 4. Environment Variables (add to Vercel + local `.env`)
```
REACT_APP_TWITCH_CLIENT_ID=...
TWITCH_CLIENT_SECRET=...          # server-side only
FIREBASE_PROJECT_ID=...           # server-side only
FIREBASE_CLIENT_EMAIL=...         # server-side only
FIREBASE_PRIVATE_KEY=...          # server-side only
```

---

## Architecture

### API: `/api/twitch-auth.js`
- Receives `?code=` from Twitch OAuth redirect.
- Exchanges code for Twitch access token via `https://id.twitch.tv/oauth2/token`.
- Fetches viewer profile from `https://api.twitch.tv/helix/users`.
- Mints a Firebase custom token using Firebase Admin SDK with `uid = twitchId`.
- Returns `{ firebaseToken, twitchId, displayName, profileImageUrl }`.
- New dependency needed: `firebase-admin` (server-side only in api/).

### Firestore: `suggestions` collection
Each document is keyed by `twitchId`:
```
{
  twitchId: string,
  twitchName: string,
  rainbetName: string | null,
  gameName: string,
  status: 'pending' | 'highlighted',
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```
One doc per viewer enforced by doc ID = twitchId.

### New React Files
- `src/contexts/TwitchAuthContext.js` — manages Twitch/Firebase login state. Exposes `twitchUser`, `loginWithTwitch()`, `logout()`.
- `src/components/SuggestPanel.js` — viewer-facing suggestion form. Shown on a new `/suggest` route (public page). Login with Twitch → submit/edit game name + optional Rainbet username.
- `src/pages/SuggestOverlay.js` — OBS browser source at `/suggest-overlay`. Reads `suggestions` via `onSnapshot`. Scrolling list, highlighted entries styled green. No auth, dark transparent background for OBS chroma key.
- `src/components/SuggestAdminTab.js` — admin tab content for GambaPage. Real-time list, highlight toggle, individual delete, clear-all button.

### Profanity Filter
Use the `bad-words` npm package on the client before submitting. Filter applied to `gameName` field only. If flagged, show inline error — do not submit.

### Modified Files
- `src/App.js` — add `/suggest` and `/suggest-overlay` routes. Wrap app in `TwitchAuthProvider`.
- `src/pages/GambaPage.js` — add "Suggest" tab button + render `SuggestAdminTab` when active.

---

## Component Behaviours

### SuggestPanel (viewer-facing, `/suggest`)
- Shows "Login with Twitch" button if not authenticated.
- Twitch OAuth uses PKCE-style redirect: viewer clicks → redirected to Twitch → redirected back to `/twitch-callback` → calls `/api/twitch-auth` → signs into Firebase → back to `/suggest`.
- After login: form with game name input + optional Rainbet username.
- If viewer already has a suggestion: pre-fills form with existing values (edit mode).
- Submit fires Firestore `setDoc` (upsert by twitchId).
- Profanity check client-side before write.
- One suggestion per viewer — updating replaces the existing doc.

### SuggestOverlay (`/suggest-overlay`)
- Minimal layout, dark semi-transparent background (`bg-black/80`).
- Header: "GAME SUGGESTIONS" in stream-friendly font.
- List of suggestions, newest first, auto-scrolls if > N entries.
- Each row: Twitch avatar (small), twitchName, gameName, rainbetName (if present).
- Highlighted (`status === 'highlighted'`): green border + green badge "PICKED".
- No controls — read-only.
- Refreshes in real-time via Firestore `onSnapshot`.

### SuggestAdminTab (inside GambaPage, admin-only view)
- Same styling as other GambaPage panels (emerald/purple gradient, `bg-white/5` cards).
- Live list via `onSnapshot`.
- Each row: twitchName, gameName, rainbetName, timestamp. Actions: highlight toggle (star/check icon), delete (X icon).
- Top bar: suggestion count + "Clear All" button (with confirmation).
- Clear All uses a batched Firestore delete.

---

## Routing
```
/suggest            → SuggestPanel (public)
/twitch-callback    → TwitchCallbackPage (handles OAuth redirect, then redirects to /suggest)
/suggest-overlay    → SuggestOverlay (public, OBS browser source)
```

---

## New Dependencies
- `firebase-admin` — server-side only (api/ functions), for minting custom tokens.
- `bad-words` — client-side profanity filter.

Both need `npm install firebase-admin bad-words`.

---

## What Is NOT in Scope
- Twitch chat bot integration (suggestions are web-only).
- Voting/upvoting on suggestions.
- Per-stream sessions (clear manually resets the list).
