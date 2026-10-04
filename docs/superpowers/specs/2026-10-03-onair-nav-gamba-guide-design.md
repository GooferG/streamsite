# On Air, part 2: the site nav, the Gamba tuner and the guide hub

**Date:** 2026-10-03
**Status:** Approved in brainstorming (pending spec review)
**Builds on:** [2026-10-03-onair-hunts-design.md](2026-10-03-onair-hunts-design.md) (the On Air pilot, PR #37), DESIGN.md §7
**Mockups:** brainstorm session `.superpowers/brainstorm/10589-1791065451/content/` (local only, gitignored): `nav-c-states.html`, `nav-mobile-operator.html`, `strip-dial-hybrid.html`, `hub-live-hunt.html`

## Problem

The Hunts tab now speaks On Air, but everything framing it does not. The global nav is system font, square bordered dropdowns and 2px drawer stripes. The Gamba strip is square bordered tabs with a non-tab Hub button inside a `tablist`. The `/gamba` hub is the home page's searchlight callout plus a bordered list. Channel numbers disagree across the site (hub CH 41–44, strip CH 01–04, callout CH 01, monitor CH 02, nav codes 01–08 that never render).

This work moves the frame onto On Air: the nav on every route, then the Gamba tuner and hub. It also promotes On Air from pilot to the site's design language.

## Decisions (from brainstorming)

1. **The On Air nav runs on every route**, `/admin` included. On Air becomes the site language; the old system stays documented as legacy for pages not yet migrated.
2. **Nav direction "bezel strip"**: the nav is the TV's bezel, with mono chyron labels that show the site channel codes 01–08, a power LED and a live tally.
3. **Gamba menu uses subchannels** `4-0 … 4-4` in the nav only, so "02 Schedule" never sits next to "02 Hunts". Inside `/gamba` the short form `CH 02` stays.
4. **Clicking "Gamba" goes to the hub**; the caret or hover opens the menu. On phones the Gamba row goes to the hub and its subchannels are always listed under it.
5. **Phone nav is a side sheet** (channel list), not a remote keypad.
6. **Operator controls carry no orange.** Inside On Air orange is the winner. The control-room button stays visible; Operator and Admin fold into an OP menu.
7. **The Gamba strip is the "hybrid tuner"**: real labelled channel links under a decorative tuning band whose needle slides to the active channel, with ◀ ▶ steppers. No channel-change static on tool switches; the needle is the only motion.
8. **Channel numbers follow the handoff**: Hub 00, Leaderboard 01, Hunts 02, Bonus Battle 03, Slot Picker 04, stored once on `GAMBA_TOOLS`.
9. **The hub is a live channel guide**: one featured monitor plus "What's on" listings. Hunts takes over the monitor while it is on air; otherwise the leaderboard has it.
10. **The home page stays as it is**, except its tool list reads the new channel numbers.
11. **Two PRs, nav first.**

## Scope

- **PR 1 (`feat/onair-nav`)**
  - DESIGN.md promotion of On Air.
  - Channel data on `GAMBA_TOOLS` and the two formatters.
  - The new nav: desktop bar, Gamba menu, account and operator controls, live tally, off-air readout, phone side sheet.
  - Shared bits: `onAir/Popover`, `onAir/StatusLight` (extracted from `Monitor`), the `NAV_H` constant, `nextScheduledStream()`.
- **PR 2 (`feat/onair-gamba-guide`)**
  - The hybrid tuner, which replaces the strip, the mobile channel trigger and the channel sheet.
  - The guide hub with the hunt takeover.
  - Dev fixtures for the hub.

## Non-goals

- Migrating brand pages, `/admin` content, Leaderboard, Bonus Battle or Slot Picker. They keep their current content under the new chrome. This seam is accepted.
- Changing the home page's leaderboard callout or tools list beyond the channel numbers.
- A remote-keypad phone menu, a draggable dial, or static on tool switches.
- New data sources. The nav and hub only read what the app already fetches.

## Unchanged

- Routes and destinations.
- The control room panel and its geometry: the nav keeps its 57px height.
- Auth flows: Twitch sign-in, admin email sign-in, the 5-click wordmark and Konami shortcuts to `/admin`.
- The OBS routes, which render outside the shell with no nav.
- The Hunts tab content.

## Part 1: On Air becomes the site language (PR 1)

### DESIGN.md

- §7 drops "(pilot: /gamba/hunts)" and becomes the primary system. Its rules (Depth Not Borders, Glow Means Something, Readable Labels, Roles Inside On Air, Honest Set Dressing, Contract Test, Motion Has An Off Switch) apply to every migrated surface.
- §3's system-font and "Don't import a webfont" rules are retired. Bricolage Grotesque and JetBrains Mono are the site fonts, loaded once in `public/index.html` as today.
- §5 "Navigation" is rewritten for the bezel nav (Part 3 below), including the operator rule: no orange in the nav.
- §2–§6 stay, marked **legacy (until migrated)**. They describe brand pages, `/admin`, and the three Gamba tools not yet moved. The orange-is-admin and red-is-destructive roles apply only on legacy surfaces.
- §1's North Star is kept; the "Key Characteristics" bullets point to §7 for depth and type.

### Channel data

- `src/data/gambaTools.js`: each `GAMBA_TOOLS` entry gains `channel` (number, 1–4). `GAMBA_TOOLS` stays the four tools (the home list and the guide listings map it). A new `GAMBA_CHANNELS = [HUB, ...GAMBA_TOOLS]` adds the channel-00 Hub (`{ id: 'hub', label: 'Hub', channel: 0, path: '/gamba' }`) for the tuner, the nav menu and the side sheet. Every entry exposes its `path` (`/gamba` or `/gamba/${id}`).
- Two pure formatters next to the data:
  - `channelLabel(tool)` → `CH 02` (inside `/gamba`: tuner, hub, monitor headers).
  - `subchannelLabel(tool)` → `4-2` (nav menu and side sheet). The `4` comes from the Gamba nav item's code, not a literal.
- `HuntMonitor`'s hard-coded `CH = 'CH 02'` reads `channelLabel` of the hunts tool.
- `HomeGambaTools` drops `CHANNEL_BASE = 41` and reads `channelLabel`. That is the only home page change.

## Part 2: The nav (PR 1)

### Nav files

`src/components/Navigation.js` (656 lines) is replaced by `src/components/nav/`:

| File | Job |
| --- | --- |
| `Navigation.js` | Shell: fixed bezel bar, breakpoints, composes the parts. Same props contract plus the live props below. |
| `navItems.js` | `NAV_ITEMS` with codes 01–08 (Home, Schedule, Vods, Gamba, Gaming, Store, Giveaway, About). |
| `GambaMenu.js` | "04 Gamba" link to `/gamba` plus a caret disclosure listing `4-0 … 4-4`. |
| `StatusReadout.js` | Power LED, live tally, off-air readout. |
| `AccountMenu.js` | Signed out: Sign in. Viewer: avatar disclosure (My account, Store, Sign out). |
| `OperatorControls.js` | Control-room button, plus the OP disclosure for the admin. |
| `NavSheet.js` | Phone side sheet. |
| `navMetrics.js` | `NAV_H = 57`. `controlRoom/geometry.js` imports it instead of declaring its own. |

New shared primitives:

- `src/components/onAir/Popover.js`: an On Air panel anchored under a trigger. It handles outside click, Esc (closes and returns focus to the trigger), and closing when focus leaves. It has its own fade keyframe; today's dropdown borrows `gamba-sheet-fade`, which only exists while GambaPage's sheet is mounted.
- `src/components/onAir/StatusLight.js`: the LIVE/REPLAY light extracted from `Monitor` so the nav tally and the monitor share one component.

Shared util: `src/utils/schedule.js` exports `nextScheduledStream(schedule, now)`, lifted from `HomeHero` (same behaviour: the first non-`off` entry from today forward). HomeHero imports it.

### Props from `App.js`

`Navigation` gets `isLive`, `viewerCount` (`streamData?.viewer_count`) and `statusReady`. `App.js` sets `statusReady` true in the success path of the first Twitch poll that succeeds; a failing poll never sets it, so the nav never claims "off air" without knowing. Later failures keep the last good `isLive`, as today. No new Twitch calls, per the "props from App.js" convention. The viewer-count formatter moves from `HomeHero` to a shared util.

### Nav visuals (tokens only, no raw hex)

- **Bar:** fixed, full width, `h-[57px]` from `NAV_H`, `bg-gradient-to-b from-onair-bezel-top to-onair-bezel-bottom` with a new `shadow-onair-bar` token (`inset 0 1px 0 rgba(255,255,255,.09), inset 0 -2px 0 rgba(0,0,0,.6)`). No border. `font-onair` on the bar only.
- **Wordmark:** LED, then "GooferG" in Bricolage 800 at 20px, `onair-ink-1`. Link to home.
- **Links:** `font-onair-mono` uppercase, 11px, 0.15em tracking, 600 weight, `onair-ink-4`. The code is 400 weight `onair-ink-5`.
  - Hover: `onair-ink-1` on `bg-white/5`.
  - Active: `onair-signal-light` text on an `onair-signal` 8% wash, code in `onair-signal`, `aria-current="page"`. No underline.
  - Radius `rounded-onair-tile`.
- **Power LED:** the Monitor bezel LED.
  - Glows (`shadow-onair-led`) only while live; dark otherwise.
  - `aria-hidden`, no cursor, no hover (Honest Set Dressing).
- **Tally (live):** `StatusLight` live, reading `LIVE · 1.2K`.
  - Links to `/`; on `/` it is plain status text.
  - Accessible name "Live now, 1,204 watching".
- **Readout (off air):** a pill like the Monitor readout (`bg-black/35`, mono 10px, 0.2em, `onair-ink-4`, dot `onair-ink-6`).
  - Reads `OFF AIR · MON 5:00 PM EST`: day abbreviated, the start of the `time` range, and the zone suffix when present.
  - Links to `/schedule`. With no upcoming stream it reads `OFF AIR`.
  - Lives in its own component so `useSchedule` mounts only while off air.
- **Before `statusReady`:** no tally and no readout, so there's no "Off air" flash while the channel is live.
- **Sign in:** `OnAirButton` viewer, size `sm`, with the Twitch glyph.
- **Avatar:** 34px round. The disclosure lists My account, Store and Sign out in a `Popover`. Rows are `rounded-onair-control`; Sign out is plain ink, since it isn't a loss.
- **Control-room button:**
  - Idle: `OnAirButton` ghost `sm` with the `MonitorPlay` icon (label visible ≥1280px, `sr-only` below).
  - Giveaway open: `onair-signal` tone (`bg-onair-signal/14`, `text-onair-signal-light`) with a dot and the entry count.
  - Keeps `data-control-room-button`, `aria-keyshortcuts="\`"` and the title text the control room relies on.
- **OP disclosure (admin only):** a 34px round `onair-surface-raised` badge reading `OP` (mono, `onair-ink-2`). Its `Popover` lists Control room (with the backtick hint), Admin and Sign out.
- **Identity cluster:**
  - Signed out: Sign in.
  - Viewer: avatar.
  - Staff (non-admin): control-room button, then avatar.
  - Admin: control-room button, then OP.
  - Admin XOR viewer, as today.
- **Gamba menu:** a `Popover` (Panel surface, `rounded-onair-row`, padding 8).
  - Header: `04 · GAMBA` (mono, `onair-ink-5`).
  - Rows: `4-0 Hub` … `4-4 Slot Picker`, Bricolage 15px/700. The current tool's row gets the signal wash and a `NOW` tag.
  - Hover opens, with the existing 120ms close delay; the caret button toggles.

### Nav breakpoints

| Width | Bar |
| --- | --- |
| ≥1280 (`xl`) | LED · wordmark · 8 links with codes · tally with count / readout · identity cluster |
| 1024–1279 (`lg`) | Codes hidden (labels stay), tally without count, readout without the time |
| <1024 | LED · wordmark · compact tally (`LIVE`, live only) · menu button (40px, `rounded-onair-control`, ghost) |

The desktop links move from `md` to `lg` because eight mono labels don't fit a tablet. The root font-size scale at ≥1536px still applies (everything is in rem).

### Phone side sheet

- **Panel:** slides in from the right under the bar (`top: NAV_H`, bottom 0), width 300px (max 85vw), `rounded-l-onair-card`, Panel surface and `shadow-onair-card`. The scrim is `bg-black/60` with `backdrop-blur-sm` (the drawer is an allowed glass surface).
- **Contents, top to bottom:**
  - Identity block:
    - Viewer: avatar, name, "Signed in · Twitch", and ghost Account and Sign out buttons.
    - Signed out: the viewer Sign in button.
    - Admin: OP badge and "Signed in · Admin".
  - The status readout or tally, full width.
  - Rows 01–08: mono code plus Bricolage 16px/700 name, `rounded-onair-control`; the active row gets the signal wash. The Gamba row links to `/gamba`; under it, `4-0 … 4-4` are always listed, indented, with the current one marked `NOW`.
  - Staff section headed `Operator`: Control room (opens the panel here, or goes to `/admin/giveaways` where the panel is hidden, as today) and Admin (admin only).
- **Behaviour:**
  - Closed: `inert` and `aria-hidden`. This closes the deferred PR #37 item.
  - Open: body scroll is locked, focus moves to the first focusable element, Esc or the scrim closes it, and focus returns to the menu button.
  - Navigating closes the sheet.
  - The slide (200ms) is off under reduced motion.

## Part 3: The Gamba tuner (PR 2)

### Tuner files

- `src/components/gamba/GambaTuner.js` replaces `ChannelTab`, `MobileChannelTrigger` and `MobileChannelSheet` (and the `gamba-sheet-*` keyframes) in `src/pages/GambaPage.js`.
- `GambaPage` becomes: tuner, then the hub (no tool id) or the tool surface.
- An unknown `/gamba/<id>` redirects to `/gamba` (`<Navigate replace>`); today it renders an empty surface.
- `ToolLoading` moves to On Air mono ink (`onair-ink-4`, still pulsing under `motion-safe`).
- Only the tuner and hub set `font-onair`. The legacy tools keep their own type.

### Tuner semantics

- `<nav aria-label="Gamba channels">` containing five react-router `Link`s (Hub plus the four tools) with `aria-current="page"` on the active one. Links, not tabs.
- ◀ and ▶ are buttons named for their target ("Previous channel: Leaderboard", "Next channel: Bonus Battle"). They wrap Hub ↔ Slot Picker.
- The tuning band (dotted `bg-onair-track` plus needle) is `aria-hidden`, has no pointer events or cursor, and can't be dragged.

### Tuner visuals

- One Panel (`rounded-onair-row`, padding 6) holding ◀, the middle column, and ▶. The middle column is the band (10px track, inset 6px) over the segment row.
- Segments: `rounded-onair-control`, Bricolage 15px/700 `onair-ink-3` name with a mono 11px `CH 0n` in `onair-ink-5`.
  - Hover: `bg-white/5`.
  - Active: `onair-ink-1` name, `onair-signal` code, and the Panel signal wash (`lit="signal"` treatment).
  - Focus: the On Air `FOCUS` outline.
- Needle: 2px `onair-signal` bar positioned at the active segment's centre. No glow, since it's a marker.
  - It transitions `left` over 300ms ease-out when the channel changes. Under `prefers-reduced-motion` it jumps.
  - It never animates on first paint.
- Steppers: 44px wide, `rounded-onair-control`, ghost surface (`bg-white/[0.07]`).

### Tuner breakpoints

| Width | Tuner |
| --- | --- |
| ≥1024 | Five segments with `CH 0n` and name |
| 768–1023 | Five segments, names only |
| <768 | Stepper: ◀ · thin band · `CH 02 Hunts · 3 of 5` · ▶ (segments hidden; the side sheet lists every channel) |

## Part 4: The guide hub (PR 2)

### Guide files (`src/components/gamba/`)

| File | Job |
| --- | --- |
| `GambaGuide.js` | The hub: featured monitor, then "What's on" listings. |
| `FeaturedMonitor.js` | Wraps `onAir/Monitor`; renders the hunt screen or the leaderboard screen. |
| `GuideListings.js` | One listing row per tool. |
| `useGuideData.js` | Combines `useLeaderboardData`, `useCommunityHunts`, `usePredictionRound`. |
| `guide.js` | Pure derivations: `pickFeatured`, hunt facts, leaderboard facts, listing text. Reuses `huntStats`, `huntMode`, `tickerItems` and `huntBoard` where they fit. |
| `guideFixtures.js` | Dev-only fixtures. |

`src/components/GambaHub.js` is deleted. `HomeLeaderboardCallout` and `HomeGambaTools` stay (home uses them).

`Monitor` gains a `label` prop (default "Hunt monitor") for its `aria-label`, so the hub can name its screen ("Featured channel").

### The takeover rule (`pickFeatured`)

- `featured = 'hunts'` when either holds:
  - the communityhunts live hunt exists, or
  - the latest prediction round has `acceptPredictions` true and `status` `open` or `locked`.
- Otherwise `'leaderboard'`.
- A failed or still-loading hunts read never selects `'hunts'`.
- `channelKey` is the featured value, so `Monitor` plays its channel-change static when the takeover starts or ends after first render, and never on mount. It's off under reduced motion.

### Hunt screen

- **Live hunt:**
  - Monitor setup: `tint="signal"`, `status="live"`, channel `CH 02 · HUNTS`, live clock.
  - Eyebrow `{huntType} HUNT · OPENING BONUSES`.
  - Hero: won so far, with `N/M OPENED`.
  - Progress: one notch per bonus (opened in `onair-signal-deep`, unopened `onair-ink-7`). Above 60 bonuses it becomes a continuous bar.
  - Side stats: start cost and the still-needed average (`huntStats`).
  - Chip: `PREDICTIONS OPEN · N IN` (signal) or `ENTRIES CLOSED · N GUESSES` (neutral). No chip without a round.
  - CTA to `/gamba/hunts`: `OnAirButton` viewer "Get your guess in" while the round is open, otherwise ghost "Watch the opening".
  - Chyron tagged `OPEN` or `CLOSED`, items from `tickerItems` for the matching mode.
  - Readout `CH 02 · ENTRIES OPEN` or `ENTRIES CLOSED`.
- **Pre-hunt** (round open or locked, no live hunt):
  - Same tint, no status light.
  - Eyebrow `{round title} · PREDICTIONS OPEN`.
  - "What does the hunt pay?", with the required average, or the start cost as break-even, from the round snapshot.
  - Chips: bonuses, guesses in. Viewer CTA "Get your guess in".
- **Phones:** follow the Hunts monitor's compact rules (screen padding 18px, hero `clamp`, side stats wrap under the hero, clock hidden).

### Leaderboard screen

- `tint="neutral"`, no status light, channel `CH 01 · LEADERBOARD · {periodLabel}`; the clock slot shows `RESETS IN 27D 04H` (`useCountdown`).
- Eyebrow `CODE BEAN ON RAINBET · MONTHLY POOL`; hero is the prize pool; side stats are leader (masked handle · wagered), 1st prize, and lead.
- Ghost CTA "View standings" to `/gamba/leaderboard`. Chyron tagged `STANDINGS` runs the top 5 (`1 AB***Z $41,203 ★ …`).
- No count-up and no Rainbet blue. Handles arrive pre-masked; never re-mask.
- **Failure:** a failed leaderboard read shows a "No signal" screen (as the Hunts tab does), never zeros.

### Listings ("What's on · Tonight's listings")

Each row is one `Link` to its tool:

- Container: `rounded-onair-row`, Panel row surface.
- Desktop grid: `CH · channel · On now · Up next · →`. Phones: CH plus name on one line, On now and Up next stacked below.

| Row | On now | Up next | Lit |
| --- | --- | --- | --- |
| Leaderboard | `ab***z leads · $41,203`, plus the pool when Hunts holds the monitor | `Resets in 27d 04h` | Never |
| Hunts (live) | LIVE light · `{type} hunt · 14/37 opened · $1,204 won` | `Predictions open · N in`, `Entries closed · N guesses` or `No round open` | Yes |
| Hunts (pre-hunt) | `{round title}` · `Predictions open` | `N guesses in` | Yes |
| Hunts (off air) | `Last hunt +$375.70` (teal) / `−$120.00` (`onair-loss`) | `No round open` | No |
| Hunts (read failed) | `No signal` | — | No |
| Bonus Battle | `Two bonuses, one winner. Call it.` | `Any time` | Never |
| Slot Picker | `Spin up a random slot to play next.` | `Any time` | Never |

The Hunts row is lit exactly when `pickFeatured` returns `'hunts'`: the lit row is the channel on the monitor. The teal wash means live or open and nothing else, so the Leaderboard row never lights.

### Data cost

A hub visit adds the communityhunts overview poll (60s, server-cached 30s, the same load as the Hunts tab and within Bean's shared 300 reads/min) and one Firestore listener on the latest `hunts` doc (limit 1). The leaderboard poll already exists.

### Dev fixtures

`/gamba?fixture=live|prehunt|offair|noleaderboard` renders the guide from `guideFixtures.js`, gated by `process.env.NODE_ENV !== 'production'` like the Hunts fixtures.

## Accessibility

- Every nav, tuner, menu and listing destination is a real link. Disclosure buttons carry `aria-expanded` and `aria-controls`. No `role="menu"`.
- Active destinations use `aria-current="page"`.
- Status text is real text: tally, readout, readouts on the monitor, chyron (its duplicated half `aria-hidden`).
- Decoration is `aria-hidden` with no cursor or hover: the LED, tuning band, needle and progress notches. The opened count is in the text.
- Visible focus on every control (On Air `FOCUS`).
- Targets are at least 40px on phones (side sheet rows, steppers, menu button).
- Reduced motion turns off the needle slide, the sheet slide, the monitor static, the LIVE pulse and the chyron scroll.
- Informational text is never fainter than `onair-ink-5` (the contract test enforces it).

## Testing and verification

- **Unit:**
  - `channelLabel` / `subchannelLabel`.
  - `nextScheduledStream`: wraps the week, skips `off`, empty schedule.
  - The readout formatter: range, zone suffix, missing time.
  - `pickFeatured`: live hunt; open round with no hunt; locked round; settled round; `acceptPredictions: false`; hunts read error; loading.
  - Hunt facts, including the notch cap at 60.
  - Leaderboard facts.
  - Listing text for each row state.
- **Components (PR 1):**
  - Navigation identity states: signed out, viewer, staff, admin.
  - Live with a count, off air with the next stream, and nothing before `statusReady`.
  - Active link `aria-current`.
  - The Gamba split: the label navigates to `/gamba`, the caret toggles, Esc returns focus.
  - The `NOW` row.
  - The side sheet: inert while closed, focus in on open and back on close, the Gamba row and subchannels.
  - The control-room button: live count, data attribute kept.
- **Components (PR 2):**
  - The tuner: five links, `aria-current`, prev/next targets with wrap, needle position per channel, no transition on mount.
  - GambaPage: `/gamba` shows the hub, `/gamba/hunts` the tool, an unknown id redirects.
  - FeaturedMonitor: each screen, and that static plays on a takeover change but not on mount.
  - GuideListings: the lit live row, the unlit leaderboard row, the failure row.
- **Contract test:** `onAirContract.test.js` scans `src/components/nav/` and `src/components/gamba/` too.
- **Gates:** `npm test -- --watchAll=false` and `npm run build` (ESLint) pass on each PR.
- **Visual:**
  - PR 1: the nav on `/`, `/schedule`, `/gamba/hunts` and `/admin`, at 1440, 1280, 1100, 1024, 768 and 375px.
  - PR 2: every hub fixture and every tool route, at 1280 and 375px.
  - Both: reduced motion emulated, plus a keyboard pass through the bar, menus, sheet, tuner and listings.
- **Review:** `ui-finish-gate` against DESIGN.md §7 and `accessibility-auditor` before each PR. Their holds are fixed before the PR opens.

## Delivery

- **PR 1:** `feat/onair-nav`. Commit order:
  1. Channel data and formatters.
  2. `Popover` / `StatusLight` / `NAV_H` / `nextScheduledStream` (with HomeHero and geometry switched over).
  3. Nav parts.
  4. Side sheet.
  5. App.js wiring and old `Navigation.js` removal.
  6. DESIGN.md and CLAUDE.md.
- **PR 2:** `feat/onair-gamba-guide`, from main after PR 1 merges. Commit order:
  1. Tuner and GambaPage.
  2. Guide derivations and hook.
  3. FeaturedMonitor and listings.
  4. Fixtures.
  5. `GambaHub` removal.
  6. CLAUDE.md.
- Built in the main checkout (no worktrees), with the branch checked in the same command as every commit.
- GitHub PRs for the owner to merge. No Claude attribution in commits or PR bodies.
