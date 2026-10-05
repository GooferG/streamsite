# The couch: home as Goofer's living room at 2 AM (On Air)

**Date:** 2026-10-04
**Status:** Approved (spec review 2026-10-04)
**Builds on:** `docs/superpowers/specs/2026-10-03-onair-nav-gamba-guide-design.md` (nav, channel static, On Air tokens), `docs/superpowers/specs/2026-10-03-gsn-store-design.md` (pure front + fixtures pattern, generated set-dressing art), `docs/superpowers/specs/2026-10-04-onair-vods-video-store-design.md` (stills reel on a TV, paper stickers, marker labels)

## Problem

Home (`/`) is the last big brand page still in the pre-On Air look, and it is the front door:

- **It clashes with the rest of the site.** An emerald "GOOFER LIVE" wordmark, a hard-edged test-pattern card, numbered section stack, the searchlight leaderboard band. No `onair` tokens at all (`HomePage.js`, `HomeHero.js`).
- **It repeats other pages, in the older style.** Latest VOD and clips (now Goofer Video), gamba tools and the leaderboard (now the Gamba guide), the next stream (now the Goofer Guide).
- **The hero's "clip loop" never plays video.** Helix sends no playable clip files, so the `mp4_url` branch in `HomeHero.js` never runs; it shows clip thumbnails with a slow zoom.
- **Home's preview card is the default for every unlisted route**, so its look travels to Discord and X.

The owner wants home to be the most distinctive page on the site, not a restyle.

## Scope and non-goals

- **In scope:**
  - Home rebuilt as **the couch**: one illustrated cartoon living room at night, filling the screen under the nav. Every object is a door to a channel.
  - A site-level **camera**: clicking a door zooms into the object, the channel-change static covers the cut, the destination tunes in; Back pulls the camera back out to the couch.
  - The **TV**: live preview while live (with an in-place "watch inside the TV" mode), otherwise a reel of clip loops and station-break cards.
  - The **laptop**: the gamba screen (hunt, prediction round, or a bouncing-GG screensaver with the leaderboard reset).
  - The **intro pull-back**: after the first-visit power-on, the camera starts inside the TV and pulls back to reveal the room.
  - A **phone layout**: the TV crop above a grid of object tiles.
  - The **art set** (room, empty room, object cutouts, a cartoon of the owner in a frame) and its pipeline.
  - A local **TV reel script** (`npm run tv:reel`) and the first reel.
  - CDN caching for `/api/steam-games`, and a dev proxy route for it.
- **Not in scope:**
  - The Gaming, Giveaway and About revamps (the next projects; their doors ship now and land on today's pages).
  - The gear desk scene (reuses this engine later).
  - Lenis or any site-wide smooth scrolling.
  - Idle animation loops (Wan 2.2) and mouse parallax.
  - Any change to the nav.

## Decisions (from brainstorming)

1. **Home's job is the front door:** is he live, what's next, what did I miss, then hand off to the channel pages. It never re-renders another page's full content.
2. **Concept: the couch at 2 AM**, with concept "station break" as its voice and skeleton. Every bit of copy the room shows is a plain full sentence with live data in it, and underneath the art the page is an ordered list of those sentences as links.
3. **Every object is a door from day one**, including doors to pages not yet rebuilt (Gaming, Giveaway, About).
4. **Gamba is a laptop on the coffee table**, never casino imagery (no chips, coins, slot reels, gold-on-black).
5. **Clicking navigates; there are no info panels.** Glance info lives in always-visible labels that expand into a sentence on hover or focus.
6. **The TV reel is "both":** curated video loops when a reel exists, a stills reel otherwise and as the reduced-motion / Save-Data / autoplay-refused fallback.
7. **While live, the TV shows the preview, and clicking it zooms in and loads the Twitch player** in a full-screen "inside the TV" frame. Back, Esc or "Back to the couch" pulls out.
8. **The intro pulls back from the TV** (first visit, after the existing power-on).
9. **Kept from today:** the first-visit welcome card. **Cut:** hero, leaderboard band, gamba tools strip, latest VOD and clips sections, Steam strip, stats ticker, sign-off.
10. **No animation library to start.** The camera uses the Web Animations API. GSAP (free, CJS-friendly) only if sequencing outgrows it. Lenis, Rive, Lottie, react-router's `viewTransition` and React's `<ViewTransition>` are out.
11. **A cartoon of the owner** hangs in the photo frame (About door). The owner supplies a stream still or a selfie; only the cartoon is committed.
12. **Added during the build (2026-10-04): rooms, themes, toys and the window** (see that section). The room's art and layout are one swappable *room* (`90s` today); seasonal themes dress the room (Halloween ships now); toys are pointer-only easter eggs; the window shows a live night outside.

## The room

### Layout

- The room sits under the fixed nav and fills the rest of the viewport (`100svh - NAV_H`). It is one **stage** layer: the plate, the object cutouts, and every live HTML piece (TV screen, laptop screen, sticky note, labels, covers) positioned in **percent of the art**, so they stay registered at any size.
- The stage is sized like `background-size: cover` around a focal point (the TV), so the art always fills the viewport and crops at the edges. **Every door and label must sit inside the art's safe area** (x 12.5–87.5 %, y 12–88 %), the part visible from 4:3 to 21:9.
- The room layout applies from 768 px wide in landscape (aspect at least 4:3). Anything narrower or portrait gets the phone layout.

### Doors

| Order | Object | Link (plain click plays the camera) | Shows on home |
| --- | --- | --- | --- |
| 1 | TV | live: `https://twitch.tv/GooferG` (plain click = watch inside the TV); off air: `/vods` | the reel, or the live preview |
| 2 | Sticky note on the TV (only while a giveaway is open) | `/giveaway` | the keyword, handwritten |
| 3 | Laptop | `/gamba/hunts` while a hunt is live or a round is open/locked, else `/gamba` | hunt / round / screensaver |
| 4 | Tapes by the VCR | `/vods` | newest VOD title; a "New" paper sticker if it aired since the viewer's last visit |
| 5 | TV guide on the table | `/schedule` | next show and countdown |
| 6 | Game cases | `/gaming` | the viewer's last-two-weeks Steam covers composited onto the case fronts |
| 7 | Remote | `/store` (the TV flips to the GSN ident, then the camera goes into the TV) | "GSN" |
| 8 | Framed photo | `/about` | a cartoon of the owner |

- **Doors are real `<a href>` links** in this order (DOM and tab order). Ctrl/Cmd/Shift/middle-click and "open in new tab" behave natively; only a plain primary click (or Enter) plays the camera.
- **Labels.** Each door has a small On Air chip anchored above its object, always visible: a mono kicker and a short teaser ("TV GUIDE · Mon 11 AM"). On hover or keyboard focus it expands to the door's sentence plus "Opens Schedule". The link's accessible name is the sentence plus its destination.
- **Hover lift.** The object's cutout rises a few pixels with a soft drop shadow (no glow). The empty room underneath means nothing tears.
- **Live state.** Only the TV casts light, and only while live: a cool glow on the room behind a dim overlay. The laptop screen turns on during a hunt but never glows (Glow Means Something).

### Sentences (examples; final copy lives in the model and follows PRODUCT.md's voice rules)

| Door | State | Teaser | Sentence |
| --- | --- | --- | --- |
| TV | waiting for Twitch | Tuning in | Checking whether Goofer's on. |
| TV | live | On now · 214 | Goofer's live right now. Lean in to watch. |
| TV | off air, next known | Back Mon 11 AM | Off the air. Back Monday at 11 AM for Bonus Hunt Time! |
| TV | due but not on yet (`upNext` kind `late`) | Running late | Bonus Hunt Time! should be on by now. Give him a minute. |
| TV | nothing scheduled | Off air | Off the air. Nothing on the books yet. |
| Note | giveaway open | Type !goof | Giveaway's open. Type !goof in chat for a $25 bonus buy. |
| Laptop | hunt live | Hunt 14/23 | A hunt is running. 14 of 23 opened, $412 back so far. |
| Laptop | round open | Predictions open | Predictions are open. Guess the payout before it locks. |
| Laptop | round locked | Predictions locked | Predictions are locked. The hunt decides it now. |
| Laptop | idle, last hunt known | Best hit 1,240x | Last hunt paid $412 on $600. Best hit: 1,240x on Sugar Rush 1000. |
| Laptop | idle, nothing known | Gamba | The gamba tools live here. |
| Tapes | VOD exists | Win Wednesdays | You missed Win Wednesdays. Thursday night, 4 hours 37. |
| Tapes | none | Nothing new | No tapes yet. Check back after the next stream. |
| Guide | next known | Mon 11 AM | Next up: Bonus Hunt Time! on Monday at 11 AM, in 1 day 1 hour. |
| Games | Steam known | PoE 2 · 14h | Lately: Path of Exile 2, 14 hours in two weeks. Last streamed: Slots. |
| Games | unknown | Gaming | His game library and the wheel. |
| Remote | always | GSN | Flip to the Goofer Shopping Network. Spend your tickets. |
| Photo | always | The host | Who is this guy? |

Times are the viewer's clock, from `scheduleTime.js`. Counts use real plurals ("1 bonus"). No em dashes, no "X, not Y", sentence case.

### The skeleton

The doors render as an ordered list of links (the order above) with their sentences. It is the screen-reader and keyboard structure of the room. If the plate fails to load, or before it has loaded, the list shows as plain On Air tiles, so home is never a blank box.

### Phone layout

- The top is a 4:3 crop of the same plate around the TV and its stand, with the live TV screen in it.
- Below, "On the coffee table": a grid of tiles, one per door in the same order (the sticky-note tile spans both columns while a giveaway is open). Each tile has the object's cutout, the kicker and the sentence.
- Tapping a tile plays the phone camera move (see below). The TV crop is the TV door.

### Welcome card

`WelcomeSignOn` stays, restyled with On Air tokens. Copy says this is Goofer's couch and everything in the room is clickable; its action becomes "Look around" (dismiss), replacing the scroll to `#gamba-tools`.

## The camera (`src/components/camera/`)

- **`CameraProvider`** sits in App.js above the `ErrorBoundary key={pathname}`, so it survives the route swap. It renders the full-viewport static overlay (the Monitor's noise and scanlines) and exposes `goThrough({ doorId, rect, href })`, `pullBackFrom(doorId)`, `startInside(doorId)` and a `busy` flag. Home's stage registers its element with the provider.
- **`cameraMath.js` (pure):** given the stage box, an object box and the viewport, returns the `translate` + `scale` that centres the object and fills about 90 % of the viewport, capped at 3.5x.
- **Zoom in:** one Web Animations API animation on the stage (`transform` only, `will-change` during the move), about 650 ms ease-in. At about 80 % the static fades in over 120 ms, `navigate(href)` runs under it, and the static holds until the destination has rendered (minimum 250 ms), then fades over 300 ms while the page wrapper plays the existing `signal-lock` animation.
- **Back:** the provider remembers the last door and the path it led to. When the router pops back to `/` from that path, home mounts with the stage at that door's zoom and pulls back over about 700 ms (ease-out) under a short static. Arriving at `/` by a push (nav, links) shows the room with no pull-back.
- **Remote:** the TV screen first shows `public/gsn/ident.webp` behind a 300 ms in-screen static, then `goThrough` targets the TV's box with `href` `/store`.
- **Watch inside the TV (live):** `goThrough` targets the TV with no route change. At the static cut a fixed full-viewport TV frame mounts and loads the Twitch player at native resolution (a scaled iframe would blur). It is router state on `/` (`navigate('/', { state: { watch: true } })`), so Back pops it; Esc and a "Back to the couch" button do the same. Pulling out reverses the move.
- **Intro:** when `introModeFor` chose `gate` and the power-on finishes, home mounts with `startInside('tv')`: the stage is already at the TV's zoom during the reveal, and pulls back over about 1.1 s after `onComplete`, then the welcome card shows.
- **Phones:** tapping a tile animates the tile's cutout from its rect to fill the viewport (same timing), then the static and `navigate`. Back reverses into the tile.
- **Preloading:** App.js's lazy pages move to `src/routes/loaders.js` (one `() => import()` per page, used by both `lazy()` and `prefetchRoute(path)`). Doors call `prefetchRoute` on pointerenter, focus and touchstart. If the chunk is still loading when the zoom ends, the static holds (up to about 1.5 s) instead of the zoom stalling.
- **Guardrails:** input during a move is ignored. Under `prefers-reduced-motion` there is no zoom and no static: a 150 ms cross-fade, then `navigate`. Only the stage moves; the nav stays fixed.

## The TV

- **States:** *waiting* (before `statusReady`): soft in-screen static only. *Live:* the stream's preview image (`thumbnail_url` at 640x360 with a per-poll cache buster), the red LIVE `StatusLight` tally, the viewer count and a "Watch here" mark; the reel pauses. *Off air:* the reel.
- **The reel** alternates clip segments and station-break cards, with a 300 ms in-screen static between segments:
  - **Clip segments:** video loops from the reel manifest; without a manifest, clip and VOD thumbnails with a slow push-in, about 6 s each (the Goofer Video in-store TV approach).
  - **Station-break cards:** HTML text on the screen from the model's sentences ("Off the air. Back Monday, 11 AM." / "You missed Win Wednesdays.").
- **Playback rules:** video starts after first load and idle, only while the tab is visible, through one reused `<video muted playsinline loop>` with `muted` set as a property before `play()`. Stills only when `prefers-reduced-motion`, `navigator.connection.saveData`, or `play()` rejects (iOS Low Power Mode). Under reduced motion the TV does not advance: one still and the current station-break sentence. No audio ever.
- **Dressing (CSS, over any content):** scanlines, a curvature vignette and glass glare, so the art's screen stays a blank rectangle.
- **Accessibility:** the moving picture is `aria-hidden`; the TV door's accessible name carries the current sentence and destination.

### The reel script (`scripts/tv-reel/`)

- `reel.json` lists the owner's picked clip URLs (optional start offset each). `npm run tv:reel` runs `build.mjs`, which checks for `yt-dlp` and `ffmpeg` on PATH (clear error if missing), downloads each clip, cuts 8 s, scales to 360p, strips audio, encodes AV1 (`.webm`) and H.264 (`.mp4`, `+faststart`), writes a poster and `public/tv/reel/manifest.json` (`[{ id, title, sources: { av1, h264 }, poster, seconds }]`).
- **Budgets:** each loop at most 600 KB, the whole reel at most 4 MB, posters at most 30 KB; the script fails if a file is over.
- Outputs are committed. The build never runs the script.

## The laptop

- An HTML screen in the laptop's screen rectangle (straight on, like the TV):
  - **Hunt live:** the hunt readout (opened of total as notches or a bar, money back so far), reusing `guide.js` derivations (`huntFeature`, `progressModel`).
  - **Round open / locked:** "Predictions open" or "Predictions locked" and the guess count, from `usePredictionRound` (`huntFeature`'s `guessCount`).
  - **Idle:** a screensaver with the GG bug bouncing between the corners (CSS keyframes; still under reduced motion) and the leaderboard reset countdown.
- Never slot-machine imagery. The screen is On Air UI scaled to the screen.

## Data (`useCouchData.js`)

| Need | Source | Cost on home |
| --- | --- | --- |
| Live state, preview, viewers, newest VOD, clips, last streamed category | App's 120 s Twitch poll (props, incl. `statusReady` and `channelData.game_name`) | none new |
| Next show | `useSchedule` + `upNext` (`scheduleTime.js`) | already site-wide |
| Hunt live / recent hunts | `useCommunityHunts` (server-cached 30 s) | one 60 s poll |
| Last finished hunt's best hits | `useHunt(latestFinishedId)` (`hunts/useHunt.js`) | one fetch |
| Prediction round | `usePredictionRound` (one doc) | one listener |
| Leaderboard reset | `useLeaderboardData` + `useCountdown` | one poll |
| Giveaway open | **new** `useLiveGiveaway`: newest giveaway with status in open, closed, rolling, playing, limit 1 | one listener |
| Recently played | `/api/steam-games` | one fetch |
| "New" sticker | `localStorage['gg_last_visit']`, read once then rewritten (try/catch; unreadable means no sticker). First visit: "New" if the newest VOD aired within 72 hours | none |
| Reel | `public/tv/reel/manifest.json`, fetched once after idle | one static fetch |

- **`/api/steam-games` gets CDN caching** (`s-maxage=1800, stale-while-revalidate=86400`), since home is the most-visited page and today every visit calls Steam. `src/setupProxy.js` forwards `/api/steam-games` to the deployed site in dev, like `/api/me/*`.
- Firestore: two listeners, each one document. Spark-safe.
- Every source degrades to its door's "unknown" sentence; nothing blocks the room.

## Model (`src/components/couch/couchModel.js`, pure)

- `DOORS`: id, href rule, layer, tile order.
- `doorStates(input, now)`: per door `{ visible, href, kicker, teaser, sentence, lit, sticker }`.
- `reelItems(input)`: the running order of clip segments and station-break cards.
- `isNewTape(newestVod, lastVisit, now)`.
- Sentence builders (one per door state), plurals, durations and day words from `scheduleTime.js`.
- `couchLayout.json` (generated by the art step): per object `{ rect, anchor, screen? }` in percent of the art, plus the focal point and the phone crop. The model reads it; nothing is hand-tuned in components.

## Components (`src/components/couch/`)

- `CouchFront.js` (presentational, props only): stage, plate `<img>` (`srcset` 1280/1920/2560, `fetchpriority="high"`), cutouts, door links, labels, TV, laptop, sticky note, covers, skeleton list, phone layout.
- `CouchTv.js`, `LaptopScreen.js`, `DoorLabel.js`, `DoorTiles.js`.
- `useCouchData.js`, `useLiveGiveaway.js`, `useTvReel.js`.
- `couchFixtures.js` (dev only): `/?fixture=offair|live|giveaway|hunt|round|late|loading|noart|empty`. `HomePage` reads it behind `NODE_ENV !== 'production'`, so webpack drops it from production builds (the `VodsPage` pattern).
- `src/pages/HomePage.js` becomes the wiring page (fixture switch + live data into `CouchFront`).
- **Removed** after checking nothing else imports them: `HomeHero`, `HomeLeaderboardCallout`, `HomeGambaTools`, `StatsTicker`, `SignOff`, `SteamGames`, `SectionHeader`, `SectionDivider`, `ClipCard` and anything only they used.

## Tokens, type and docs

- On Air tokens and primitives only. Labels are `Chip`-style mono kickers; screens use `font-onair` / `font-onair-mono`.
- **Paper and marker extend to the couch:** the tapes' "New" sticker is Goofer Video paper stock (they are rentals), and the sticky note is paper with the keyword in `font-onair-marker`. DESIGN.md §7 and the contract test widen those rules from "Goofer Video only" to "Goofer Video and the couch".
- **DESIGN.md §7 gains "The couch"** with named rules: *Doors Are Links* (real anchors, native modifier clicks), *One Camera* (one layer, transforms only, at most about 1 s, the static covers every cut, reduced motion cross-fades), *Only The TV Casts Light* (and only while live), *Art Is Measured* (positions come from `couchLayout.json`), plus the safe area.
- **The contract test** (`onAirContract.test.js`) scans `src/components/couch/` and `src/components/camera/`.
- **CLAUDE.md:** home section (the couch, fixtures, the camera, the reel script, the art folder), and the Steam caching note.

## Art (`public/couch/`, recorded in `scripts/gsn-art/README.md`)

- **Deliverables:**
  - The room plate, 16:9, at 1280, 1920 and 2560 px wide (budgets about 90, 150 and 250 KB).
  - The empty room (objects removed), same sizes.
  - Cutouts with alpha: tapes, laptop, TV guide, remote, game cases, framed photo (with the cartoon owner). At most 40 KB each.
  - `couchLayout.json`.
- **Composition rules:**
  - The TV centred, about 35 % of the frame width, straight on, blank screen, no glare.
  - The laptop on the coffee table, lid open toward the couch, screen straight on, low enough that the tapes stay visible.
  - Game cases facing front (covers get composited); tapes stacked beside the VCR; TV guide and remote clearly on the table; the frame on the wall; clear space around every door; all doors inside the safe area; the TV and stand work as a 4:3 crop.
  - No lettering anywhere; no casino imagery.
- **Pipeline:**
  1. Base renders: Z-Image, 3–4 seeds; the owner picks.
  2. Cartoon redraw: Qwen-Image-Edit 2509 and 2511, 2 seeds each, with "no glare, flat fills"; the owner picks.
  3. Targeted Qwen edits for fixes.
  4. Cutouts: SAM 3 by name (ComfyUI-RMBG `SAM3Segment`, or the core `SAM3_Detect`) once Meta approves the owner's access; fallback BiRefNet ToonOut on crops.
  5. The empty room: LaMa or Qwen "remove X".
  6. 4x-AnimeSharp upscale, then WebP at delivery size (`to_webp.py`).
  7. A measuring script reads the masks and writes `couchLayout.json`.
  8. Owner review in the dev fixture.
- **The cartoon owner:** a Qwen redraw from a photo the owner supplies (stream still or selfie), same cartoon prompt traits. The source photo stays out of the repo. The art README's "no real people's likenesses" rule gets an owner-consent exception for the owner's own likeness.
- **The reel and the GSN ident** reuse existing assets (`public/gsn/ident.webp`).
- **Already installed for this:** ComfyUI-RMBG 3.2.0 (with `decord` and the SAM 3 dependencies), BiRefNet ToonOut, 4x-AnimeSharp, Qwen-Image-Edit-2511 fp8mixed with its 4-step Lightning LoRA (`scripts/gsn-art/workflows/qwen-edit-2511.json`).

## Rooms, themes, toys and the window (added 2026-10-04)

### Rooms

- The art and its measured layout form a **room**: `src/components/couch/rooms/<id>.json` with its art in `public/couch/<id>/`. Today there is one, `90s`, picked by `ROOM_ID` in `couchLayout.js`; there is no switcher.
- A room declares its object names (the label kickers: "Tapes", "TV guide"…), its screen skin (`crt`, the class `couch-crt`), its window, its toys and its themes' art. A future era (modern, futuristic) is a new folder and layout file; the doors, destinations, camera, model and screens don't change.

### Themes

- A theme dresses the room; it never replaces it. `themes.js` holds each theme's calendar (Goofer's Arizona calendar) and copy; the room's layout holds that theme's art.
- **Halloween**, October 1 to 31:
  - dressing: cobwebs and, in place of the paper bats (owner's change, 2026-10-04), a horror-movie poster, "Night of the Living Bean", starring a streamer friend's meme face and linking to beantwitch.com;
  - toys: a jack-o'-lantern, a spider on the cobweb, a candy bowl;
  - the window: an orange harvest moon and a bat flock, plus a witch on a broom (art) that a moon tap sometimes sends across;
  - a pumpkin in place of the GG bug on the laptop's screensaver;
  - a "Spooky season" station-break card first in the TV reel.
- `?theme=<id>` previews a theme and `?theme=none` turns it off, in any build.
- Dressing is decorative (`aria-hidden`, no pointer events) unless its theme gives it a link out (`THEMES.<id>.links`, the poster): then it is a real link, opens a new tab, comes after the doors in tab order, makes no camera move and never sits on a door or a toy. Dressing never covers a door or a label and is at most 40 KB a layer. On phones the TV crop shows whatever dressing and toys fall inside it, as still pictures.

### Toys

- A toy reacts when you poke it and goes nowhere. Effects:
  - `toggle`: the lamp clicks off and on;
  - `light`: the jack-o'-lantern's face lights and flickers for a few seconds;
  - `wiggle`: the controller rumbles;
  - `drop`: the spider drops on its thread and climbs back;
  - `pop`: a candy pops out, the soda can fizzes.
- Pointer and touch only: `aria-hidden`, never in the tab order, a pointer cursor and no hover label. Never on top of a door. Silent. Under reduced motion a toy switches its art without moving.
- **Toys light themselves only.** A lit pumpkin is art (its face drawn lit) with an opacity flicker; it never uses a glow token and lights nothing around it. The TV is still the only thing that lights the room.
- The objects a toy animates are erased from the empty room, like the doors' objects, so a moving toy never shows a copy of itself underneath.

### The window

- The window's glass is transparent in the room's art; the outside is HTML behind it and the blinds a layer in front.
- It is always night outside:
  - tonight's real moon phase, computed from the date;
  - a few twinkling stars;
  - a flat Phoenix skyline strip (saguaros, a palm, a streetlight, a neighbour's house);
  - a plane blinking across now and then.
- Window toys: tap the moon and it winks, tap the sky for a shooting star, tap the blinds cord to roll the blinds up or down.
- The outside casts no light into the room. All its motion is transforms and opacity, `motion-safe` only.

### Art additions

The art step adds:
- the window: the glass mask (made transparent in the room and the empty room), the blinds cutout and the cord's hit area, the skyline strip;
- the base toys: the lamp on and off, the controller, the soda can;
- the Halloween set: a Halloween version of the room for the dressing and toy cutouts, the lit pumpkin, the spider, the witch and the laptop bug.

`measure.py` writes the `room`, `window`, `toys` and `themes` blocks of the room's layout.

### Rules added to DESIGN.md §7

- **Toys Light Themselves.**
- **Dressing Never Covers A Door.**
- **Rooms Are Swappable:** art and positions live in the room's layout, behaviour lives in code.

## Share card

Re-shoot `public/share/home.jpg` with `npm run share:shots -- --only=home` once the art is final, and commit it.

## Testing

- **Model:** every door state and sentence for each fixture; href rules (laptop to `/gamba/hunts` when active, TV to Twitch while live); `isNewTape` incl. first visit and unreadable storage; reel order with and without a manifest; voice-rule checks on all sentences (no em dash, no " not " parallelism patterns).
- **Camera math:** centring, fill ratio, the 3.5x cap, odd aspect ratios.
- **CameraProvider:** reduced motion cross-fades without animating; input ignored while busy; remembers the last door; pull-back only on a pop to `/`; watch mode via router state; Web Animations API stubbed (jsdom has none).
- **Doors:** real anchors with the right `href` and accessible name; modifier and middle clicks are not intercepted; tab order matches the skeleton.
- **TV:** waiting/live/off-air states; stills fallback for no manifest, reduced motion, Save-Data and a rejected `play()`.
- **Fronts:** `CouchFront` renders every fixture; the phone layout below the breakpoint; the skeleton when the plate fails.
- **Router stub:** extend `src/test/reactRouterDomStub.js` with whatever the camera needs (`useNavigationType`, `location.state`).
- **Contract test** extended to the new folders. Full suite and `npm run build` green.

## Review passes before the PR

- Motion: the `review-animations` skill on the camera, the reel and the screensaver.
- Accessibility: the accessibility-auditor agent (keyboard, screen reader, reduced motion, focus after a transition).
- Performance: the performance-benchmarker agent (phone-class CPU, the plate's LCP, the stage transform at 60 fps, reel bytes).

## Rollout

One branch, `feat/couch-home`, one PR. Build order, with owner checkpoints (✋):

1. Camera, `cameraMath`, shared loaders (nothing uses them yet).
2. Couch model and front on the test plate with a temporary `couchLayout.json`, and all fixtures.
3. Live data: TV with the stills reel, laptop, sticky note, Steam caching and dev proxy.
4. ✋ Art rounds; the final plate, empty room, cutouts and measured layout replace the test ones.
5. Phone layout, intro pull-back, live watch mode.
6. ✋ Reel script and the first reel from the owner's picked clips.
7. Remove the old home components, update DESIGN.md and CLAUDE.md, re-shoot the share card. ✋ Owner review in the fixtures, then the three review passes, then the PR.

**After merge, in order:** Gaming revamp (with the recently played shelf the game cases lead to), Giveaway, About plus the gear desk scene. Separately: a Lenis evaluation and Wan 2.2 idle loops.

**Risks:**

| Risk | Mitigation |
| --- | --- |
| Art takes several rounds | Code runs on the test plate until the final art lands |
| SAM 3 access is slow | BiRefNet ToonOut on crops |
| The zoom janks on phones | One layer, transforms only, perf pass on a phone profile, shorter move if needed |
| Visitors miss that the room is clickable | Always-visible labels, the welcome card copy, the nav unchanged |
| Doors to pages not yet rebuilt feel like a letdown | Those revamps are the next three projects |
