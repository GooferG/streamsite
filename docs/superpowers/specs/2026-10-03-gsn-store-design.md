# GSN: the store as the Goofer Shopping Network (On Air, second surface)

**Date:** 2026-10-03
**Status:** Approved in brainstorming (pending spec review)
**Mockup:** `docs/redesign/gsn-store/gsn-page.html` (approved page, order-moment storyboard, phone layout, art slots)
**Builds on:** `docs/superpowers/specs/2026-10-03-onair-hunts-design.md` (On Air tokens, primitives, DESIGN.md §7)

## Problem

`/store` is a bare page: a slate header, a status bar, and a three-column grid of bordered cards in the old hard-lined look. The live catalogue has three items (Roll a blunt 420, Pick a Slot 1500, $ARS 10,000 Bonus Buy 10000 with stock 5), so the grid reads as empty. It also has real UX faults:

- **Redeeming takes one click and has no confirmation.** A misclick spends 1,500 tickets.
- **It's a dead end when you're short.** The button says "Need N more", and the store never says how to earn more. The daily drop, Discord bonus and watch-time info all live on `/account`.
- **Nothing tells you what happens next.** "Played on stream" orders vanish into a queue you can only see on `/account`.
- **Item images are hotlinked** (a Brave image-proxy URL and a Trustpilot logo) and mixed in style. Either link can break.

The owner wants the On Air look from `/gamba/hunts` carried to the store, with UX that improves the page and a moment that feels made for this channel instead of generated.

## Scope and non-goals

- **In scope:**
  - A rebuilt `/store` as the Goofer Shopping Network: a monitor stage, a wallet slip, a full lineup, ways to earn, and your orders.
  - Hold-to-order with an accessible two-step fallback.
  - The order moment: line connects, order received, stub tears off, balance rolls.
  - A public order feed (last 8 orders) on the chyron, through a public Firestore doc.
  - Shared `useDailyDrop` and Discord-link helpers, so `/account` and `/store` run the same logic.
  - Small, backward-compatible additions to the On Air primitives (`Monitor`, `Ticket`) and two new ones (`HoldButton`, `RollingNumber`).
  - Generated art from the owner's local ComfyUI: house-style item art for the current catalogue, the GSN operator in three poses, and a station ident backdrop.
  - Dev-only fixtures (`/store?fixture=…`) for visual checks.
- **Non-goals:**
  - Redesigning `/admin/store` (it stays in the admin register).
  - New item fields (tagline, category), search or filters. The lineup handles about 12 items without them.
  - Per-item routes. A `?item=<id>` deep link is enough.
  - Migrating the global nav.
  - Changing ticket rates or the economy.
  - Removing earn and orders from `/account`. It keeps them and shares the hooks.
  - Phase 2 (optional, decided after the stills land): a 2-second Wan 2.2 loop of the operator picking up the phone.
- **Unchanged:**
  - `api/store/redeem.js` transaction semantics (only a best-effort feed write after commit).
  - `api/me/claim-daily.js`, `api/discord-auth.js`, the redemption admin flow apart from the feed cleanup on cancel, and the ticket ledger.
  - The site body gradient. The page sits on it like the Hunts tab does.

## Decisions (from brainstorming)

1. **Concept: Goofer Shopping Network.** A late-night home-shopping channel. One item is "on air" in the monitor; the chyron runs "operators are standing by" and real orders. Chosen over a prize counter (too close to a product grid, leans arcade/casino) and a program guide (least theatrical, thin with 3 items).
2. **Tickets hub scope.** The store owns your wallet, ways to earn (including claiming the daily drop in place) and your orders.
3. **Public order feed, names shown.** Display name, item and time only. Viewers already see these orders played on stream.
4. **All items in one place: the lineup grid under the stage.** It's always visible, and cards tune the monitor. The on-screen guide overlay was rejected.
5. **ComfyUI for art.** Generated assets ship as static files. Nothing calls ComfyUI at request time.

**Deviation from brainstorming, called out for review:** the feed was pitched as a cached `/api/store/recent` endpoint. This spec uses a public Firestore doc (`store_public/feed`) written after each order instead. It's realtime (an order shows up on everyone's chyron within a second), costs one read per change per open page instead of a 10-doc query every cache window, and stays well inside Spark's daily read budget. Privacy is the same: name, item and time only.

## Page anatomy

The order top to bottom is ident → stage → lineup → earn and orders. The approved mockup is the reference for proportions.

### Ident and headline

- A station bug: **GSN** in a light rounded tile (CSS, not art) followed by mono `Goofer shopping network` and a status line.
- The status line is live-aware. When the channel is live: `Lines open · Goofer is live`, with the Monitor's LIVE light on. When offline: `Orders queue for the next stream`.
- Headline `Operators are standing by.` (Bricolage 800). One line of body copy: `Spend the tickets you earn hanging out in chat. Anything marked played on stream happens live, in order.`

### Stage

Two columns from `lg` (monitor `flex-1`, wallet slip `300px`). Below `lg` the wallet becomes the dock (see Phone).

**Monitor (`Monitor` primitive).** Its screen shows one of four channels:

- **Item** (default). The item art in a 4:3 frame on the left (scanlines over it unify mixed imagery), then name, description, the price as a large figure in signal teal, and chips (`Played on stream` / `Instant`, `Unlimited` / `5 left` / `Sold out`). Screen top line: `CH 02 · Now selling`. Top right (the `clock` slot): `2 of 3`.
- **Ident**: the station backdrop art with the CSS GSN bug over it. Used while loading (`Tuning in…`), when the catalogue is empty (`Off the air. Nothing on the shelf yet.`), and when the catalogue fails to load (`Signal lost. Try again in a bit.`).
- **Order received**: winner tint. `Order #R7Q2` (the last 4 characters of the redemption id, uppercase), `You're on the list.` for stream items or `Granted.` for instant ones, and the operator PiP (thumbs-up / standing-by pose).
- **Lines busy**: neutral tint. The operator shrug pose, the plain error message, and `No tickets were spent.`

The bezel readout shows `CH 02 · 420 TK`. Real **Previous / Next** buttons sit in the bezel strip (new `controls` slot); the CH knob stays decorative and turns a notch on every tune. Changing channel uses the existing static burst (`channelKey`).

The chyron (tag `Order line`) runs, in order:

- up to 5 feed orders from the last 48 h: `Order in · {name} · {item}`. When the order is the viewer's own, `you` replaces the name, in viewer purple.
- `{item} · {n} left` for each item with stock of 5 or less.
- a live line: `Goofer is live, orders get played tonight` when live, `Orders queue for the next stream` when not.
- `Operators are standing by`.

**Wallet slip (`Ticket` primitive).**

- Header: `Your wallet`, the viewer's display name, and the balance as a `RollingNumber`. (The mockup's "+12 tonight" line is dropped: the user doc has no per-stream figure, and it isn't worth new data.)
- Below the perforation, for the tuned item:
  - **can afford**: a three-line receipt (`Balance`, `−cost`, `After`) and the `HoldButton` (`Hold to order`), with the hint `Press and hold · let go to cancel`.
  - **short**: `{short} short`, a progress bar (balance / cost), `About {h} h of hanging out in chat` (less if you chat), and a ghost `Ways to earn` button that scrolls to the earn panel.
  - **sold out**: `Sold out` and a disabled button.
  - **signed out**: `Sign in with Twitch to get a wallet` and a viewer-purple `Sign in with Twitch` button.
  - **no user doc**: `Your wallet isn't set up yet. Sign out and back in.`

### Full lineup

- Eyebrow `Full lineup` and heading `Everything on tonight`, with `{n} channels` on the right.
- A grid with `repeat(auto-fill, minmax(240px, 1fr))` from `sm`; a single column of compact rows below `sm`.
- Order: `sortOrder` ascending, then `cost` ascending. Channel numbers `CH 01…` follow that order.
- **Card** (`Panel radius="row"`): a 16:9 mini-screen with the art and scanlines, the channel number, the kind label, the name, the price, and one status:
  - `You can order` (signal chip)
  - `{short} short` plus a progress bar
  - `{n} left` (neutral chip)
  - `Sold out` (neutral chip, art dimmed)
  - signed out: no status
- The tuned card is lit `signal` and shows an `On screen` tag. Clicking a card tunes the monitor (static burst, knob notch) and, below `lg`, scrolls the monitor into view (`block: 'nearest'`).

### Ways to earn (`Panel`)

Heading `Short on tickets?`. Three rows:

- **Daily drop.** `Ready to claim` with a viewer button `Claim +10`, or `Next drop in 5h 12m`. A claim rolls the balance up by the server's `awarded` amount.
- **Hang out in chat.** `+1 every 5 min while live, +1 more if you talk`, with the viewer's total watch time on the right (`user.watchMinutes`).
- **Link Discord.** `Linked` (signal chip) or a `Link Discord +100` button that starts the existing Discord OAuth flow.

Signed out, the panel shows the same three rows as plain information, with one `Sign in with Twitch` button.

### Your orders (`Panel`)

Heading `On the list`. The viewer's last 5 redemptions, newest first. Status chips:

- `pending` → `Called in` (signal)
- `fulfilled` + `stream` → `Aired`
- `fulfilled` + `virtual` → `Granted`
- `cancelled` → `Refunded` (loss red: a negative result inside On Air)

Each row also shows relative time. Below the list: `See everything on your account` → `/account`. Empty: `Nothing called in yet.` Hidden when signed out.

### Phone (below `lg`)

- The order is ident, monitor, lineup, earn, orders.
- The wallet slip becomes a **dock** pinned to the bottom: the ticket gradient, balance (`RollingNumber`), and `Hold to order · {cost}` for the tuned item. When short it shows `{short} short` with a ghost `Ways to earn`; signed out it shows `Sign in with Twitch`.
- The page adds bottom padding equal to the dock height, so nothing ends up hidden under it. The dock's z-index stays below the staff Control Room panel and pill (`z-[65]`).
- The monitor drops the description to keep the price visible above the fold at 375px.

## The order moment

A state machine in `useOrder`: `idle → confirming? → calling → received | busy → idle`.

1. **Hold.** `HoldButton` fills left to right over **900 ms** while a pointer or Space is held. Releasing early cancels and spends nothing. A completed hold calls `order(item)`.
   - **Two-step fallback.** Any activation that is not a completed hold (a quick click or tap, Enter, a screen reader's virtual click) arms a confirm state for 4 s: `Press again to spend 420`. A second activation inside that window orders. Both paths make a single misclick harmless.
2. **Calling.** The monitor's `channelKey` changes to `order:{itemId}`, which fires the static burst. The screen shows the operator PiP (on-the-phone pose) and `Line 1 · connecting…`. `POST /api/store/redeem` runs. The calling screen stays up for at least **900 ms**, so the bit lands even when the API is fast (skipped under reduced motion).
3. **Received.** The monitor cuts to the winner-tinted bumper. The wallet slip's stub tears away: a ghost copy of the lower half, showing `−420`, drops and rotates out over 600 ms through `Ticket`'s new `stubOverlay` slot, while the real stub shows the new state underneath. The balance rolls down as soon as the user doc snapshot lands. An `aria-live` region announces `Order in: Roll a blunt, order R7Q2. 660 tickets left.` After **2.6 s**, or on any tune, the monitor returns to the item channel.
4. **Busy.** Any error lands here. Messages are plain:
   - `INSUFFICIENT_TICKETS` → `Not enough tickets.`
   - `OUT_OF_STOCK` → `Sold out while you were holding.`
   - `ITEM_INACTIVE` → `This one just went off the air.`
   - `USER_NOT_FOUND` → `Your wallet isn't set up yet. Sign out and back in.`
   - network → `Lines are busy. Try again in a sec.`

   Each is followed by `No tickets were spent.` (the redeem transaction guarantees it). The card stays until the viewer tunes or presses `Back to the lineup`.

Only one order can be in flight. While calling, every hold button is disabled.

**Reduced motion:** the hold still needs the full 900 ms (it's the confirmation, not decoration). The static burst, stub tear, number roll and minimum calling time are all skipped, and every transition is an instant cut.

## Data

### Reads (client)

| Data | Source | Notes |
| --- | --- | --- |
| Catalogue | `store_items` where `active == true`, `onSnapshot` | As today. The page then sorts by `sortOrder`, then `cost`. |
| Wallet | `users/{uid}` via `useUserDoc` | Uses `tickets`, `watchMinutes`, `lastDailyClaimAt`, `discordId`. |
| Your orders | `redemptions` where `userId == uid` orderBy `createdAt desc`, limit 5 | Same shape as `/account`'s query (which uses limit 15), so the composite index exists. |
| Order feed | `store_public/feed` (one doc), `onSnapshot` | New. |
| Live state | `isLive` prop from `App.js` | `App.js` already polls Twitch. `<StorePage isLive={isLive} />`. |

### The feed doc

`store_public/feed`: `{ orders: [{ id, name, itemName, at }], updatedAt }`. Newest first, capped at 8. `at` is epoch ms. `name` is `displayName || twitchName`.

- **Write on order.** After the redeem transaction commits, `api/store/redeem.js` runs a separate small transaction that prepends the entry and trims the list to 8. It's best effort: a failure is logged and never changes the redeem response.
- **Remove on cancel.** `api/admin/redemptions.js` (`cancel`) removes the entry with that redemption id, also best effort, so refunded orders leave the ticker.
- **Pure logic** lives in `api/_lib/storeFeed.js` (`pushOrder(orders, entry)`, `dropOrder(orders, id)`) and is unit-tested.
- **Rules** (`firestore.rules`): public read, server-only write, shown below. Deploying them is an outward-facing step the owner confirms: `firebase deploy --only firestore:rules --project goofer-website`.
- **Budget:** one extra write per order and one read per open store page per order. That's negligible against Spark's limits.

```text
match /store_public/{doc} {
  allow read: if true;
  allow write: if false;
}
```

### Client-side rates

`src/utils/earnRates.js` mirrors the server defaults the copy depends on: watch 1 ticket per 5-minute window (12/h), chat bonus +1 per window, daily drop 10, Discord link 100. A comment names the env vars they mirror (`WATCHTIME_TICKETS_PER_WINDOW`, `WATCHTIME_CHAT_BONUS`, `DAILY_TICKET_AWARD`, `DISCORD_LINK_TICKET_AWARD`). Real awards always come from API responses; these constants only drive the hint copy and the hours estimate.

Hours estimate: `ceil(short / 12)` hours. Under 1 h it reads `Under an hour of hanging out`.

## Components and files

**New, in `src/components/store/`.** Everything except the hooks is pure (props in, JSX out), like `HuntsTab`.

| File | Job |
| --- | --- |
| `StoreFront.js` | Composes the page from props: `items`, `user`, `viewer`, `orders`, `feed`, `isLive`, the order state and the callbacks. Holds the tuned item id. |
| `StoreMonitor.js` | `Monitor` with the item / ident / received / busy channels, the chyron, readout and prev/next controls. |
| `WalletSlip.js` | The `Ticket` wallet for `lg+`, plus a `WalletDock` export for phones. Same states. |
| `Lineup.js` | The grid / compact rows and `LineupCard`. |
| `EarnPanel.js` | Daily drop, watch time, Discord. |
| `OrdersPanel.js` | Your last 5 orders. |
| `storeModel.js` | Pure helpers: `lineup(items)`, `affordability(balance, item)` → `{ canOrder, short, pct }`, `stockLabel(item)`, `kindLabel(kind)`, `orderStatus(r)`, `hoursToEarn(short)`, `orderNumber(id)`, `chyronItems({ feed, items, isLive, myOrderIds, now })`. |
| `useStoreItems.js` | The catalogue listener (moved out of the page). |
| `useMyOrders.js` | The viewer's last 5 redemptions. |
| `useStoreFeed.js` | The `store_public/feed` listener. |
| `useOrder.js` | The order state machine and the `/api/store/redeem` call. |
| `storeFixtures.js` | Dev-only fixtures: `signedout`, `loading`, `empty`, `rich`, `short`, `soldout`, `received`, `busy`. Stripped from production the same way `huntFixtures` is. |

**New On Air primitives (`src/components/onAir/`):**

- **`HoldButton.js`** wraps `OnAirButton` and uses `useHoldToConfirm({ duration: 900, confirmWindow: 4000, onConfirm })`. It handles pointer down/up/leave/cancel, Space keydown/keyup (ignoring key repeat), the click-to-arm fallback, and `aria-describedby` hint text. The fill is a scaleX transform on an inner span.
- **`RollingNumber.js`**: one column per digit, each a 0–9 strip moved with `translateY` (CSS transition, 700 ms). Separators stay static, `tabular-nums`. Under reduced motion it renders the plain number.

**Changed primitives (backward compatible; Hunts keeps its defaults):**

- `Monitor`: `label` (aria-label, default `Hunt monitor`), `chyron.label` (default `Hunt ticker`), and a `controls` slot rendered in the bezel strip before the readout.
- `Ticket`: `label` (default `Prediction slip`), and `stubOverlay` (optional node, absolutely positioned over the lower half, for the tear ghost).

**Shared, extracted from `MyAccountPage`:**

- `src/hooks/useDailyDrop.js`: `{ ready, nextAt, label, claim, claiming, error }`. It takes over the countdown and the `/api/me/claim-daily` call.
- `src/utils/discordAuth.js`: `discordAuthUrl()`.
- `MyAccountPage` switches to both, with no visible change.

**Changed:**

- `src/pages/StorePage.js`: wiring plus fixtures, like `HuntsPage`.
- `src/App.js`: `isLive` prop.
- `api/store/redeem.js`: feed write.
- `api/admin/redemptions.js`: feed removal.
- `firestore.rules`.
- `onAirContract.test.js`: `DIRS` gains `src/components/store`.

**Deep link:** `?item=<id>` tunes to that item on load. Tuning updates the param with `history.replaceState` (no new history entries), so the streamer can drop a link to one item in chat.

## Art (ComfyUI)

The owner's machine runs ComfyUI Desktop (`Documents/ComfyUI`, RTX 5080 16 GB) with Z-Image Turbo, Flux 1/2 dev, Qwen Image Edit 2509 and Wan 2.2. Art is made once, reviewed by the owner, and committed as static files.

| Asset | Files | Model | Size budget |
| --- | --- | --- | --- |
| Item art, one per current item | `public/gsn/items/{slug}.webp`, 1200×900 | Z-Image Turbo (Flux 2 dev if Z-Image misses the look) | ≤ 120 KB each |
| The operator, three poses | `public/gsn/operator-{standby,call,shrug}.webp`, 480×600 | Base character from Z-Image / Flux 2; poses via Qwen Image Edit for consistency | ≤ 60 KB each |
| Station ident backdrop | `public/gsn/ident.webp`, 1600×900 | Z-Image Turbo | ≤ 150 KB |

Art lives under `public/gsn/`, never `public/store/`. A `store` folder in `public/` would be served as a directory at `/store` and shadow the SPA route (the dev server redirects `/store` to `/store/`).

**Art direction (shared prompt base).** A 1990s late-night home-shopping broadcast still, shot on a TV studio set: hard key light, deep shadows, warm practical lights in the background, a set tinted dark teal and plum, light VHS grain, slight chromatic bleed. No text, no logos, no real people's likenesses. Item art puts the subject on a slowly turning velvet pedestal. The operator is an invented, deadpan late-night phone operator with a headset at a cluttered desk; the same character appears in every pose. Diffusion text is unreliable, so all lettering (GSN, prices) stays in CSS.

**Pipeline:**

1. Generate 3–4 candidates per asset.
2. The owner picks.
3. Convert to webp at the budget.
4. Commit.
5. The owner points each item's `imageUrl` at `/gsn/items/{slug}.webp` in `/admin/store` (the field already accepts any string).

Item art is per item and opt-in, so new items can still use any URL. The page treats every image the same way: object-cover inside the scanlined frame. Operator images preload on the first `pointerdown` of a hold, so the PiP never pops in late.

## Copy

All page copy follows the PRODUCT.md voice rules: no em dashes, no "X, not Y", none of the AI-tell vocabulary, sentence case. Fixed strings are listed in the sections above. Labels and errors stay plain. The in-group voice lives in the headline, the chyron, the ident lines and the operator moments.

## Accessibility

- An `aria-live="polite"` region announces order results, errors and daily-drop claims.
- `HoldButton` gives its hint through `aria-describedby`. Keyboard users get a Space hold or the two-step confirm; screen-reader users get the two-step confirm.
- Lineup cards are `button`s with `aria-pressed` for the tuned card and a full accessible name (`Roll a blunt, 420 tickets, you can order`).
- Previous / Next are real buttons. ArrowLeft and ArrowRight tune while focus is inside the monitor region.
- Set dressing stays honest (DESIGN.md §7): knobs, LED, the operator PiP and the stub ghost are `aria-hidden`. The PiP's state is carried by its visible text.
- Focus uses `FOCUS` from `onAir/classes.js`. The dock never traps focus.
- Readable Labels: no informational text below `onair-ink-5`. The 10px type floor holds.

## Performance

- CSS and transforms only: no canvas, no animation loop. The static burst and ticker already exist.
- Lineup art is `loading="lazy"`. The monitor's current item art is eager. Operator art preloads on intent (the first hold).
- Four listeners on the page: catalogue, user doc, own orders (limit 5), feed (1 doc).
- The page stays lazy-loaded in `App.js`.

## Testing

- `storeModel` unit tests: lineup order and channel numbers; affordability edges (null balance, exact balance, zero stock, null stock); `orderStatus` mapping; `hoursToEarn` rounding; `orderNumber`; chyron assembly (48 h cutoff, `you` substitution, low-stock lines, live line).
- `useHoldToConfirm` with fake timers: a completed hold confirms once; early release cancels; a click arms, a second click confirms, and the arm expires at 4 s; key repeat is ignored; disabled ignores everything.
- `StoreFront` over fixtures:
  - signed out: sign-in prompts, no hold button
  - short: progress bar and hours copy, no hold button
  - sold out: disabled
  - received: bumper, live announcement, order number
  - busy: message plus "No tickets were spent."
  - tuning a lineup card changes the monitor
  - `?item=` deep link
- `useOrder` with mocked `authedFetch`: one request per confirm; in-flight orders block a second; error codes map to the right messages.
- `src/__tests__/storeFeed.test.js`: `pushOrder` / `dropOrder` (prepend, cap at 8, remove by id, no duplicates).
- `onAirContract` now scans `src/components/store` (raw colours, bare radii, the type floor, ink floor). `storeFixtures.js` is exempt from the raw-colour scan.
- Visual check in dev at 1440 and 375 px through `?fixture=` for every fixture, in the browser.

CRA's Jest preset resets mocks before each test, so `jest.fn` implementations are re-armed in `beforeEach` (CLAUDE.md).

## Docs

- DESIGN.md §7: retitle to "On Air (pilot: /gamba/hunts, /store)". Record `HoldButton` / `RollingNumber`, the operator as a recurring On Air character, the art direction paragraph, and the rule that generated art never carries lettering.
- CLAUDE.md: a Gotchas entry for the store (GSN, the feed doc and its best-effort writes, `earnRates.js` mirroring env defaults, `?fixture=`), and the `store_public` rule.

## Branching and sequence

The On Air pilot merged to `main` in PR #37. The store work goes on `feat/gsn-store` off `main`, and ships as its own PR.

Suggested build order:

1. Primitive additions and the contract test.
2. `storeModel` and its tests.
3. Hooks: `useOrder`, `useHoldToConfirm`, `useDailyDrop` (plus the `MyAccountPage` switch).
4. Components and fixtures.
5. Feed (API, rules, hook).
6. Art.
7. Docs.

## Risks and open items

- **Rate copy can drift from env.** `earnRates.js` mirrors defaults. If the owner changes an env value, the hint copy is wrong until the file is updated. That's acceptable at this scale, and noted in CLAUDE.md.
- **Hold discoverability.** The hint line and the click-to-arm fallback cover anyone who doesn't realise they need to hold.
- **Hotlinked images keep working** until the art is in and the owner swaps each `imageUrl`.
- **Data flag for the owner (not part of this build):** "$ARS 10,000 Bonus Buy" is `kind: virtual`, so it auto-fulfils on redeem and never appears as pending in `/admin/redemptions`. If it's played on stream it should be `stream`.
- The rules deploy for `store_public` needs the owner's go-ahead.
