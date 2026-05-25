# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`goofer-live` — Create React App frontend for a Twitch streamer (GooferG). Tailwind + React 19 + react-router-dom v7. Deployed on Vercel; serverless functions in `/api`. Firebase (Auth + Firestore) powers the admin panel and Twitch-linked viewer login.

## Commands

- `npm start` — dev server on `localhost:3000` with proxy (`src/setupProxy.js`) for `/api/public` (bonushunt.gg) and dev mirrors of `/api/bonus-hunts` and `/api/slots`. Vercel serverless functions in `/api` only run in production unless you use `vercel dev`.
- `npm run build` — production build to `build/`.
- `npm test` — Jest watch mode (react-scripts). Single test: `npm test -- --testPathPattern=Foo` or `--watchAll=false` for one-shot run. No tests currently exist.
- Env: copy `.env.example` to `.env.local`. `REACT_APP_*` vars exposed to client (Firebase config, Twitch client id); non-prefixed vars (`TWITCH_CLIENT_SECRET`, `STEAM_API_KEY`, `FIREBASE_PRIVATE_KEY`, etc.) are server-only and consumed by `/api/*` functions.

## Architecture

### Routing & Shell

- `src/App.js` is the single shell. Mounts `<AuthProvider>` (Firebase email/password admin) wrapping `<TwitchAuthProvider>` (Twitch OAuth → Firebase custom token for viewers).
- All routes declared inline in `App.js`. `/admin/*` uses `AdminLayout` as an outlet guard; `/gamba/*` uses `GambaPage` as an outlet with sub-route ids the page reads from the URL.
- Top-level effect polls Twitch every 120s for stream/clips/videos/channel/followers, then passes the data down via props (no global store). When adding pages that need stream data, prefer props from `App.js` over re-fetching.

### Firebase (`src/config/firebase.js`)

- One Firebase app, exporting `auth` and `db` (Firestore).
- Admin email is `luimeneghim@gmail.com` (referenced in Firestore rules and `/admin` login).
- Schedule data lives at Firestore `settings/schedule`. `src/hooks/useSchedule.js` subscribes via `onSnapshot` and falls back to `SCHEDULE` constant in `src/constants.js` if the doc is missing or read fails. The constant is the source of truth for shape; Firestore is the source of truth for live values.

### Auth — two systems

- **`AuthContext`** — admin email/password sign-in for `/admin/*` pages.
- **`TwitchAuthContext`** — viewer login. Browser redirects to Twitch OAuth → `/twitch-callback` → POST to `/api/twitch-auth` → server exchanges code, creates Firebase custom token via `firebase-admin`, client calls `signInWithCustomToken`. Both contexts share the same Firebase `auth` instance, so `onAuthStateChanged` fires for either; differentiate by checking custom claims (`twitchName`) or which context initiated the login.

### Serverless API (`/api`)

All files are Vercel function handlers (`export default async function handler(req, res)`). Common pattern: set CORS headers, handle `OPTIONS`, validate method, proxy upstream, return JSON. Notable:

- `twitch-token.js` — client-credentials token for public Twitch reads.
- `twitch-auth.js` — OAuth code exchange + mints Firebase custom token. Requires `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (newlines as `\n` in env, code unescapes).
- `bonus-hunts.js` — proxies `bonushunt.gg/api/public/*`, with 5-min in-memory cache and stale-on-error fallback. **API key is hardcoded in the file** (same key also appears in `src/setupProxy.js` for dev). Treat as known secret in repo when handling.
- `slots.js` — proxies slotslaunch.com with allowlisted path param (`games|providers|types|themes`).
- `game-cover.js`, `steam-games.js`, `steam-library.js` — IGDB / Steam Web API proxies.

### Dev vs prod proxying

- `src/setupProxy.js` only runs under `npm start`. It mirrors the production Vercel handlers for `/api/bonus-hunts` and `/api/slots` and adds a raw `/api/public` proxy for legacy direct calls. Keep this file in sync when changing the matching `/api/*.js` function signature.

### Twitch data flow

- `src/utils/twitchApi.js` calls `/api/twitch-token` then hits `helix/*` directly from the browser using `TWITCH_CLIENT_ID` from `src/constants.js`. Username (`GooferG`) is hardcoded in `constants.js`.

### Misc

- `vercel.json` rewrites everything except `/api/*` to `index.html` for SPA routing.
- Tailwind configured in `tailwind.config.js`; styles in `src/index.css` + per-component classes. App.js also has a `<style jsx>` block with keyframes used across pages (`grain`, `float`, `glow`, `slideUp`).
- `package.json` has no lint script; ESLint runs only via `react-scripts start`/`build` using the `react-app` preset.

## Conventions

- Pages live in `src/pages/`, presentational components in `src/components/`. Page files are large (300–500 lines) — inline styles and route-specific subcomponents are normal.
- Schedule shape: `{ day, time, content, status: 'regular'|'off'|'special', gameName }` — keep `gameName` matching IGDB exactly when adding entries; `null` disables cover lookup.
- Commit style: short imperative subject lines (see `git log`). Per global instruction, do not add `Co-Authored-By` trailers.

## Gotchas

- Two API keys are committed in `api/bonus-hunts.js` and `src/setupProxy.js`. Rotating them requires updating both locations.
- `FIREBASE_SETUP.md` step 9's "Update Your App.js" snippet is stale — the app already uses react-router routes for `/admin`, not the `setPage` state pattern shown there.
- `src/components/` has both `GameWheel.js` and `GameWheel.jsx` — verify which is imported before editing.

## Design Context

Strategic design context lives in [PRODUCT.md](PRODUCT.md) (visual tokens in `DESIGN.md` when present). Read it before UI work.

- **Register:** brand. `/gamba/*` and `/admin/*` override to product register per-task.
- **Personality:** irreverent, gritty, warm — late-night CRT / Adult Swim cable-bumper energy. Not gamer-esports-modern, not vaporwave.
- **Hard anti-references:** generic Twitch-purple panel template; SaaS landing (hero stat + 3-card grid + gradient text); casino chrome (gold/red slot UI); cyberpunk drift (neon green on black + glitch text).
- **Principles:** atmosphere over information density · in-jokes welcome, gatekeeping not · imperfection on purpose but performance stays tight · tools earn their visual weight (utility surfaces can look denser/less atmospheric than marketing pages).
- **A11y:** best-effort, no formal WCAG target. Keep body copy legible on dark gradient; honor `prefers-reduced-motion` where feasible; nav/forms/admin stay keyboard-navigable.
