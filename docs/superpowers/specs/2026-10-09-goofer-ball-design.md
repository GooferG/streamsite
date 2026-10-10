# Goofer Ball: a viewer-called buy hunt draw on Channel 42

**Date:** 2026-10-09
**Status:** Approved in brainstorming (pending spec review)
**Mockups:** `docs/redesign/goofer-ball/` — `draw-scene.html` (the Channel 42 set; option A, no host, was chosen), `overlay-flow.html` (the four on-stream states), `site-page.html` (CH 42 desktop and phone)
**Builds on:** the giveaway engine (`api/admin/giveaways.js`, `api/twitch/eventsub.js`, `src/utils/giveaway.js`), the control room (`docs/superpowers/specs/2026-09-28-control-room-design.md`), prediction settle and rewards (`api/admin/hunts.js`, `api/_lib/predictionRewards.js`), and the slot catalogue (`docs/superpowers/specs/2026-09-27-slot-catalog-communityhunts-design.md`)

## Problem

GooferG wants viewers to pick the slots for a buy hunt. Viewers call in a slot from chat, the stream draws balls from that pool to decide which slots get bought, and whoever called the best-paying slot wins a prize that fits that day's budget. Other channels do this with a "pack opening" reveal. This channel's version should be its own late-night TV bit and run on the same rails as giveaways: control room, OBS overlay, Stage, delayed chat announcements.

The site has nothing like this. The old hunt-suggest flow is gone, and the `/suggest` page is for variety-game suggestions, not slots.

## Scope and non-goals

- **In scope:**
  - Chat intake: `!slot <name>` matched against the Rainbet slot catalogue, with threaded bot replies only when something needs fixing.
  - A round model: open → closed → settled (or cancelled), one ball per viewer, first caller holds a slot, draws while entries stay open.
  - A control-room **Ball** tab and a new staff endpoint `api/admin/ball.js`.
  - An OBS browser source `/ball-overlay`: a corner box, a full-screen draw takeover, a live rack and a winner card.
  - A shared **reveals switch** (OBS overlay or Stage) that also covers giveaway reveals.
  - Site page `/gamba/ball` (Gamba **CH 42**): live drum, slot finder, your ball, tonight's rack and the archive of past draws.
  - Results from the linked communityhunts hunt, with manual overrides, and a payout of tickets plus an optional cash or bonus prize through the existing redemption queue.
- **Non-goals (v1):**
  - A host character. The streamer's webcam is the host.
  - Entering from the site. The site helps viewers find the exact name; chat is the only way in.
  - A staff "add a ball by hand" action.
  - Consolation prizes, multiple paid places, multiplier-scaled prizes.
  - A share card for `/gamba/ball` (it gets the home card).
  - A ComfyUI art pass. v1 draws the set in code, as in the mockups; generated art for the drum stand, blower and desk can replace parts later.
- **Unchanged:** giveaway roll, entry and announce logic; prediction rounds; watch-time; the redemption admin flow; `api/communityhunts.js`.

## Decisions (from brainstorming)

1. **Concept: Goofer Ball, a nightly lottery draw on WGOOF Channel 42.** It's a cheap 90s local-TV lotto set: faded blue starburst backdrop, wood desk, cream-and-orange lower third, chroma bleed on the title, "LIVE 4:20" bug, and fine print ("Drawn nightly at 4:20. Supervised by the Goofer Gaming Commission. Odds are odds. Not a real lottery."). This was chosen over a dark "after-hours" studio (too close to every other On Air page), a call-in switchboard and a VHS night drop.
2. **No host.** The streamer is the host on camera.
3. **Balls are drawn one at a time, on demand.** "Pull another ball" until the lineup is long enough. Nothing is fixed up front.
4. **First caller holds a slot.** A slot is in the drum at most once per round. One ball per viewer; `!slot <new name>` swaps your ball while it is in the drum.
5. **The prize is per round.** It's set when the drum opens (pre-filled from last round), editable until payout: tickets plus an optional `{ kind: 'cash'|'bonus', amount }` in dollars. Only the top slot wins.
6. **Ranking is multiplier first.** Highest multiplier, then the bigger win, then the earlier draw.
7. **Entries stay open while drawing.** The drum closes when the hunt's lineup is done. Once your ball is drawn you can't call another slot that round.
8. **Visible on stream and on the site,** with an archive of every past round.
9. **Smart matching, replies only on trouble.** Exact names and nicknames are silent, a guessed match is confirmed so a wrong guess gets caught, and ambiguous names get a numbered pick (`!slot 2`). Only slots with a bonus buy count.
10. **The live rack ships in v1.** You link the hunt at any time, and each drawn ball's multiplier fills in on stream as you open bonuses.
11. **Its own system.** It doesn't extend giveaways or prediction rounds, so a prediction round can run on the same hunt at the same time.
12. **One shared reveals switch.** OBS overlay or Stage, so a reveal never plays twice. It covers giveaways too.

## Round lifecycle

```text
open ──draw / scratch──▶ open ──close──▶ closed ──settle──▶ settled
  ▲                                         │
  └───────────────reopen────────────────────┘
open | closed ──cancel──▶ cancelled
```

- `open`: chat can call in, staff can draw, scratch, edit the prize and link a hunt.
- `closed`: no entries and no draws. Staff can scratch, link a hunt, reopen, cancel or settle.
- `settled`, `cancelled`: final.
- **At most one active round.** `open` or `closed` counts as active; opening a new round needs the last one settled or cancelled.
- **Entry rules:**
  - One ball doc per viewer per round.
  - A ball in the drum can swap slots.
  - A drawn ball is locked; its owner can't call again.
  - A scratched ball frees its owner to call a different slot. The scratched slot stays blocked for the round, because it was scratched for being unavailable.
  - A slot already in the drum, on the rack or scratched can't be called.
  - Scratched entries stay in `rack` for history. Every screen shows them struck through, and they never count toward balls drawn or results.

## Data model

**`ball_rounds/{roundId}`** — public read, server write only.

| Field | Shape | Notes |
|---|---|---|
| `status` | `'open'\|'closed'\|'settled'\|'cancelled'` | |
| `prize` | `{ tickets: number, prize: null \| { kind: 'cash'\|'bonus', amount: number } }` | Dollars, as in prediction rewards |
| `requireFollow` | boolean | Default true; mods and VIPs are exempt (giveaway rule) |
| `rack` | `[{ drawNo, twitchId, twitchName, displayName, slotId, slotName, thumb, drawnAt, scratched }]` | Append-only, in draw order |
| `lastDrawAt` | Timestamp \| null | Drives the server's draw-busy guard |
| `huntId` | string \| null | Linked communityhunts hunt |
| `results` | `{ [drawNo]: { multiplier, win, bet, source: 'hunt'\|'manual' } }` | Written at settle |
| `winner` | `{ drawNo, twitchId, twitchName, displayName, slotName, thumb, multiplier, win, redemptionId }` \| null | Written at settle |
| `announced` | `{ opened, draws: { [drawNo]: true }, scratches: { [drawNo]: true }, results }` | Claim-once flags |
| `openedAt`, `closedAt`, `settledAt`, `openedBy` | | |

**`ball_rounds/{id}/balls/{twitchId}`** — public read, server write only.
`{ twitchId, twitchName, displayName, slotId, slotName, thumb, status: 'drum'|'drawn'|'scratched', drawNo, enteredAt, updatedAt }`

**`ball_rounds/{id}/claims/{slotKey}`** — server only (no client access).
`{ twitchId, scratched: false, createdAt }`. `slotKey` is the catalogue slot id made Firestore-safe (slashes encoded). It's created with `create()`, so two callers racing for one slot can't both win.

**`ball_rounds/{id}/choices/{twitchId}`** — server only.
`{ options: [slotId, slotId, slotId], createdAt }`. These are the last did-you-mean options, valid for 5 minutes.

**`settings/broadcast`** — public read, staff write (the existing `settings/{docId}` rule).
`{ reveals: 'overlay'|'stage', updatedAt, updatedBy }`. A missing doc means `'overlay'`.

No counter lives on the round doc. Entries never write the round doc, so a rush of `!slot` can't contend with a draw transaction. Ball counts come from the balls snapshot, or from `getCountFromServer` on the Gamba hub.

`firestore.rules`: add `ball_rounds/{id}` (read: true), `balls` (read: true), `claims` and `choices` (no client access). No client writes anywhere in the tree.

## Chat intake

**Hook.** In `api/twitch/eventsub.js` `handleChatMessage`, after the host check and `markChatted`, and before the giveaway query:

- If the message matches `/^!slot\b/i`, run `handleSlotCommand(event)` inside its own try/catch.
- Then fall through to the giveaway logic as today.
- Messages that don't start with `!slot` cost nothing new.

**`handleSlotCommand`:**

1. Read the active round: `ball_rounds where status == 'open' limit 1`. If there isn't one, do nothing (silent).
2. Apply the follow gate if `requireFollow`. It uses the existing `isFollower` helper and fails closed, with mods and VIPs exempt. If it fails, reply.
3. Parse the argument:
   - **Empty:** reply with the viewer's current ball, or how to enter.
   - **`1`–`3`:** resolve from `choices/{twitchId}` if it is under 5 minutes old.
   - **Anything else:** run the matcher.
4. Commit in a transaction:
   - Read the ball doc and the new claim.
   - Refuse if the ball is `drawn`, or the claim exists and belongs to someone else.
   - Otherwise create the claim, delete the old claim on a swap, and set the ball to `drum`.
   - If the claim exists and is the viewer's own, do nothing.
5. Reply per the outcomes table below. Replies thread to the viewer's message.

**Catalogue on the server.** `getSlotCatalog()` (communityhunts `/slots`, ~7.6k rows) is cached in module scope for 6 hours, like `api/slots.js`, and indexed once per warm instance. Each row maps to `{ id: rainbetSlug || slug || name, name, thumb, bonusBuy }`. If the catalogue can't load, the bot replies "Slot list is down, try again in a minute." Free text is never accepted.

**Matcher** (`api/_lib/slotMatch.js`, pure). Steps, in order:

1. **Normalize:** lowercase, strip accents, `&` → `and`, drop punctuation and a leading "the", collapse spaces. Also compare a space-free form, so "doghouse" equals "The Dog House".
2. **Exact name:** a normalized or space-free full-name match wins outright.
3. **Nicknames (only when no slot has that exact name):** `api/_lib/slotAliases.js` maps nickname → catalogue name (gates, sugar, doghouse, wanted, bonanza, …). An alias whose target isn't in the catalogue is ignored.
4. **Partial:** candidates contain every query token, allowing a typo or two per token (edit distance ≤1 for tokens of 5+ chars, ≤2 for 8+). The candidate with strictly the fewest extra tokens wins ("plain version wins": "gates of olympus" gets the original, not 1000 or Xmas). A tie is ambiguous, and the top 3 are offered.
5. **Fuzzy fallback:** whole-string similarity, accepted only above a threshold with a clear margin over the runner-up. Otherwise the top 3 are offered, and if none are close, it's not found.

The result is `{ kind: 'exact'|'alias'|'guess'|'ambiguous'|'none', slot?, options? }`. Bonus-buy status is checked after matching.

**Outcomes:**

| Case | Reply (threaded) |
|---|---|
| Exact or nickname match, accepted | none (the ball drops on stream) |
| Guess accepted | `@user → Gates of Olympus 1000 is in the drum` |
| Swap accepted | `@user swapped to Sugar Rush` |
| Ambiguous | `@user did you mean 1. Sweet Bonanza 1000 · 2. Sweet Bonanza Xmas · 3. Sweet Bonanza Super Scatter? Type !slot 1-3` |
| Not found | `@user couldn't find "xyz". Exact names: goofer.tv/gamba/ball` |
| No bonus buy | `@user Book of Dead has no bonus buy. Pick another.` |
| Taken | `@user Gates of Olympus is taken by @first. Pick another.` |
| Scratched tonight | `@user Gates of Olympus was scratched tonight. Pick another.` |
| Own ball already drawn | `@user your ball's already on the rack: Sugar Rush.` |
| Not following | `@user follow the channel to call a slot in.` |
| `!slot` alone | `@user your ball: Sugar Rush (in the drum)` or `@user type !slot <slot name> to call one in` |
| No open round | silent |

**Chat plumbing.**

- `sendChannelMessage` in `api/_lib/twitchChat.js` gains an optional `{ replyTo }` that sets Helix `reply_parent_message_id`. The id comes from the EventSub event's `message_id`.
- Each viewer gets at most one reply per 10 seconds. This is tracked in memory per warm instance, so it's best effort.
- The bot is a mod (100 messages per 30 seconds).
- A failed reply is logged, and the entry still stands.

## Staff API: `api/admin/ball.js`

`POST { action, id?, ... }`, `requireStaff`, CORS and `OPTIONS` like the sibling handlers.

| Action | Needs | Does | Errors |
|---|---|---|---|
| `open` | no active round | Create the round with `prize` and `requireFollow` | `ROUND_ACTIVE`, `INVALID_PRIZE` |
| `update_prize` | open or closed | Replace `prize` | `NOT_FOUND`, `FINAL` |
| `draw` | open | Transaction: query `balls where status == 'drum'`, pick one with `crypto.randomInt`, set it `drawn` with `drawNo`, append it to `rack`, set `lastDrawAt` | `NOT_OPEN`, `EMPTY_DRUM`, `409 DRAW_BUSY` (now < `lastDrawAt + DRAW_REVEAL_MS`) |
| `scratch` | open or closed | Mark `rack[drawNo].scratched`, set the ball to `scratched`, mark the claim `scratched` | `NOT_DRAWN`, `ALREADY_SCRATCHED` |
| `close` | open | `status: 'closed'`, `closedAt` | `NOT_OPEN` |
| `reopen` | closed | `status: 'open'` | `NOT_CLOSED` |
| `cancel` | open or closed | `status: 'cancelled'` | `FINAL` |
| `link_hunt` | open or closed | Set `huntId` (`null` unlinks) | `HUNT_NOT_FOUND` |
| `preview_settle` | closed, hunt or overrides | Build the results table (below), return rows and winner (`winner: null` with the rows when nothing has a result yet, so the payout table has rows to type into). No writes. | `NOT_CLOSED` |
| `settle` | closed | Transaction, see Results and payout | `NOT_CLOSED`, `ALREADY_SETTLED`, `NO_RESULTS` |
| `announce` | — | Claim `announced.<key>` once in a transaction, then post the line | `ALREADY_ANNOUNCED` (soft) |

Draws can't overlap. Two staff browsers or a double click get `DRAW_BUSY` until the reveal has played.

**Chat lines** (the `announce` action):

- **Opened (posted on open):** `🎱 Goofer Ball is open! Type !slot <slot name> to call one in. Top multi wins {prize}. Exact names: goofer.tv/gamba/ball`
- **Draw (posted `DRAW_REVEAL_MS + STREAM_DELAY_MS` after `drawnAt`):** `🎱 Ball {n}: {slot}, called in by @{viewer}`
- **Scratch (posted on scratch):** `🎱 Ball {n} scratched ({slot} isn't available tonight). @{viewer}, call another slot.`
- **Results (posted `STREAM_DELAY_MS` after `settledAt`, matching predictions):** `🎱 Tonight's winning ball: {slot} at {multi}x. @{viewer} wins {prize}.`

## Results and payout

- **Linking a hunt.** The Ball tab lists live, current and recent hunts from `/api/communityhunts` and calls `link_hunt`. A hunt can be linked at any time while the round is open or closed.
- **Matching** (`api/_lib/ballResults.js`, mirrored in `src/utils/ballResults.js` with a parity test, like `predictionRewards`).
  - A non-scratched rack entry matches the hunt bonus row whose `slot` normalizes to the same name.
  - Bonus rows that no ball called are ignored.
  - If several rows match one ball, the live rack uses the first, and the payout table asks staff to pick.
- **Live rack** (overlay and CH 42).
  - Polls `/api/communityhunts?view=hunt&id={huntId}` every 60 seconds while the round is open or closed and has a hunt. That endpoint is public and already cached for 30 seconds.
  - On a failed poll it keeps the last values and shows "stale".
  - After settle, results come from the round doc instead.
- **Payout table** (Ball tab, closed).
  - One row per drawn, non-scratched ball, showing the hunt's multiplier, win and bet.
  - Unmatched rows are highlighted for manual entry, and any row can be overridden (`source: 'manual'`).
  - If communityhunts is unreachable, a fully manual table still settles.
- **Ranking:** multiplier, then win, then `drawNo`. `settle` returns `NO_RESULTS` if no drawn ball has a result; `preview_settle` returns `winner: null` with the rows instead.
- **`preview_settle`** re-reads the hunt on the server, merges the overrides, ranks, and returns `{ rows, winner, prize }`.
- **`settle`** is one transaction:
  - It re-checks `status == 'closed'` and writes `results`, `winner`, `status: 'settled'` and `settledAt`.
  - If `prize.tickets > 0`, it credits `users/{twitchId}` with set+merge (`tickets`, `totalEarned`), and writes a `ticket_ledger` row `{ reason: 'goofer_ball', refId: roundId, note: 'Goofer Ball winner — {slot} {multi}x' }`.
  - If there is a `prize.prize`, it files a pending `redemptions` doc with `kind: 'goofer_ball'` and a label like the prediction prize label. The Redeem tab pays it.

## Control room

- **Ball tab.** It sits next to Giveaway, Predict and Redeem, and uses the panel's existing tab mechanics. Its states:
  - **No active round:** a prize form (tickets, optional $ amount with a cash/bonus kind, pre-filled from the last round), a follow-gate toggle (on), and **Open**.
  - **Open:**
    - Header: balls in the drum, balls drawn, the prize (edit inline), the linked hunt (Link / Change).
    - **Draw ball**, a big button. It's disabled while this round's reveal is playing or a giveaway reveal is on screen.
    - Rack rows, each with a two-press **Scratch**.
    - A "Just in" list of the last 8 balls.
    - **Close lineup**, two-press.
  - **Closed:**
    - The payout table, **Preview**, then a hold-to-confirm **Pay out**.
    - **Reopen** and a two-press **Cancel**.
  - **Settled:** the winner card and **Open a new round**.
- **Listeners:**
  - `ControlRoomProvider` adds one `limit(1)` listener on the newest round (`orderBy('openedAt', 'desc')`).
  - The Ball tab adds a listener on that round's `balls` while the tab is visible and the round is open or closed.
- **Engine.** Driver tab only, under the existing Web Lock:
  - `useBallAnnounce` posts the draw lines on their delay, claimed once per draw.
  - `useBallResultsAnnounce` posts the results line.
  - `/admin/*` pages don't need a ball page in v1.
- **Pill:** a `BALL 42` chip (balls in the drum) while a round is open.
- **Warning line:** "Goofer Ball still open" shows as a line in the panel body (like the data-lost line) while a round is active and the stream is offline. It can't be dismissed while it's true.
- **Stage.** `stageTriggers.js` gains:
  - `ballDrawMoment`: fresh `drawnAt`, ends `DRAW_REVEAL_MS` later.
  - `ballWinnerMoment`: fresh `settledAt`, held `WINNER_HOLD_MS`.
  - `StageMoment` renders them with the overlay's scene components.

## Reveals switch

- **The control.** The control room header gets a segmented switch: **OBS overlay | Stage (this browser)**.
  - Choosing **Stage** turns this browser's Stage pref on and writes `settings/broadcast.reveals = 'stage'`.
  - Choosing **OBS overlay** turns it off and writes `'overlay'`.
  - Other staff browsers keep their own Stage pref, which only affects what they see locally.
- **What it suppresses.**
  - `/ball-overlay` and `/giveaway-overlay` subscribe to `settings/broadcast`.
  - When it is `'stage'`, they skip their full-screen moments: the draw takeover, the winner card, the giveaway `RevealStage` and its lock hold, and their sounds.
  - Corner cards keep rendering: the ball corner box and live rack, the giveaway "now playing" card.
- **Flipping mid-reveal.** The overlay's reveal unmounts at once. Stage never replays a moment older than `STAGE_FRESH_MS`, so a flip can't produce a double.

## OBS overlay: `/ball-overlay`

- **Setup.** A bare route like `/giveaway-overlay`: no nav, intro or polling (`AppShell` in `App.js`). Params:
  - `?pos=bl|br|tl|tr` for the corner box (default `bl`);
  - `?sound=1`;
  - `?demo=1` (loops fake data);
  - `?fixture=open|draw|rack|winner` (dev only).
- **States**, from the newest round doc and its balls:
  1. **Open (resting):**
     - The corner box: header "GOOFER BALL · CH 42 · {prize}", a mini drum, the ball count, the `!slot <slot name>` chip and the rack so far.
     - Each new ball (snapshot `docChanges` of type `added`, never on the first snapshot) drops into the drum with a toast, "🎱 @viewer CALLED {SLOT}", for about 3 seconds.
     - Toasts queue; more than 4 waiting collapse into "+N more".
  2. **Draw takeover** (`DRAW_REVEAL_MS` = 8000, timed from `drawnAt`, plays only if fresh):
     - 0–0.6s: static cut in.
     - 0.6–3.0s: the blower roars and the churn speeds up.
     - 3.0–4.2s: the ball rides the tube.
     - 4.2–5.2s: the close-up spins to the slot thumbnail decal and the `@viewer` band.
     - 5.2–7.4s: the lower third "BALL {n} · {SLOT} · CALLED IN BY @{viewer} · {left} BALLS LEFT IN THE DRUM" holds.
     - 7.4–8.0s: cut back to the corner box.
  3. **Live rack:**
     - When a hunt is linked and at least one drawn ball has a result, the corner box becomes "TONIGHT'S RACK": ball number, thumbnail, slot, @viewer and multiplier, with the leader highlighted.
     - A footer shows "!slot to call one in" while open, or "DRUM CLOSED · TOP MULTI WINS {prize}" when closed.
  4. **Winner card** (`WINNER_HOLD_MS` = 12000 from `settledAt`): "TONIGHT'S WINNING BALL", the ball close-up, the multiplier, the slot, "@viewer WINS {prize}", and the commission fine print. After it, the overlay is empty until the next round opens.
- **Drum physics.**
  - A hand-written 2D loop on `<canvas>`: circle-circle and circle-wall collisions plus an upward air jet (gentle at rest, strong during a draw).
  - At most 60 balls are drawn, with "+N more" past that.
  - Each ball shows its slot thumbnail as a round decal (an image cache with a colour fallback; no pixel reads, so cross-origin thumbs are fine).
  - The loop pauses when the page is hidden.
  - Layering: set backdrop (code) → canvas balls → glass (code: radial gradients and a highlight).
- **Sound** (`?sound=1`): a synthesized Web Audio blower whoosh, ball clack and ding, following the giveaway overlay's sound hook.

## Site page: `/gamba/ball` (CH 42)

- **Wiring.**
  - `GAMBA_TOOLS` gains `{ id: 'ball', label: 'Goofer Ball', channel: 42, path: '/gamba/ball' }`. The tuner goes 00 → 04 → 42; channel labels already pad any number.
  - `GambaPage` routes it.
  - `useBallData` feeds the pure `src/components/ball/BallFront.js`.
- **Data.**
  - The newest round, via a `limit(1)` listener.
  - Its `balls`, only while the round is open or closed and the tab is visible; the listener detaches when the tab is hidden.
  - Past rounds: `status == 'settled'`, `orderBy('settledAt', 'desc')`, `limit(20)`, with Load more.
  - The live rack poll described under Results and payout.
- **Sections**, per `site-page.html`:
  - **Set strip:** the Channel 42 set with the live drum, the "Drum open" chip, the ball count, drawn count and prize.
  - **Call one in:** a slot search built on `useSlotCatalog`, bonus-buy slots only, greyed out when taken (from the balls snapshot plus the rack) with the holder's name, and a **Copy `!slot <exact name>`** button. Hidden unless open.
  - **Your ball:** for a signed-in viewer (`useTwitchAuth`), pinned and highlighted.
  - **In the drum:** a searchable list of every ball.
  - **Tonight's rack:** drawn balls with live multipliers, the leader in orange.
  - **Past draws:** date, winning ball, multiplier, prize. Each row expands to that round's full rack and results.
- **Phone:** the strip shrinks; Call one in and Your ball come first, then the rack; In the drum and Past draws fold away.
- **Off air** (no active round): the strip shows the last winning ball and "Drum's closed. Next draw whenever the drum opens on stream." Call one in is hidden and Past draws moves up.
- **Gamba hub.** "What's on" gets a row "CH 42 · Goofer Ball · drum open, N balls" while a round is open. `useGuideData` adds a `limit(1)` active-round listener and one `getCountFromServer` on load.
- **Fixtures** (dev only, stripped from builds): `/gamba/ball?fixture=open|rack|closed|settled|offair|empty|loading`.
- **Reduced motion.** The drum renders still and takeovers are skipped. This doesn't apply on OBS.

## Visual language

- **Channel 42 colours** are a new token group, `onair.wgoof` in `tailwind.config.js`: sky `#3d63a3`, deep `#22396b`, night `#152447`, desk `#5a3a22`, deskDeep `#3b2414`, trim `#8a5a33`, title `#ffe9c2`, blower `#c8452a`.
  - They're used only for the set: the overlay, the CH 42 set strip and the Stage moments. A contract test keeps `wgoof` classes inside `src/components/ball/`.
  - The lower third uses the existing `onair.paper` (cream) and `onair.winner` (orange).
- **Type.** The set's titles and lower third use the existing `font-display` (Anton); labels use JetBrains Mono. Everything below the CH 42 strip uses the regular On Air tokens and primitives (`Panel`, `Chip`, `OnAirButton`, `HoldButton`).
- **DESIGN.md** §7 gets a "Channel 42 (Goofer Ball)" entry.

## Failure handling

- **EventSub isolation.** The `!slot` branch has its own try/catch; a ball error never blocks giveaway entries or the watch-time marker, and the reverse holds too.
- **Catalogue down:** entries are refused with a retry reply.
- **Communityhunts down:** the live rack keeps its last values and shows "stale"; the payout table falls back to manual entry.
- **Draw while a viewer swaps:** the transaction retries, so a ball never changes slot mid-draw.
- **Two staff drawing at once:** `DRAW_BUSY`.
- **Overlay reloads mid-reveal:** timing comes from `drawnAt` and `settledAt`, so a reload resumes or skips and never replays from zero.
- **Missing user doc:** the ticket credit uses set+merge, as prediction settle does, and `twitch-auth.js` fills the starter fields on that viewer's first login.

## Firestore budget (Spark: 50k reads, 20k writes per day)

- **An entry:** about 3 reads (round query, ball, claim) and 2–3 writes (ball, claim, old claim). An ambiguous name adds 1 write (choices).
- **A draw:** one read per ball in the drum plus 2 writes. Staff actions are a handful of writes each.
- **Listeners:** the overlay, the control room and each CH 42 tab read the drum once, plus one read per change while it's visible.
- **Worked example:** 150 entries, 15 draws and 30 CH 42 visitors comes to about 500 writes and about 12k reads. That fits, and CH 42 detaching when hidden is the main brake.

## Testing

- **Unit (pure modules):**
  - `slotMatch`: exact, space-free, nickname, partial with typos, plain version wins, ambiguous top 3, fuzzy threshold, bonus-buy check after match.
  - `ballRules` (entry outcome from ball, claim and match state): new, swap, taken, scratched, drawn lock, own-claim no-op.
  - Draw selection: uniform over `drum` balls, never drawn or scratched.
  - `ballResults`: match, duplicate rows, overrides, ranking and tie-breaks. Includes a client/server parity test.
  - Announce timing: draw line after `DRAW_REVEAL_MS + STREAM_DELAY_MS`, results after `STREAM_DELAY_MS`.
  - Stage moments: `ballDrawMoment` and `ballWinnerMoment` freshness.
- **Handlers**, following `src/__tests__/adminHuntsApi.test.js`:
  - `src/__tests__/adminBallApi.test.js`: every action's preconditions and errors, the `DRAW_BUSY` guard, settle writes (ledger, redemption, set+merge).
  - `src/__tests__/eventsubSlot.test.js`: routing `!slot`, the follow gate, every reply case, choices, giveaway flow unaffected.
- **Components:**
  - The Ball tab in every state.
  - Overlay fixtures, plus the reveals switch suppressing the takeovers on both `/ball-overlay` and `/giveaway-overlay`.
  - `BallFront` fixtures: open, rack, settled, off air, empty, loading, phone.
  - The tuner showing CH 42.
- **Contract:** `wgoof` tokens only under `src/components/ball/`.

## Files

- **New:**
  - API: `api/admin/ball.js`, `api/_lib/slotMatch.js`, `api/_lib/slotAliases.js`, `api/_lib/ballRules.js`, `api/_lib/ballResults.js`, `api/_lib/ballStore.js` (transactions).
  - Shared and hooks: `src/utils/ballResults.js`, `src/utils/ball.js` (timing constants, freshness), `src/hooks/useBallData.js`.
  - Components: `src/components/ball/` (`BallFront`, `ChannelSet`, `DrumCanvas`, `DrawTakeover`, `WinnerCard`, `CornerBox`, `RackBoard`, `SlotFinder`, fixtures).
  - Pages and control room: `src/pages/BallOverlay.js`, `src/components/controlRoom/BallTab.js`, `useBallAnnounce`, `useBallResultsAnnounce`.
  - Tests as listed under Testing.
- **Changed:**
  - `api/twitch/eventsub.js` (the `!slot` branch) and `api/_lib/twitchChat.js` (`replyTo`).
  - `firestore.rules`, `tailwind.config.js`, `DESIGN.md`.
  - `src/App.js` (`/ball-overlay` bare route), `src/data/gambaTools.js`, `GambaPage`, `useGuideData` and the guide row.
  - The control room: `ControlRoomContext` (round listener, engine hooks), `ControlRoom` (tab, header switch), `Pill`, `useWarnings`, `stageTriggers`, `StageMoment`.
  - `src/pages/GiveawayOverlay.js` (respects the reveals switch).
  - `CLAUDE.md` (a Goofer Ball entry under Gotchas).
