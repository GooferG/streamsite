# Spec — Dynamic OG share cards (live hunt + suggest link)

**Date:** 2026-06-05
**Branch:** continues on `feat/hunt-tracker-redesign`
**Handoff:** `docs/redesign/design_handoff_share_card/` (CardMinimal is the chosen design; `CardBroadcast`/`CardScoreboard` are reference-only).

## Goal
When a streamer shares a hunt link in Discord/Twitter/Twitch chat, the unfurl shows a **per-hunt 1200×630 card with live data**, not the generic homepage image. Two surfaces:
- **Live hunt** — `goofer.tv/live/:shareId` (the spectator mirror). Card: name + start + bonus count.
- **Suggest link** — `goofer.tv/hunt-suggest/:linkId` (the public submission page). Card: name + picks-in + callers, inviting participation.

Both reuse **one parameterized CardMinimal template** (`variant: 'live' | 'suggest'`), rendered server-side via `@vercel/og` (Satori).

## Decisions locked (from brainstorming)
- **Renderer:** `@vercel/og` (Satori). Port CardMinimal to JSX with the handoff's hex tokens (Satori supports no `oklch`/`color-mix`/`box-shadow`).
- **Runtime/data:** standard **Node** serverless function (not edge) + **`firebase-admin`** (`adminDb`), consistent with the rest of `api/`. `@vercel/og` exports a Node-compatible `ImageResponse`.
- **Fonts:** bundled in the repo (`api/og/fonts/*.ttf`), read from disk — no per-request CDN fetch. Space Grotesk Bold (title/values), JetBrains Mono Medium/SemiBold (labels/CTA/channel).
- **Freshness:** cache-bust `og:image` with `?v={updatedAt}` from the data doc (the mirror/intake already carry a timestamp). Reshare after a change → new URL → fresh card. Document that an already-posted embed won't live-refresh.
- **One template, two variants** (table below). Suggest card reuses the CardMinimal layout with swapped kicker/stats/CTA.
- **Suggest unfurl:** a **parallel** `api/hunt-suggest/preview.js` (mirrors `api/live-preview.js`), wired via `vercel.json` rewrite — not a generalization of the live handler.

## Card variants (one CardMinimal, parameterized)
| Slot | `live` | `suggest` |
|---|---|---|
| Live pill | red `LIVE` | green `OPEN` |
| Channel id (top-right) | `GOOFERG · CH 02` | `GOOFERG · CH 02` |
| Kicker | `BONUS HUNT · LIVE NOW` (emerald) | `SUGGEST SLOTS · OPEN` (emerald) |
| Title | `{huntName}` | `{huntName}` |
| Stat 1 | `START` / `{$start}` | `PICKS IN` / `{totalPicks}` |
| Stat 2 | `BONUSES SO FAR` / `{bonusCount}` | `CALLERS` / `{peopleCount}` |
| CTA | `goofer.tv/live →` | `goofer.tv · drop yours →` |

Card props: `{ variant, huntName, statA: {label, value}, statB: {label, value}, pill: {text, tone}, cta }` — the endpoint computes the variant-specific strings and passes a uniform prop shape, so `CardMinimal` itself is variant-agnostic (just renders the slots).

## Architecture

### Shared: the card component + renderer
- **`api/og/CardMinimal.js`** — a function returning the Satori JSX tree for the card, given the uniform props above. Pure (no data access). Uses inline flex styles + hex tokens from the handoff. Title clamps to 2 lines / drops to ~84px when `huntName.length > 18`.
- **`api/og/render.js`** — loads the bundled fonts (once per cold start, cached in module scope) and calls `new ImageResponse(CardMinimal(props), { width: 1200, height: 630, fonts, headers })`. Returns the `ImageResponse`. Centralizes font-loading + size + cache headers so both endpoints share it.
- **`api/og/fonts/*.ttf`** — committed font files.
- **`api/og/cardProps.js`** — pure mappers: `liveCardProps(mirror)` and `suggestCardProps(intake, hunt)` → the uniform card-prop shape. Unit-testable without Satori. Reuses `formatMoney` from `livePreviewFormat.js`.

### Feature A — live hunt card
- **`api/og/live/[shareId].js`** (Node) — read `shared_hunts/:shareId` via `adminDb`; if missing → fallback props (generic "LIVE bonus hunt", no name); call `liveCardProps` → `render`. Always 200 (a 404 image breaks the embed). `Cache-Control: public, max-age=30, stale-while-revalidate=300`.
- **`api/_lib/livePreviewFormat.js`** — extend `injectOgTags` to also replace `og:image` / `og:image:secure_url` / `twitter:image` with the card URL, and set `og:image:width=1200` / `height=630` / `og:image:type=image/png`. Add `buildImageUrl(kind, id, version)` → `${SITE}/api/og/${kind}/${id}?v=${version}`.
- **`api/live-preview.js`** — pass `shareId` + `mirror.updatedAt` so `injectOgTags` can build the image URL.

### Feature B — suggest link card
- **`api/og/suggest/[linkId].js`** (Node) — read `suggestion_intakes/:linkId`; if missing/closed → fallback props; else read the owner's `users/{ownerUid}/active_hunt/current`, compute `totalPicks` (sum of `suggestions[].slots.length`) + `peopleCount` (`suggestions.length`); `suggestCardProps` → `render`. Same caching + always-200 rule.
- **`api/hunt-suggest/preview.js`** (Node, new) — mirrors `api/live-preview.js`: fetch the SPA shell, read the intake (huntName/open), inject title (`Suggest slots for {huntName} — GooferG`) + description (`{totalPicks} picks in · {peopleCount} callers · drop yours`) + the suggest image URL (`?v={intake.updatedAt || hunt.updatedAt}`). Best-effort: any failure → unmodified shell.
- **`vercel.json`** — add a rewrite so crawlers hitting `/hunt-suggest/:linkId` get `api/hunt-suggest/preview.js` (mirroring the `/live/:shareId → api/live-preview` rewrite). Must NOT break the human SPA route (the preview returns the SPA shell with injected tags, so humans still get the React app — same as live-preview).

> NOTE on the existing rewrite: `vercel.json` currently rewrites `/live/:shareId` to `/api/live-preview` and everything-except-`/api/` to `index.html`. Adding `/hunt-suggest/:linkId → /api/hunt-suggest/preview` follows the same shape. Confirm the suggest SPA route still renders for humans (preview.js returns the shell).

### Version/freshness token
- Live: `shared_hunts` mirror has `updatedAt` (written by `buildMirror` on every change). Use it.
- Suggest: the intake doc + the active hunt both change over time. Use `intake.updatedAt` if present, else the hunt's `updatedAt`, else a coarse fallback (e.g. omit `?v` → card still renders, just cached longer). Confirm/where-needed add an `updatedAt` bump on suggestion writes (the submit/skip paths already call `updateHunt`/`updateSuggestions`; if the active hunt doc gets a server timestamp on those writes, that's the freshness source — otherwise fall back to a minute-bucket for the suggest card only).

## Dependency
- Add **`@vercel/og`** to `package.json`. **Task 1 of the plan must validate it renders a PNG in a Node function locally** (fail-fast); if our Vercel/CRA setup rejects it, the fallback is a Playwright screenshot route (heavier) — but proceed on Satori unless validation fails.
- `vercel.json` may need `functions: { "api/og/**": { "includeFiles": "api/og/fonts/**" } }` so the font files ship with the function bundle. Verify during Task 1.

## Edge cases
- **Long hunt name** — title clamps to 2 lines or ~84px when `> 18` chars (Satori). Verify with `Sunday $2K Sendoff`.
- **`bonusCount`/`totalPicks` = 0** — show `0`; card still valid.
- **Not found / ended / closed** (bad id, hunt ended, intake closed) — generic fallback card, **200**.
- **Font read fails** — render with Satori default rather than erroring (still return a card).
- **`/api/og/*` routing** — the existing `/((?!api/).*)` rewrite already excludes `/api/`, so the og endpoints are reachable. Confirm.
- **Suggest card while hunt private/no active hunt** — intake exists but no active hunt → fallback card (name from intake if available, zeroed stats).

## Testing
- `cardProps.js` (pure): `liveCardProps(mirror)` and `suggestCardProps(intake, hunt)` — name/stat derivation, fallbacks, money formatting, zero counts. Repo convention (`toBeTruthy`, no jest-dom — though these are plain assertions on objects).
- `livePreviewFormat.js` (extend existing test): `buildImageUrl` output; `injectOgTags` now replaces `og:image`/dimensions; missing version still yields a valid URL.
- A suggest-description formatter (if added to `livePreviewFormat` or a sibling) — unit-tested like `buildDescription`.
- **Manual (Satori render):** run `vercel dev`, hit `/api/og/live/:shareId` and `/api/og/suggest/:linkId`, eyeball the PNGs against `Hunt Tracker Live Card.html`. Verify the unfurl end-to-end by pasting a `/live/:shareId` and `/hunt-suggest/:linkId` URL into a Discord test channel.

## What is NOT changing
- The `/live/:shareId` and `/hunt-suggest/:linkId` human routes (React app) — both preview endpoints return the SPA shell with injected tags.
- `shared_hunts` mirror, `buildMirror`, `suggestion_intakes`, the board/submit/info endpoints, Firestore rules.
- The in-app UI of either page.

## Target files
- **Create:** `api/og/CardMinimal.js`, `api/og/render.js`, `api/og/cardProps.js`, `api/og/live/[shareId].js`, `api/og/suggest/[linkId].js`, `api/hunt-suggest/preview.js`, `api/og/fonts/*.ttf`.
- **Modify:** `api/_lib/livePreviewFormat.js` (image injection + `buildImageUrl`), `api/live-preview.js` (pass shareId/updatedAt), `package.json` (`@vercel/og`), `vercel.json` (suggest rewrite + font includeFiles).
- **Test:** `api/og/__tests__/cardProps.test.js` (new), `src/__tests__/livePreviewFormat.test.js` (extend — note: it currently lives under `src/__tests__`; keep it there and import the api lib, matching the existing setup).

## Build order
1. Add `@vercel/og` + **validate** a trivial Node OG endpoint renders a PNG locally (fail-fast on the dependency/runtime). Bundle fonts + confirm `includeFiles`.
2. `cardProps.js` (pure mappers) + tests.
3. `CardMinimal.js` (Satori JSX, variant-agnostic) + `render.js` (fonts + ImageResponse).
4. `api/og/live/[shareId].js` + extend `injectOgTags`/`buildImageUrl` + wire `live-preview.js`. Verify live unfurl.
5. `api/og/suggest/[linkId].js` + `api/hunt-suggest/preview.js` + `vercel.json` rewrite. Verify suggest unfurl.
6. Edge-case + freshness pass (fallback cards, long names, version token).
