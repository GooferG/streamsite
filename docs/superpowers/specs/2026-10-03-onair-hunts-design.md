# On Air: the Hunts tab redesign, and the pilot of a softer broadcast look

**Date:** 2026-10-03
**Status:** Approved in brainstorming (pending spec review)
**Handoff:** `docs/redesign/design_handoff_bonus_hunt_on_air/` (README, prototype HTML, 7 screenshots)

## Problem

The site's surfaces are hard-lined boxes: 1px `border-white/8` panels, square corners, flat `bg-zinc-card/30`. The owner wants to move away from that blocky look while keeping the late-night broadcast concept. A high-fidelity handoff ("Bonus Hunt On Air") shows the target for `/gamba/hunts`: a TV monitor stage, rounded layered surfaces with inset highlights and drop shadows, and a perforated prediction slip.

The handoff is a prototype with mock data and every value inline. Transcribing it would make Hunts a one-off island that the next page copies and drifts from. This work treats Hunts as the **pilot** of a named design language ("On Air"): tokens, a few primitives, and written rules in DESIGN.md, so later pages can opt in deliberately.

## Scope and non-goals

- **In scope:**
  - On Air tokens in `tailwind.config.js`, the two webfonts, and an On Air section in DESIGN.md.
  - Primitives in `src/components/onAir/`: `Monitor`, `Panel`, `Chip`, `Ticket`, `OnAirButton`.
  - A rebuilt `/gamba/hunts` tab covering four modes (open, locked, settled, off air) on real data.
  - One shared entries listener for the tab.
  - A dev-only fixture switch for visual checks.
- **Non-goals:**
  - Migrating any other page, the global nav, or the GambaPage channel strip. The nav is the natural next migration; until then the seam between system-font nav and Bricolage content is accepted.
  - Unsealing guesses while a round is open. They stay sealed.
  - A duplicate-guess check, a "chat median" while open, and a "next hunt" ticker item. These need data that is sealed or that we don't have.
  - Slot provider names in the bonus table. communityhunts bonuses don't carry them, and loading the full slot catalogue for this is not worth it.
  - The handoff's TV Guide rail card and admin "Control Room" card. The GambaPage strip and the floating Control Room panel already cover both.
- **Unchanged:**
  - Firestore rules, the prediction API, `/admin/hunts`, the Control Room panel.
  - `PredictionWinnersReveal` (still used by the Control Room's `StageMoment`).
  - `useHuntDetail`, `useCommunityHunts`, `CommunityHuntsPromo`, `SuggestionSubmit`, `SuggestionList`.
  - The site body gradient. The page does not repaint itself with the handoff's flat `#09080b`.

## Decisions (from brainstorming)

1. **Guesses stay sealed while open.** The open lineup shows face-down rows. Everything that needs other people's guesses appears from lock onward.
2. **Handoff-exact fonts and colours, scoped.** Bricolage Grotesque and JetBrains Mono, teal / orange / purple from the handoff, applied only inside the Hunts tab.
3. **Token-first pilot.** Semantic tokens and primitives rather than inline hex. DESIGN.md records the rule changes openly.
4. **Rail drops the TV Guide and the admin card.** Rail = slip, runner-up, past episodes.
5. **Locked gets a "live opening" screen.** The handoff has no screen for it; this spec defines one.

## The On Air language

### Tokens (`tailwind.config.js`, `theme.extend`)

| Group | Token | Value |
| --- | --- | --- |
| Signal (open / live state) | `onair-signal` / `-light` / `-deep` | `#3ee0bf` / `#7af0d6` / `#1fc9a8` |
| Winner (result moment) | `onair-winner` / `-hot` / `-warm` / `-light` / `-deep` | `#ff6a1a` / `#ff8a3d` / `#ff9a5c` / `#ffb27a` / `#e0520c` |
| Viewer ("you", Twitch) | `onair-viewer` / `-bright` / `-deep` / `-light` | `#9146ff` / `#a26bff` / `#8240f0` / `#b89cff` |
| Live tally light | `onair-live` | `#d83a1c` |
| Loss / negative | `onair-loss` | `#ff6b6b` |
| Surfaces | `onair-surface-1` / `-2` / `-3` / `-4` | `#17151b` / `#141216` / `#121015` / `#0f0e12` |
| Bezel | `onair-bezel-top` / `-bottom` | `#26232c` / `#141217` |
| Ink (text) | `onair-ink-1` … `-6` | `#ece8e1`, `#e4e0e8`, `#c9c4cf`, `#a7a2ad`, `#8a8690`, `#6d6873` |
| Radius | `rounded-onair-bezel` / `-screen` / `-card` / `-row` / `-control` / `-tile` | 36 / 26 / 24 / 18 / 14 / 10 px |
| Shadow | `shadow-onair-card` | `inset 0 1px 0 rgba(255,255,255,.06), 0 14px 30px rgba(0,0,0,.4)` |
| | `shadow-onair-bezel` | `inset 0 1px 0 rgba(255,255,255,.09), inset 0 -2px 0 rgba(0,0,0,.6), 0 30px 60px rgba(0,0,0,.6)` |
| | `shadow-onair-row` | `inset 0 1px 0 rgba(255,255,255,.05)` |
| | `shadow-onair-lit-winner` | `inset 0 1px 0 rgba(255,180,130,.2), 0 12px 30px -12px rgba(255,106,26,.45)` |
| | `shadow-onair-lit-viewer` | `inset 0 1px 0 rgba(200,170,255,.2), 0 12px 30px -12px rgba(145,70,255,.45)` |
| Font | `font-onair` | `"Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif` |
| | `font-onair-mono` | `"JetBrains Mono", source-code-pro, Menlo, Consolas, monospace` |
| Keyframes | `onair-static`, `onair-roll`, `onair-ticker`, `onair-pulse` | from the handoff's `<style>` block |

Fonts load from Google Fonts in `public/index.html`, next to the existing Anton link: Bricolage Grotesque (opsz 12–96, weights 500/700/800) and JetBrains Mono (400/600/700), `display=swap`. Browsers download a font file only when an element renders in it, so other pages pay for the stylesheet request only.

### Rules (added to DESIGN.md as "On Air (pilot: /gamba/hunts)")

- **Depth, not borders.** On Air surfaces use an inset top highlight plus a drop shadow. No 1px border boxes.
- **Glow means something.** Only three things glow: the LIVE light, the winner, and you. Hero numbers, generic buttons, markers and plain dots do not glow.
- **Readable labels.** Informational text never goes below `onair-ink-5` (`#8a8690`, about 5:1 on the surfaces). `onair-ink-6` and fainter are decorative only.
- **Colour roles inside On Air.** Teal = signal (open, live state, positive result). Orange = the result / winner moment. Purple = the viewer. Red = the LIVE light and losses. This intentionally departs from the site-wide "orange is admin only" and "red is destructive only" rules, which still apply outside On Air.
- **Type.** Bricolage for display and UI, JetBrains Mono uppercase with 0.15–0.3em tracking for labels and data. Scale: 96 / 60 / 30 / 24 / 22 / 20 / 17 / 15 / 14 / 13 / 12.
- **Set dressing is honest.** Decorative controls (the monitor knobs) are `aria-hidden`, with no pointer cursor and no hover state.

## Modes and data

### Data sources

- **Round:** the latest `hunts/{id}` by `createdAt` (live listener, as today). Fields used: `status`, `title`, `acceptPredictions`, `acceptSuggestions`, `entryCount`, `source`, `bonusHuntSnapshot`, `manualTotalCost`, `rewards.tiers`, `actual.payout`, `winners`, `openedAt`, `lockedAt`, `settledAt`.
- **Entries:** `hunts/{id}/entries`, readable by viewers only once the round is not open (staff always). One listener for the whole tab (`useRoundEntries`).
- **My entry:** `hunts/{id}/entries/{twitchId}` (`useMyEntry`), always readable by its owner.
- **Hunts:** `useCommunityHunts()` (live full view with bonuses, recent summaries, 60s poll) and `useHuntDetail(id)` for any other hunt's bonuses.

### Mode selection

| Mode | Condition |
| --- | --- |
| `offair` | no round, or `round.acceptPredictions` is false |
| `open` | `round.status === 'open'` |
| `locked` | `round.status === 'locked'` |
| `settled` | `round.status === 'settled'` |

An admin can re-open a locked round, so `open ⇄ locked` must work in both directions.

### The tab's hunt

- **communityhunts round:** the hunt whose id is `bonusHuntSnapshot.huntId`. If it is the live hunt, use the live poll (bonuses update every 60s). Otherwise fetch its detail once.
- **Manual round:** no hunt. Recap shows round-only stats and no bonus table.
- **Off air:** the live hunt if there is one, else the most recent hunt.

### Derivations (`src/components/hunts/huntBoard.js`, pure)

- `startCost` = `roundTotalCost(round)`; off air uses `hunt.pot`.
- `totalBet` = sum of finite `bonus.bet` over the hunt's bonuses; `null` when there are none.
- `requiredAvg` = `startCost / totalBet` when both are > 0, else `null`. `avgBet` = `totalBet / bonuses.length`.
- **Opening progress:** a bonus is opened when `win != null`. `wonSoFar` = sum of opened wins; `openedCount` / `bonusCount`. `stillNeedAvg` = `max(0, startCost − wonSoFar) / remainingBet` when `remainingBet > 0`, else `null`.
- `chatMedian` = median of revealed guesses (locked and settled only).
- **Ranking (settled):** sort by `|guess − actual|` ascending, ties by `lastEditAt || submittedAt` ascending. This mirrors `pickWinners` in `api/_lib/predictions.js`. Lit rows and places come from `round.winners`, which is authoritative.
- **Meter scale:**
  - Sealed (open, viewer): `[0.5 × startCost, 1.5 × startCost]`, widened with 5% padding to fit the viewer's guess. Hidden when there is no start cost and no guess.
  - Revealed: min/max over guesses, `startCost`, and (`actual` when settled, `wonSoFar` when locked), padded 5%.
  - Labels use `formatMoneyCompact`.
- **Lineup:** top 10 rows. If the viewer's row falls outside them, it is pinned underneath. "Show all N" expands in place.
- **Ticker items** per mode, built from the data below. Items are uppercase strings separated by ★.
- **Quick picks (open):** Half back (½ × start cost), Break-even, Double (2×). Hidden without a start cost.
- **Prize text:** tier 1 via `rewardSummary` (e.g. "+500 tickets", "+500 tickets + $50 cash"). Places 2+ feed the runner-up card.

### What each mode shows

| | Open | Locked | Settled | Off air |
| --- | --- | --- | --- | --- |
| Screen tint | teal `#0f2220` | teal `#0f2220` | orange `#2a1810` | neutral `#16131a` |
| Status light | LIVE | LIVE | REPLAY | LIVE if a hunt is live, else REPLAY |
| Eyebrow | `{title} · PREDICTIONS OPEN` | `{title} · ENTRIES CLOSED · OPENING BONUSES` | `{title} · AND THE CLOSEST GUESS IS` | `HUNT IN PROGRESS` / `LAST HUNT` |
| Hero | "What does the hunt pay?" + required avg (fallback: start cost as break-even) | won so far + `N/M OPENED` | winner avatar, name; chips: guessed, actual, prize | live: won so far + opened; replay: result (±) |
| Side stats | total bet, avg bet, start cost | start cost, still-need avg, chat median | — | live: start cost, still-need avg (won so far is the hero); replay: start cost, won, avg multi |
| Chips | bonuses, guesses in, prize | bonuses, guesses, prize | — | bonuses |
| Meter | break-even marker; your dot only (staff: all) | all dots; break-even + SO FAR markers | all dots; ACTUAL marker; winner orange, runner-up light, you purple | none |
| Chyron tag | OPEN (teal) | CLOSED (light) | FINAL (orange) | OFF AIR (light) |
| Bezel readout | `CH 02 · ENTRIES OPEN` (teal) | `CH 02 · ENTRIES CLOSED` | `CH 02 · ENTRIES CLOSED` | `CH 02 · NO ROUND` |
| Lineup | "Guesses so far": your row (purple, top) + face-down rows for the rest | "Guesses so far", revealed low → high | "Tonight's lineup", closest first, 1st orange-lit, ± off | hidden |
| Recap title | On the docket | Opening now | Hunt recap | live: Opening now; else Hunt recap |
| Recap stats | start cost, total bet, bonuses, required avg | start cost, won so far, opened, still-need avg | start cost, won, avg multi, result | start cost, won, avg multi, result |
| Bonus table | all "—", first row UP FIRST | opened rows filled, next unopened UP NEXT, best so far BEST HIT | filled, BEST HIT, ≥100x warm, 0x loss red | same as settled (live: as locked) |
| Slip | input → Lock it in → locked card → Change guess | read-only guess + "N below you · M above" | signed in: your result; signed out: "Call the next payout" + Sign in | "No round open" (+ Sign in when signed out) |
| Rail extras | past episodes | past episodes | runner-up card, past episodes | past episodes |

- **Settled with no winners:** the hero shows the actual payout with "NO ELIGIBLE GUESSES" instead of a winner.
- **Loading and failure (added after review):** revealed entries that are still loading stay face down, counted from `entryCount` ("Turning them over…"), never "no guesses"; the viewer's own entry shows "Checking your slip…" until its first snapshot; a failed round read shows a "No signal" screen, never the idle off-air screen. Past episodes never include a hunt that is still live.
- **Announcements (added after review):** a polite live region says "Entries closed…", "Results are in. {winner} wins." (or no eligible guesses) and "Predictions are open." when the round changes state, never on first load.
- **Staff while open:** entries are readable to staff, so their lineup and meter show revealed rows and every dot (today's behaviour). Viewers get face-down rows.
- **Missing money data:** with no start cost and no bets, the open hero shows only the question and the guesses-in chip. A locked round without hunt data (manual round) keeps the open hero (break-even) with the locked eyebrow, and adds chat median as a side stat.
- **Face-down rows:** entry number, blank avatar, a redacted bar, "SEALED" in the value column. Up to 8 rows, then "+N more sealed". Header note: "Sealed until entries close".
- **Screen clock:** a live clock (updated every minute) while open, locked or live; `settledAt` once settled; the hunt's `endedAt` for an off-air replay.
- **Slip, signed in:** keeps today's behaviour: `/api/predictions/submit`, the 30s edit cooldown with a countdown, the same error messages, and the grouped amount input with caret restore (`utils/amountInput`). The serial is the existing `fakeSerial(roundId, twitchId)`. The input prefix is the round currency code, or `$` without one.
- **Past episodes:** recent communityhunts hunts except the tab's hunt. Each row shows `{huntType} hunt`, the date, and the result (± teal / loss red). Rows are buttons: clicking one swaps the recap card to that hunt (detail fetch) with a "Back to tonight" button.
- **Suggestions and promo:** `SuggestionSubmit` + `SuggestionList` when the round accepts suggestions, then `CommunityHuntsPromo`, both below the main column. Unchanged.

### Channel change

When the mode changes after first render, the screen plays the static burst (noise layer plus a rolling bright band, about 420ms) before swapping content, and the CH knob turns ±60°. The burst never plays on first paint. With `prefers-reduced-motion`, the swap is instant and the knob doesn't spin.

## Components and files

```text
src/components/onAir/
  Monitor.js        bezel, tinted screen, scanlines, static overlay, header slot,
                    chyron ticker, bezel strip (LED, wordmark, readout, knobs)
  Panel.js          rounded card surface; lit="winner|viewer|signal"
  Chip.js           pill: neutral | signal | winner
  Ticket.js         perforated slip; holes are mask cutouts, not page-coloured dots
  OnAirButton.js    viewer | ghost | winner
src/components/hunts/
  huntBoard.js      pure derivations (above)
  usePredictionRound.js   moved out of HuntsPage
  useRoundEntries.js      the tab's single entries listener; respects entriesSealed
  useMyEntry.js           the viewer's own entry
  HuntMonitor.js    the four screens + HuntMeter
  HuntLineup.js     revealed rows, face-down rows, show all
  HuntRecap.js      stats row + BonusTable, episode swap
  BonusTable.js
  HuntSlip.js
  RunnerUpCard.js
  PastEpisodes.js
  huntFixtures.js   dev-only fixture data (handoff mock data)
src/pages/HuntsPage.js    thin orchestrator
```

- **Deleted** (only this tab used them): `PredictionSlip`, `PredictionWall`, `PredictionNumberLine`, `hunts/CurrentHuntCard`, `hunts/RecentHunts`, `hunts/BonusReel`, `hunts/HuntBonuses`, `hunts/ProfitBadge`. Their tests are ported to the new components.
- **Dev fixture:** `/gamba/hunts?fixture=open|locked|settled|offair` renders the tab from `huntFixtures.js` instead of live data. Gated by `process.env.NODE_ENV !== 'production'` so the fixture code is dropped from the production bundle.

### Page layout

- Root: `font-onair`, sitting on the site's existing body gradient.
- `lg` and up: two columns, main `minmax(0,1fr)` and rail `340px`, gap 24. Main: monitor, lineup, recap, suggestions. Rail: slip, runner-up, past episodes.
- Below `lg`: both columns become `display: contents` and the children take explicit `order`: monitor → slip → lineup → recap → runner-up → past episodes → suggestions. No component renders twice.
- The promo band stays full width at the bottom.

### Responsive (phone = 375px, 16px gutter)

Components switch compact/full at `sm` (640px). The main column is at least about 590px wide at `sm` and up, so viewport breakpoints are enough.

- **Monitor:** screen padding 34 → 18px. Hero number `clamp(52px, 17vw, 96px)`. Side stats wrap under the hero and the divider is hidden. Settled avatar 108 → 84px, name scales with clamp and truncates. Below `sm` the clock shows time only, meter dots go 20 → 14px, the VOL knob is hidden and the CH knob shrinks.
- **Lineup rows:** full `44 · 40 · 1fr · 120 · 110`; compact `28 · 32 · 1fr · auto` with guess and meta stacked. Names truncate.
- **Recap:** stats row 4 → 2×2, card padding 24 → 16.
- **Bonus table:** full `44 · 1fr · 90 · 110 · 200`; compact `1fr · auto · auto` (slot, payout, multi) with the bet under the slot name and the tag under the name. Slot tiles use the communityhunts thumbnail, falling back to an initials tile tinted per slot.
- **Rail:** full width when stacked. Quick picks have a 36px minimum height.

### Accessibility

- Status, readout and chyron text are real text. The ticker's duplicated half is `aria-hidden`.
- The slip input has a visible label (visually the "YOUR SLIP" eyebrow, programmatically a `<label>`), and errors are announced (`role="status"`).
- "Show all", "Show/Hide bonuses", past-episode rows and "Back to tonight" are buttons with `aria-expanded` where relevant.
- Focus rings are visible on every control (`focus-visible` outline in the signal or viewer colour).
- Reduced motion turns off the static burst, the knob spin, the ticker scroll and the LIVE pulse.

## Testing and verification

- **Unit (`huntBoard.js`):** mode selection, including `acceptPredictions: false`; required avg with and without bets; opening progress with `win: null`; still-need avg when everything is opened; meter scale (sealed, revealed, settled); ranking and tie-break parity with `pickWinners`; pinned viewer row; ticker items per mode; best hit.
- **Hooks:** `useRoundEntries` gets the sealing guarantees from `sealedGuesses.test.js`: viewers never query while open, staff do, it subscribes on lock, and denied access falls back cleanly.
- **Components:**
  - `HuntSlip` ports `PredictionSlip.test.js`: submit, cooldown, errors, signed out, locked read-only, settled result.
  - `HuntLineup`: face-down count, your row, settled order and the lit first row.
  - `HuntMonitor`: each mode's eyebrow and hero, and the no-winners fallback.
  - `BonusTable`: UP NEXT, BEST HIT, show all.
  - `PastEpisodes`: swap and back.
  - Channel change: fires on a mode change, not on mount.
  - `HuntsPage.test.js` and `huntsTab.test.js` updated, keeping "promo survives an API failure".
- **Gates:** `npm test -- --watchAll=false` and `npm run build` (ESLint) both pass.
- **Visual:** each fixture state at 1280px and 375px compared with the handoff screenshots, with reduced motion emulated, plus a keyboard pass through the slip, show-all controls and episodes.
- **Review:** `ui-finish-gate` against the DESIGN.md On Air section, and `accessibility-auditor` on the slip and lists. Their holds are fixed before the PR.

## Delivery

- **Branch:** `feat/onair-hunts`, built in the main checkout, with the branch checked in the same command as every commit.
- **Commit order:** tokens + fonts + DESIGN.md → primitives → derivations + hooks → hunts components → page swap + deletions → CLAUDE.md note.
- **Wrap-up:** a GitHub PR for the owner to merge. No Claude attribution in commits or the PR.
