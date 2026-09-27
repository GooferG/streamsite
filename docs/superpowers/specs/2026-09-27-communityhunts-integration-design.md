# CommunityHunts.gg Integration (Hunts tab + predictions) and Tracker Removal

**Date:** 2026-09-27
**Status:** Approved (pending spec review)

## Problem

GooferG now owns and runs [communityhunts.gg](https://communityhunts.gg) and runs his own hunts there, in the Bean community hub. This site still carries two hunt surfaces that predate that:

- **Hunt Tracker** (`/gamba/hunt-tracker`): a full account-backed tracker, a weaker duplicate of communityhunts.gg.
- **Bonus Hunts** (`/gamba/bonus-hunts`): hunt history and a widget from **bonushunt.gg**, which is no longer used at all.

The prediction rounds (`/admin/hunts`) also snapshot the current hunt from bonushunt.gg, so they are broken in practice.

The site should showcase communityhunts.gg instead: GooferG's own hunts pulled from its API, predictions driven by those hunts, and the duplicate tracker deleted. Nobody uses the current tracker, so no migration, redirects or compatibility code are needed.

## Scope & non-goals

- **In scope:** delete the tracker and all bonushunt.gg code; add a server-side communityhunts client; replace both tabs with one **Hunts** tab; rewire predictions to communityhunts.gg and make them payout-only.
- **Non-goals (later steps, separate specs):**
  - Cross-community highlights (big wins, live hunts across every community). The key is scoped to the Bean community; this needs a platform-level key in the communityhunts backend.
  - Bonus Battle rework for on-stream use.
  - Pre-existing dead files unrelated to this work (`Snow.js`, `SocialButton.js`, `SuggestAdminTab.js`).
- **Unchanged:** the round **suggestions** feature (`acceptSuggestions`, `SuggestionSubmit`, `SuggestionList`, `api/suggestions/*`, `AdminSuggestionsPage`), the prediction round lifecycle (open → locked → settled, rewards, ticket payouts), Bonus Battle, Leaderboard, Slot Picker.

## Decisions (from brainstorming)

1. communityhunts.gg replaces bonushunt.gg entirely. bonushunt.gg code, env var and dev mirror are deleted.
2. The API key is the **Bean community key**, partner plan, `read` scope, 300 reads/min. The rate limit is shared with beantwitch.com, which uses the same community.
3. GooferG's hunts are identified by owner id `usr_IT8I88O03xF3QHqHzqme95` (owner name "Goofer") in the Bean community.
4. Hunt Tracker and Bonus Hunts merge into one **Hunts** tab: GooferG's live or latest hunt, recent hunts, a communityhunts.gg promo band, plus the existing prediction round and suggestions blocks carried over.
5. Predictions are **payout-only**: viewers guess the hunt's final total won. The top-slot prediction type is removed everywhere.
6. Settling offers **"Fill from hunt"**: it prefills the payout from the hunt's final `totalWon`, stays editable, and warns if the hunt is still live.
7. No compatibility code for old bonushunt.gg rounds or top-slot data.
8. The promo uses this site's own visual language. communityhunts.gg's gold theme sits too close to the "casino chrome" anti-reference in PRODUCT.md, so the wordmark logo is the only communityhunts.gg-branded element.

---

## 1. Server: communityhunts client

### `api/_lib/communityHunts.js` (new)

The only code that talks to communityhunts.gg.

- **Config:**
  - `COMMUNITYHUNTS_API_KEY` (required, server-only). If unset, every call throws a `NOT_CONFIGURED` error and callers fail closed, matching the other proxies.
  - `COMMUNITYHUNTS_OWNER_ID` (optional, defaults to `usr_IT8I88O03xF3QHqHzqme95`).
  - `COMMUNITYHUNTS_API_URL` (optional, defaults to `https://api.communityhunts.gg/api/public/v1`).
- **`chGet(path, params)`:** sends `Authorization: Bearer <key>` with an 8s timeout (`AbortController`). A non-2xx response throws an error carrying the upstream `error.code` and HTTP status. The key never appears in logs or errors.
- **Reads:**
  - `getLiveHunt()` → `GET /hunts?status=live&ownerId=<owner>&view=full&limit=1`, returning `data[0] ?? null`.
  - `getRecentHunts(limit = 10)` → `GET /hunts?ownerId=<owner>&view=summary&limit=<limit>` (all statuses, newest first).
  - `getHunt(id)` → `GET /hunts/<id>` (full view).
  - `getCurrentHunt()` → the live hunt, else the newest from `getRecentHunts(1)` fetched in full, else `null`.
- **Pure mappers** (exported for tests):
  - `toRoundSnapshot(hunt)` → `{ huntId: hunt.id, totalCost: hunt.pot ?? 0, currency: hunt.currency ?? null, bonusCount: hunt.bonusCount ?? 0, snapshotAt: <ISO now> }`.
  - `huntResult(hunt)` → `{ payout: hunt.totalWon ?? 0, currency, status: hunt.status, ended: hunt.status !== 'live' }`.
  - `profitLoss(hunt)` → `totalWon − pot` when `pot > 0`, else `null` (same rule as communityhunts.gg: potless hunts have no P/L).

### `api/communityhunts.js` (new, public read endpoint for the browser)

Follows the `api/bonus-hunts.js` pattern it replaces: CORS headers, `OPTIONS`, GET only.

- **`?view=overview`** → `{ live, recent }`: `live` is the full live hunt or `null`, `recent` is `getRecentHunts(10)`. One request per tab load or poll.
- **`?view=hunt&id=<id>`** → one full hunt, used when a recent-hunt row is expanded. `id` must match `^[A-Za-z0-9_-]{1,64}$`, otherwise 400.
- Any other `view` → 400. Key unset → 503.
- **Trimming:** responses include only what the tab renders. Each hunt keeps `id, status, huntType, currency, startedAt, endedAt, updatedAt, bonusCount, pot, totalWon, averageMultiple` and, in full view, `bonuses[{slot, bet, win, multiplier, thumb}]`. `calls` and `equity` are dropped.
- **Caching:** in-memory cache per `view`+`id` for 30s, `Cache-Control: public, s-maxage=30, stale-while-revalidate=60`, and the last good response is served if upstream errors. This keeps reads far under the shared 300/min.

### Dev mirror

`src/setupProxy.js` drops its `/api/bonus-hunts` handler and the raw `/api/public` bonushunt.gg proxy, and gains a `/api/communityhunts` mirror with the same two views, reading `COMMUNITYHUNTS_API_KEY` from `.env.local`. It duplicates the small fetch logic, the same way the existing mirrors do: the `api/` files are ESM and setupProxy is CommonJS.

## 2. Hunts tab (`/gamba/hunts`)

`src/pages/BonusHunts.js` is replaced by `src/pages/HuntsPage.js`. New presentational pieces live in `src/components/hunts/`.

**Sections, top to bottom:**


1. **Prediction round block, carried over from BonusHunts.js:** `usePredictionRound`, `PredictionModeBanner`, and the open/locked/settled arrangements of `PredictionSlip`, `PredictionNumberLine`, `PredictionWall` and `PredictionWinnersReveal`. Only the payout-only changes from section 3 apply.
2. **Round suggestions block, carried over unchanged:** `SuggestionSubmit` + `SuggestionList` when the round accepts suggestions.
3. **Current hunt card** (`components/hunts/CurrentHuntCard.js`): the live hunt, flagged LIVE, if one is running. Otherwise the most recent hunt, labelled with its end date.
   - Shows bonus count, start cost (`pot`), total won, average multiplier and P/L, all in the hunt's own currency.
4. **Recent hunts list** (`components/hunts/RecentHunts.js`): up to 10 rows showing date, hunt type label, bonus count, pot → won and P/L.
   - A row expands to its bonus list (slot, bet, win, multiplier, thumbnail with a fallback tile), fetched on demand via `view=hunt`.
5. **communityhunts.gg promo band** (`components/hunts/CommunityHuntsPromo.js`):
   - The wordmark (copied into `public/brand/communityhunts-logo.png` from the communityhunts frontend repo, not hotlinked), a one- or two-line pitch in this site's voice, and links to `https://communityhunts.gg/bean` and `https://communityhunts.gg/add-community`.
   - Always renders, including when hunt data is unavailable.

**Data hook:** `src/hooks/useCommunityHunts.js` fetches `/api/communityhunts?view=overview` on mount, then every 60s while mounted and the document is visible. It returns `{ live, recent, loading, error }`.

**States:**

- Loading: skeletons for the card and list.
- Error or 503: hide the card and list; the promo band and prediction blocks still render.
- No hunts: promo band only.

**Formatting:** money uses `Intl.NumberFormat` with the hunt's `currency` code (ARS, CAD, …). The hunt type label comes from communityhunts' public labels: `community` → "Community", `solo` → "Solo", and so on.

**Wiring:**

- `src/data/gambaTools.js`: replace the `hunt-tracker` and `bonus-hunts` entries with `{ id: 'hunts', label: 'Hunts' }`.
- `src/App.js`: replace the `hunt`, `bonus-hunts` and `hunt-tracker` child routes of `/gamba` with `hunts`.
- `GambaPage.js`: renders `HuntsPage` for `hunts` and drops the `HuntTracker` lazy import.
- `HomeGambaTools.js`: the blurb becomes one `hunts` line.
- Any in-app links to the old tool paths are updated to `/gamba/hunts`, found by grep during implementation.

**Design:** `/gamba/*` is product register (CLAUDE.md). Read PRODUCT.md before building. This is a utility surface that should still feel like the site; per decision 8, it does not adopt communityhunts' gold.

## 3. Predictions: communityhunts.gg source, payout-only

### Data model (Firestore `hunts/{id}`)

- `source`: `'communityhunts' | 'manual'` (was `'bonushunt' | 'manual'`).
- `bonusHuntSnapshot`: now `{ huntId, totalCost, currency, bonusCount, snapshotAt }` from `toRoundSnapshot`. The per-slot list is gone.
- `manualTotalCost` stays (optional start cost for manual rounds). **`manualSlots` is removed.**
- **`kinds` is removed.** `acceptPredictions: true` now means "payout prediction".
- `actual`: `{ payout }` (was `{ payout, topSlotName }`).
- Entries: `payoutGuess` only (was plus `topSlotGuess`). Winner objects drop `topSlotGuess` and `topSlotMatch`.

### Server

- **`api/_lib/predictions.js`** (new): `pickWinners(entries, round)` is moved out of `api/admin/hunts.js` so it can be tested without firebase-admin. It becomes payout-only and keeps the current payout rules:
  - Rank by absolute distance from `actual.payout`; a tie goes to the earlier `submittedAt`.
  - Entries without a numeric `payoutGuess` are excluded.
  - The result is one slot per reward tier place, `null` where there aren't enough entries.
- **`api/admin/hunts.js`:**
  - Remove `BONUSHUNT_API`, `BONUSHUNT_KEY`, `fetchCurrentHunt` and `snapshotHunt`.
  - `preview_hunt` returns `toRoundSnapshot(await getCurrentHunt())`, or 404 `NO_CURRENT_HUNT`.
  - `create` accepts `source: 'communityhunts' | 'manual'`. For communityhunts it stores the snapshot, or returns 400 `NO_CURRENT_HUNT` if there is none. `kinds` and `manualSlots` validation are removed.
  - **New action `hunt_result { id }`:** for a `communityhunts` round, `getHunt(round.bonusHuntSnapshot.huntId)` → `huntResult(hunt)`. Returns 400 for manual rounds. A communityhunts failure returns 502 with a readable error.
  - `settle` requires only `actualPayout`.
- **`api/predictions/submit.js`:** validates `payoutGuess` only. All top-slot validation and the slot-name lookup are removed.
- **`api/admin/users.js`:** drop `topSlotGuess` from the prediction history payload.

### Client

- **`AdminHuntsPage.js`:**
  - The create form's source toggle becomes "communityhunts.gg snapshot" / "Manual entry".
  - The preview line shows `type · cost <pot, in currency> · <bonusCount> bonuses`; the casino is gone.
  - The prediction-kind toggles and the manual slot textarea are removed.
  - The settle modal gets a **"Fill from hunt"** button (communityhunts rounds only). It calls `hunt_result`, puts `payout` in the payout field, and shows "Hunt is still live, the payout may change" when `ended === false`. The top-slot field is removed.
  - The round list label becomes `PREDICT` instead of `PREDICT (payout, top-slot)`.
- **`PredictionSlip.js`:** remove the top-slot tiles, slot input and "02" numbering. `totalCost` comes from `bonusHuntSnapshot.totalCost` or `manualTotalCost`. Money formats with the snapshot `currency` when present, otherwise the current format.
- **`PredictionWall.js` and `PredictionWinnersReveal.js`:** remove top-slot display.
- **`AdminUsersPage.js`:** remove the `topSlotGuess` display.
- **`AdminHubPage.js`:** the hunts card description loses "Snapshot from bonushunt.gg" and says communityhunts.gg.

## 4. Removal

The file list was computed from the import graph: roots plus everything that becomes orphaned, plus tests whose subject is deleted. `PredictionSlip`, `PredictionWall`, `PredictionNumberLine`, `PredictionWinnersReveal` and `SuggestionSubmit` show up as orphaned only because `BonusHunts.js` imports them. **They are kept** and move to `HuntsPage.js`.

**Delete (src):**

- **Components:** `HuntTracker`, `HuntHistory`, `HuntLinkControls`, `HuntStartScreen`, `HuntTour`, `SuggestionsPanel`, `SuggestionBoard`, `CappedScroll`, `Modal`, `ScatterPill`, `StatCell`, and the whole `components/hunt/` folder with its tests.
- **Hooks:** `useHuntStore`, `useFirstVisit`.
- **Pages:** `BonusHunts`, `LiveHuntPage`, `HuntSuggestPage`, `AdminCommunityHuntsPage`.
- **Utils:** `huntExport`, `scatterTier`, `suggestionBoard`, `suggestionsParse`.
- **Tests:** `__tests__` for `HuntTour`, `StatCell`, `SuggestionBoard`, `useFirstVisit`, `HuntSuggestPage`, `scatterTier`, `suggestionBoard`, `livePreviewFormat`, `ogCardProps`.

**Delete (api):**

- `bonus-hunts.js`, `live-preview.js`, `_lib/livePreviewFormat.js`
- `admin/community-hunts.js`
- `hunt-suggest/*` (board, info, manage, preview, submit)
- `og/*` (CardMinimal, cardProps, render, `live/[shareId]`, `suggest/[linkId]`, fonts)
- `roster/add.js`, `roster/search.js`
- `me/slot-profile.js`, `me/payout-profile.js`

**Edit:**

- `App.js`: remove the `/live/:shareId`, `/hunt-suggest/:linkId` and `/admin/community-hunts` routes and their lazy imports.
- `AdminLayout.js` + `AdminHubPage.js`: remove the Community Hunts entries.
- `MyAccountPage.js`: remove `SlotProfileCard` and `PayoutProfileCard`. They only fed the tracker's roster search.
- `vercel.json`: remove the `functions` entries for the OG routes and the `/live/:shareId` and `/hunt-suggest/:linkId` rewrites.
- `package.json`: remove `@vercel/og`.
- `firestore.rules`: remove `users/{uid}/active_hunt`, `users/{uid}/hunts`, `suggestion_intakes` and `shared_hunts`. Keep `hunts` (prediction rounds) and `bonus_battles`.
- `useBattleStore.js`: keeps importing `makeId` from `utils/huntCalc`, which stays (still used by predictions and suggestions).
- `.env.example`: remove `BONUSHUNT_API_KEY`; add `COMMUNITYHUNTS_API_KEY` and `COMMUNITYHUNTS_OWNER_ID`.
- `CLAUDE.md`: update the Serverless API, dev-vs-prod proxying, Commands and Gotchas sections (bonushunt.gg out; communityhunts client, env vars and the shared rate limit in).

Existing Firestore data under removed paths is left in place, and the removed rules deny access to it.

## 5. Testing

- **Unit (`src/__tests__/communityHunts.test.js`):** `toRoundSnapshot`, `huntResult` (live vs ended), `profitLoss` (potless → `null`), and `chGet` error mapping plus `NOT_CONFIGURED` with a mocked `fetch`.
- **Unit (`src/__tests__/predictions.test.js`):** payout-only `pickWinners`: closest wins, a tie goes to the earlier submission, entries without a guess are excluded, and short entry lists pad with `null` per tier.
- **Handler (`src/__tests__/communityhuntsApi.test.js`):** `view` allowlist and id validation (400), 503 when the key is unset, trimming (no `calls`/`equity`), stale-on-error.
- **Render (`src/pages/__tests__/HuntsPage.test.js`):** with fixture data, live card vs latest-hunt card, the P/L shown in the hunt's currency, and the promo band visible on API error.
- **Regression:** the full Jest suite and `react-scripts build` with no warnings.
- **Live smoke:** one real call each for `overview` and `hunt` through the client against the Bean key, to confirm response shapes match the fixtures.

## Rollout

1. Add `COMMUNITYHUNTS_API_KEY` (and optionally `COMMUNITYHUNTS_OWNER_ID`) to Vercel before merging.
2. Merge the PR, then deploy Firestore rules: `firebase deploy --only firestore:rules --project goofer-website`.
3. After the deploy is verified, remove `BONUSHUNT_API_KEY` from Vercel.

## Addendum (implementation)

- **Entry path fix:** `PredictionSlip`, `PredictionWall` and `PredictionNumberLine` read entries from a legacy `prediction_rounds/{id}/entries` path that had no Firestore rule, while the server writes `hunts/{id}/entries`. All three now read `hunts/{id}/entries`.
- **`profitLoss` is client-side** (`src/utils/huntFormat.js`), not in `api/_lib/communityHunts.js`. The `npm start` dev mirror returns raw communityhunts shapes, and CRA can't import from `api/`, so the tab computes P/L itself from `pot`/`totalWon`.
- **Settling** now rejects an empty payout. It previously coerced `''` to `0`.
