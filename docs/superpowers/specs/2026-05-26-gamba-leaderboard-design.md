# /gamba/leaderboard — Broadcast Standings Tool

**Status:** Design approved, pending implementation plan
**Date:** 2026-05-26
**Owner:** GooferG

## Purpose

Add a mock-data leaderboard tool to `/gamba/*` that:

1. Becomes the new **default landing tool** under the gamba section (replaces `hunt-tracker` as the index redirect).
2. Reads as a polished, distinctive on-brand product — not a clone of the cookie-cutter streamer-affiliate leaderboards (mitchjones.vip, hunterowner.gg, cdew.gg).
3. Functions as a soft product demo for other streamers ("I want this on my site") via an in-register station ID, not a SaaS-style CTA.
4. Is architected so the mock data source can be swapped for a real casino affiliate API (Rainbet / Roobet / Stake / Shuffle) with a single-file change later.

## Audience

- **Primary:** GooferG stream viewers landing on `/gamba`. Page should reinforce brand atmosphere and feel "alive."
- **Secondary:** Other streamers / their devs evaluating GooferG's site as a reference. Page should signal production value and technical legitimacy.

## Design register

Per [PRODUCT.md](../../../PRODUCT.md): irreverent, gritty, warm — late-night CRT / Adult Swim cable-bumper energy. The leaderboard adopts a **public-access TV broadcast scoreboard** register: structurally borrowed from sports timing towers (F1, election-night scoreboards) for legibility and "real product" cues, but voiced and styled in the late-night cable register that matches the brand.

**Hard anti-references** (per PRODUCT.md and the three reference sites):

- No giant gradient-text dollar figure hero.
- No top-3 podium with #1 elevated card.
- No casino-chrome gold/red.
- No generic Twitch-purple panel.
- No SaaS landing pattern (hero stat → 3 CTAs → table).

## Route and integration

- **Route:** `/gamba/leaderboard` (new).
- **Index redirect:** `src/App.js` line 214 changes from `<Navigate to="/gamba/hunt-tracker" replace />` to `<Navigate to="/gamba/leaderboard" replace />`.
- **Sub-route declaration:** add `<Route path="leaderboard" element={null} />` to the gamba children in `App.js`.
- **GambaPage tool registry:** add `{ id: 'leaderboard', label: 'Leaderboard', code: 'LB', icon: Radio }` (lucide `Radio` — best register match for the broadcast theme) as the **first** entry in the `TOOLS` array in [src/pages/GambaPage.js](../../../src/pages/GambaPage.js).
- **Render slot:** add `{activeTool === 'leaderboard' && <Leaderboard />}` to the tool surface block (`GambaPage.js` lines 133-139).
- The existing GambaPage shell (CONTROL ROOM eyebrow, MODULE LB header, READY indicator) wraps the leaderboard for free. The leaderboard component does **not** render its own outer header — its design starts where the shell ends.

## Component architecture

```text
src/components/Leaderboard/
  index.js              // re-exports Leaderboard
  Leaderboard.js        // top-level layout, composes children
  BroadcastHeader.js    // upper-third: timer, prize pool, station eyebrow, poll-status line
  RaceBars.js           // top 5 hero race visualization (with leader takeover)
  LeaderTakeover.js     // P01-only oversized banner row
  RosterTable.js        // positions 6-20 dense list
  TickerCrawl.js        // bottom horizontal scrolling sponsor-message crawl
  StationID.js          // streamer pitch — single line, treated as TV station bug
  BroadcastFrame.js     // corner brackets, REC dot, session timecode, scanline overlay
  useCountdown.js       // 30-day rolling timer hook (client-side)
  useLeaderboardData.js // data hook — reads mock today, real API tomorrow
  useSessionTimecode.js // page session timecode for the REC indicator
  mockData.js           // 20 fake players, deterministic baseline, plus deltas generator
```

**Files are split this way because:**

- The leaderboard has 4+ distinct visual subsystems (header, race, roster, ticker) plus a chrome frame; co-locating them in one file would push past 500 lines and obscure where to make changes.
- The data hook (`useLeaderboardData`) is the single swap point for the future real-API integration. Isolating it in its own file makes the swap a one-file diff.
- `LeaderTakeover` is separated from `RaceBars` because the leader is a visually distinct treatment (oversized type, scanline wash, gap callout), not just a longer bar.

## Layout

### Above the fold

```text
┌─ BROADCAST FRAME (corner brackets, REC dot top-right, scanline wash) ────┐
│                                                                            │
│  STANDINGS · WK 03 OF 04          PRIZE POOL              T-MINUS         │
│  LAST UPDATED 04:21 AGO           $25,000.00              05d 22h 16m 30s │
│                       *** MAY 2026 STANDINGS ***                          │
│                                                                            │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  LEADER TAKEOVER (full-width banner, only for P01)                        │
│  ╔════════════════════════════════════════════════════════════════════╗  │
│  ║  P01   NE****g                                       LEADING BY    ║  │
│  ║                                                      $14,177,964    ║  │
│  ║        $23,434,853                                   ▲              ║  │
│  ╚════════════════════════════════════════════════════════════════════╝  │
│                                                                            │
│  RACE BARS (P02-P05, standard rows)                                       │
│  P02  md****1    ██████████████░░░░░░░░░░░░░░░░     $9,256,889  ▼        │
│  P03  ma****o    ███████████░░░░░░░░░░░░░░░░░░░     $7,198,825  ─        │
│  P04  mi****s    ██████████░░░░░░░░░░░░░░░░░░░░     $6,430,844  ▲        │
│  P05  re****H    █████████░░░░░░░░░░░░░░░░░░░░░     $6,376,767  ▼        │
│                                                                            │
└──────────────────────────────────────────────────────────────────────────┘
```

### Below the fold

```text
┌─ ROSTER 06–20 (dense table, no bars) ────────────────────────────────────┐
│                                                                            │
│  P06  xx****x    $5,123,400   ▲                                           │
│  P07  yy****y    $4,890,210   ─                                           │
│  ...                                                                       │
│  P20  zz****z    $1,012,000   ▼                                           │
│                                                                            │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  TICKER  ‹‹ THIS BROADCAST BROUGHT TO YOU BY UNCLE LARRY'S DISCOUNT       │
│             BACKHOES · GET HIM ON THE CB · TURN YOUR LIFE AROUND ›› ››    │
│                                                                            │
│  STATION ID · BROADCAST SYSTEM v1 · BUILT BY GOOFER · /tools              │
│                                                                            │
└──────────────────────────────────────────────────────────────────────────┘
```

## Key visual moves

### 1. Broadcast frame

The whole leaderboard panel is wrapped in a frame that signals "you are watching a broadcast":

- **Corner brackets** (`◣ ◢ ◤ ◥`) on the four corners of the outer panel.
- **REC dot** in the top-right: small red `●` paired with a running session timecode (`SESSION 00:23:14`). Voiced as the page session timecode, not faking that real players are being recorded. Pulses at 1Hz.
- **Scanline wash** overlay (reuse the repeating-linear-gradient technique already in [GambaPage.js:67-74](../../../src/pages/GambaPage.js#L67-L74)) across the panel at ~4% opacity.

### 2. Broadcast header

Three columns, no giant gradient dollar figure:

- **Left:** `STANDINGS · WK 03 OF 04` eyebrow, with a second line `LAST UPDATED · 04:21 AGO` showing data poll freshness.
- **Center:** title flanked by triple asterisks (`*** MAY 2026 STANDINGS ***`) — public-access stamp feel.
- **Right:** `T-MINUS` label + 30-day countdown `05d 22h 16m 30s` (tabular, monospace, updates every 1s).

Prize pool sits in the header but is **not the visual hero** — small label, normal-size number. The hero is the leader, not the pot.

### 3. Leader takeover (P01)

P01 is rendered as a **full-width banner**, not a row in the bars list:

- Oversized username type (~36-48px display).
- Wagered figure in oversized tabular display digits (~60-80px).
- `LEADING BY $14,177,964` gap callout on the right.
- Faint scanline wash *only* on this banner (denser than the panel-wide wash).
- `emerald-signal` accent on position pill and trend arrow.

This is the single most important "pop" move — it breaks the row-grid that all three reference sites share. The leader looks like they're on TV; everyone else looks like they're in the standings list.

**Requires:** mock data must put P01 ~2-3× P02's wagered amount so the takeover banner visually earns its scale.

### 4. Race bars (P02-P05)

Standard rows below the takeover:

- Position pill (`P02`), masked username (`md****1`), horizontal bar, wagered amount, trend arrow.
- Bar width = `player.wagered / leader.wagered`.
- Bar fill color: desaturated white/zinc — only the leader takeover uses `emerald-signal`. This is the hierarchy move the references miss (they color everything, so nothing stands out).
- Bars animate from 0 → final width on mount, 600ms cubic-bezier, 80ms stagger per row.

### 5. Trend arrows

Each player has a position-change indicator vs. previous poll:

- `▲` moved up
- `▼` moved down
- `─` unchanged

When a player's trend changes between polls, the new arrow pulses briefly (~600ms ease).

### 6. Wager drops on poll

On each data poll, the data hook returns updated totals. The UI detects the deltas and animates:

- For each player whose wagered figure changed, a small chip flies in next to their name showing `+$200,000` and fades after ~2s.
- The bar grows to its new width with a brief flash.
- Trend arrow updates and pulses if changed.

**Honesty constraints (per casino affiliate API research):**

- No game name in the drop chip (`Sweet Bonanza` etc. is NOT exposed by Rainbet/Roobet/Stake affiliate APIs).
- Just the delta amount and direction.
- Cadence in mock mode: every 30-60s (slow enough to feel like a real data feed, not a screensaver). Real-mode cadence: whatever the upstream API's poll interval is, typically 5-15min.

### 7. Roster table (P06-P20)

Below the fold:

- Same row rhythm as race bars (reads as continuation, not new section).
- No bars — just `position | masked username | wagered | trend`.
- Tabular-nums, monospace for numbers.
- Hover state: subtle row highlight (`bg-white/3`).

### 8. Ticker crawl

Bottom horizontal scrolling marquee:

- Content: 8-12 in-jokes voiced as sponsor messages / station bumpers.
- Examples: `THIS BROADCAST BROUGHT TO YOU BY UNCLE LARRY'S DISCOUNT BACKHOES`, `STAY TUNED FOR LATE-NIGHT WAGER REPORT`, `WE NOW RETURN YOU TO YOUR REGULARLY SCHEDULED STANDINGS`.
- Pauses on hover.
- Continuous scroll (CSS animation, not JS).

### 9. Station ID

Single line at the bottom of the panel, voiced as a TV station bug:

```text
STATION ID · BROADCAST SYSTEM v1 · BUILT BY GOOFER · /tools
```

`/tools` is a styled link (eventual page or DM CTA — leave the destination as `#` for now; we'll decide what it links to in a follow-up task). The point of the station ID is to be **noticed by streamers and read as flavor by viewers**. No "DM me for yours" copy on-page.

## Color and typography

Reuses existing project tokens. No new colors introduced.

- **Background:** existing `zinc-broadcast` / `zinc-card` from the GambaPage shell.
- **Accent:** `emerald-signal` — used ONLY on the leader takeover (position pill, trend arrow, oversized wagered figure). Nowhere else above the fold. P02-P20 bars and arrows use desaturated white/zinc.
- **REC dot:** standard broadcast red. If no token exists, use a hard hex `#ef4444` (Tailwind `red-500`) and treat it as the only inline color. This is the only non-token color allowed in the page.
- **Body text:** `text-white-body`.
- **Eyebrows / labels:** font-mono, `tracking-eyebrow-md` / `tracking-eyebrow-lg`, 10-11px, uppercase, `text-white/60-75`.
- **Numbers:** `tabular-nums font-mono` everywhere wagered amounts or timecodes appear.
- **Display digits (leader takeover):** `tabular-nums`, `text-5xl`-`text-7xl` range, weight ≥700.

## Motion

All motion gated behind `motion-reduce:`:

- **Bar fill-in** on mount: 600ms cubic-bezier-out, 80ms stagger per row.
- **Countdown timer:** 1s tick.
- **REC dot:** 1Hz pulse.
- **Session timecode:** 1s tick.
- **Ticker crawl:** continuous, ~40s loop, CSS-only.
- **Wager drop chip:** fly in from right (~200ms), hold ~1.5s, fade ~400ms.
- **Bar growth on poll:** ~400ms ease.
- **Trend arrow change:** ~600ms ease pulse.

For `prefers-reduced-motion: reduce`:

- No fly-in / fade animations.
- No bar fill-in animation — bars render at final width.
- Ticker pauses (or freezes mid-frame).
- Numbers still update on poll, just instantly.

## Data layer

### `useLeaderboardData` hook

Single source of truth for leaderboard data. Returns:

```js
{
  players: [
    {
      position: 1,
      previousPosition: 2,
      maskedUsername: "NE****g",
      wagered: 23434853,
      delta: 24810,        // change since last poll, 0 if no change
    },
    // ... 19 more
  ],
  prizePool: 25000,        // dollars
  periodLabel: "MAY 2026",
  weekLabel: "WK 03 OF 04",
  endsAt: 1748376000000,   // ms timestamp for the 30-day timer
  lastUpdatedAt: 1748100000000,
  isLoading: false,
  error: null,
}
```

**Mock implementation:**

- 20 deterministic baseline players from `mockData.js` (seeded so the page is identical across reloads on the same day).
- P01 wagered ~2-3× P02 (per the leader-takeover requirement).
- Smooth log-style distribution down to P20.
- Every 30-60s, fire a poll: pick 1-3 random players, add a randomized delta (range $10k-$500k, weighted toward smaller deltas), recompute positions, update `lastUpdatedAt`.
- Period end (`endsAt`) is computed as 30 days from a fixed start-of-month anchor, so the countdown looks real and rolls forward.

**Real implementation (future):**

- Replace `mockData.js` and the internal interval with a `fetch('/api/leaderboard')` call.
- A new serverless function `api/leaderboard.js` proxies the upstream affiliate API (Rainbet/Roobet/Stake/Shuffle), caches the response, returns the same shape.
- No component changes required.

### `useCountdown` hook

Takes an `endsAt` timestamp, returns `{ days, hours, minutes, seconds }` updated every 1s. When `endsAt` is in the past, returns zeros.

### `useSessionTimecode` hook

Returns a `HH:MM:SS` string counting up from page mount. Powers the REC dot indicator.

## Responsive behavior

- **Desktop (≥sm):** layout as drawn above.
- **Mobile (<sm):**
  - Broadcast header columns stack vertically (left → center → right becomes top → middle → bottom).
  - Leader takeover stays full-width, oversized digits scale down (~36-48px range).
  - Race bars unchanged.
  - Roster table drops the trend column on the smallest viewports if needed; trend stays inline with the wagered figure otherwise.
  - Ticker stays at the bottom.
  - REC dot moves inline with the header eyebrow if it doesn't fit in the top-right corner.

## Accessibility

Per PRODUCT.md: best-effort, no formal WCAG target. Specific commitments for this page:

- Body copy legible on dark gradient — verify wagered figures and labels meet 4.5:1 against the panel background.
- All motion gated behind `prefers-reduced-motion` (see Motion section).
- Ticker has `aria-hidden="true"` (decorative) — the actual leaderboard data is in a semantic table/list, not the ticker.
- Trend arrows have `aria-label` ("up", "down", "no change").
- REC indicator has `aria-hidden="true"` — it's decorative atmosphere, not data.
- Tab order: header → leader takeover (if interactive — currently not) → race bars → roster table → station ID link. Ticker is not in the tab order.

## Out of scope

Explicitly NOT in this design:

- Real API integration (Rainbet/Roobet/etc.) — only the data hook interface is designed; the swap is a future task.
- Player profile pages / click-through detail views.
- Filtering / sorting / pagination on the leaderboard.
- Multiple time periods (only the current 30-day window).
- Historical leaderboards / past months.
- A "your position" highlight for logged-in viewers (Twitch auth integration with the leaderboard).
- Admin tooling to edit the mock data or override values.
- The destination of the `/tools` link in the Station ID — leave as `#` for now.

## Open questions deferred to implementation

These are intentionally deferred so writing-plans can pick them up:

- Exact lucide icon for the `LB` tool tab (Trophy vs. BarChart3 vs. Radio — Radio fits the broadcast register best).
- Exact mock player names — keep them masked (`NE****g` format) per the references, with one or two as in-jokes that read as flavor.
- Final list of ticker copy lines (8-12 lines).
- Whether to add a small "ENTERTAINMENT ONLY · MOCK DATA" tag near the Station ID for clarity, or leave the in-joke ticker to do that work.
