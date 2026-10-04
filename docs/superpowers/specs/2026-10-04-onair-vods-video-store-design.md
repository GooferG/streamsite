# Goofer Video: /vods as a late-night video rental store (On Air)

**Date:** 2026-10-04
**Status:** Approved in brainstorming (pending spec review)
**Builds on:** `docs/superpowers/specs/2026-10-03-onair-hunts-design.md` (On Air tokens, primitives, DESIGN.md §7), `docs/superpowers/specs/2026-10-03-gsn-store-design.md` (pure front + fixtures pattern, generated set-dressing art)

## Problem

`/vods` is the last big public page still in the old hard-lined look: a slate header, All/Vods/Clips tabs, and one three-column grid of bordered cards mixing VODs and clips newest first. Against live data (checked 2026-10-04) it has these faults:

- **Clips never show a thumbnail.** `VodsPage` reads `clip.thumbnail`, but Helix sends `thumbnail_url`, so every clip falls back to the film-icon placeholder. (The home page maps it correctly.)
- **Every VOD says "Various".** Helix `/videos` has no `game_id`, so the game line is always the fallback.
- **Every VOD title carries the same tail:** `💥communityhunts.gg / goofer.tv / beantwitch.com 💥 "HIGH" QUALITY 💥 EN/PT-BR 💥`. On cards it buries the part that differs ("Win Wednesdays", "Monday Hunts and Twists").
- **It shows 20 of 27 VODs.** The archive runs Aug 17 to Oct 1; `first=20` drops the oldest week.
- **Old and new clips are mixed by date.** The top 20 clips are mostly 2016–2018 League, PUBG, Tarkov and Fortnite clips; only 5 are this year's Slots clips. Sorted newest first in one grid with 20 VODs, the old ones sink to the bottom and nothing says what they are.
- **No sense of the channel.** Nothing ties a clip to the stream it came from, credits the chatter who made it, or says a VOD is about to expire.

The owner wants the page on the On Air language with its own physical-media concept, more organised, and more fun to browse.

## Scope and non-goals

- **In scope:**
  - A rebuilt `/vods` as **Goofer Video**, a late-night rental store: a store sign, aisle signs, VOD shelves by week, a Fresh picks shelf, a Cult classics aisle by game.
  - The **rental counter**: one overlay that plays a tape with its back cover beside it, a tape timeline with clip marks that seek the VOD, and clip-to-tape links.
  - `?tape=<id>` deep link.
  - All 27 VODs (`first=100`) and a once-per-visit recent clips fetch.
  - The Permanent Marker font for labels and index cards, as an On Air token.
  - Two new paper tokens for label stock.
  - A generated clerk (two poses) as set dressing for loading and empty states.
  - Dev-only fixtures (`/vods?fixture=…`).
  - DESIGN.md §7 "Video store" subsection and contract test coverage.
- **Non-goals:**
  - The home page's latest VOD and clip sections, `ClipCard` and `VideoModal`. Home keeps them as they are.
  - Search, sorting controls or pagination past 100 VODs.
  - Highlights or uploads (only `type=archive`).
  - Caching the Twitch app token. App mints a new one on every 120s poll; that's worth fixing on its own.
- **Unchanged:** App's 120s poll cadence and call count, `api/twitch-token.js`, the share page rewrite for `/vods`.

## Decisions (from brainstorming)

1. **Concept: Goofer Video, a rental shop wall.** Chosen over a VCR + tape stack (spines hide thumbnails and one screen in the middle drifts back toward the Monitor pattern) and a Clip Show countdown channel (clip embeds give no end event, heavier, VODs get second billing). The VCR idea survives as the tape timeline in the rental counter.
2. **Clips split into Fresh picks and Cult classics.** Recent clips get their own shelf and mark their VOD's tape; the all-time top clips become an aisle shelved by game.
3. **Clicking a box opens the rental counter.** One click plays it, back of the box beside the player. Chosen over flip-in-place (two clicks to watch, cramped on phones) and play-first (no room for the back cover).
4. **Art: CSS sleeves plus one generated clerk.** Sleeves, stickers, shelves and the sign are CSS; the Twitch thumbnail is the cover art.
5. **Permanent Marker is loaded** for labels and index cards.

## Store floor

Order top to bottom: sign → aisle signs → New releases → Fresh picks → Cult classics → sign-off. The page sits on the site body gradient like the store and schedule do.

### Sign

- **`Goofer Video` is the page's `h1`**, set as a CSS lightbox sign (Bricolage 800 on a flat surface panel, no glow). One line of body copy under it: `Every stream from the last 60 days, plus the clips chat couldn't let go.`
- **The OPEN sign is the LIVE light.** Before App's first Twitch poll succeeds (`statusReady`) it is not drawn. Live: `OPEN` in the red tally with `shadow-onair-live`, and a link `Goofer is live, watch now` to `/` (the home page plays the stream). Off air: an unlit `After hours` (ink, no glow). Its pulse stops under reduced motion.

### Aisle signs

- A row of three jump links under the sign: `New releases 027`, `Fresh picks 012`, `Cult classics 016` (mono, counts zero-padded to 3). They scroll to the matching section (`#new-releases`, `#fresh-picks`, `#cult-classics`); the section headings are the targets, so focus lands on them.
- An aisle with nothing in it is left out, and so is its sign.
- They replace the All/Vods/Clips tabs. There is no filter state.

### New releases (VODs)

- **One shelf per week**, newest first, on the viewer's calendar, Monday to Sunday. Headings: `This week`, `Last week`, then a range: `Sep 14–20`, or `Aug 31–Sep 6` across a month.
- **The VHS box.** A portrait clamshell (about 2:3). Real covers are portrait and Twitch thumbnails are 16:9, so the cover is a printed sleeve with the thumbnail in a photo window across the top, not a cropped thumbnail:
  - photo window: the thumbnail at 16:9 (`%{width}x%{height}` → 440×248), lazy-loaded;
  - label sticker: the cleaned title in marker, up to 3 lines, then clamped;
  - spine strip down the left edge: catalogue number `No. 1530` (last 4 digits of the VOD id, stable as tapes come and go) and the weekday;
  - bottom band: tape stock and speed (`T-160 · EP`) and the length (`4:37:20`), both mono.
- **Stickers** (paper, at most two per box, in this priority):
  1. `NEW RELEASE` on the newest VOD (signal teal paper).
  2. `Due back Oct 16` when the tape expires within 7 days; `Due back today` on its last day (loss red ink on paper).
  3. `3 clips inside` when clips mark the tape (plain paper).
- **No thumbnail** (a processing VOD, or Twitch's 404 placeholder): the photo window shows a CSS test pattern.
- **Hover and focus** lift the box a few pixels off the shelf; no glow. The lift is off under reduced motion.

### Fresh picks (recent clips)

- **Camcorder cassettes:** a smaller landscape case, so clips read differently from VODs and the 16:9 thumbnail fits without cropping. The case shows the thumbnail, the length (`0:30`) and the views.
- **Index card** under each case, in marker: `Picked by larrymenta`. When the clipper is the signed-in viewer (`twitchUser.displayName`, case-insensitive), it reads `Picked by you` in viewer purple, the On Air "you" role.
- **The label line** is the cleaned clip title. When the clip was never named (see Model), it reads `No label · at 2:13:40` (the offset when known, else the date).
- Newest first.

### Cult classics (older top clips)

- One divider card per game (the plastic genre divider: game name in Bricolage 800), followed by that game's cassettes, most viewed first.
- Aisles ordered by their most viewed clip. A missing or numeric game name files under `Misc.`
- Each cassette gets a year sticker: `© 2018`.
- Index cards as in Fresh picks.

### Layout

- **Below `md`** each shelf is a sideways scroll-snap row (boxes about 42vw, cassettes about 64vw) with the shelf lip under the row.
- **From `md`** shelves wrap, and the shelf lip runs under every row.
- **Sign-off:** `Be kind, rewind.` in marker, then mono counts: `027 tapes · 028 clips on the floor`.

### Loading and empty

- **Loading** (App's `loading`): each section shows four blank sleeves (no shimmer), and the clerk in the restocking pose with `Restocking the shelves…`.
- **Empty** (no VODs and no clips after loading, including a failed poll): the clerk asleep on the counter and `Shelves are empty. Check back after the next stream.`
- The clerk is `aria-hidden`; the visible text says what is happening. Without the art files the text stands alone.

## Rental counter

One overlay (portal) that opens on any box or cassette click, with the tape already playing.

- **Header strip:** `Goofer Video · Rental No. 1530` for a VOD, `Goofer Video · Clip` for a clip, and an ESC close button.
- **Layout:** from `lg`, the TV (Twitch player, 16:9) on the left, the back of the box on the right, the tape timeline under the TV. Below `lg`, the TV on top, the timeline, then the back of the box; the sheet scrolls.
- **Player:** VODs use `player.twitch.tv/?video=<id>&parent=<host>&autoplay=true`, clips `clips.twitch.tv/embed?clip=<id>&parent=<host>&autoplay=true` (as today). A seek adds `&time=1h2m3s` and remounts the iframe.

### Back of a VOD box

- The label title in marker, then the full cleaned title if it was clamped.
- Mono facts: weekday and date (`Wed, Oct 1`), length, `T-160 · EP`, views, `Due back Nov 30` (always shown here).
- **Clips on this tape:** each row shows the label line, `Picked by …` and the timestamp, and seeks the player when pressed.
- `Watch on Twitch` link.

### Tape timeline (VODs only)

- A counter strip from `0:00:00` to the length, with a mark at each clip's `vod_offset`.
- Muted segments (`muted_segments`) are drawn as static bands. None exist today; the timeline supports them.
- Marks are buttons labelled `Jump to 3:57:20, 5 scat? pants off`; pressing one seeks. The mark for the last seek shows as current (signal ink, no glow).

### Back of a clip box

- Label line, `Picked by …`, game, date, length, views.
- **Found on tape:** when the clip's `video_id` is a VOD in the archive, `Found on tape: Win Wednesdays, Oct 1 at 3:57:20`; pressing it switches the counter to that VOD at the offset.
- Otherwise `Original tape lost.`
- `Watch on Twitch` link.

### Behaviour

- `role="dialog"`, `aria-modal`, labelled by the title.
- Focus moves to the close button on open and is trapped in the sheet. Escape or a scrim click closes; focus returns to the box that opened it.
- The body scroll is locked while open.
- Open and close are a short fade and rise, off under reduced motion.
- **`?tape=<id>`:** on load, an id matching a VOD or clip opens the counter. Opening or switching tapes replaces the param (`history.replaceState`); closing removes it. An unknown id is ignored.

## Data

- **VODs:** `getTwitchVideos` requests `first=100` instead of `first=20`. Same single call in App's poll. Home only reads `videos[0]`.
- **Top clips:** unchanged. App's top 20 (all-time, by views) with `game_name`.
- **Recent clips:** a new `useRecentClips()` hook in `VodsPage`. Once per mount, it fetches clips from the last 60 days (`started_at` = now − 60 days, `ended_at` = now, `first=50`; Helix defaults `ended_at` to a week after `started_at`, so both are required), then their game names. It isn't added to App's poll. On failure it returns `[]`, and Fresh picks uses the recent clips in the top 20.
- **No new endpoints.** Calls go browser → Helix with the token from `/api/twitch-token`, like App does.

## Model (`src/components/vods/videoStoreModel.js`, pure)

- `ARCHIVE_DAYS = 60`. GooferG's oldest VOD was 48 days old on 2026-10-04, so retention is the 60-day tier.
- `parseDuration('4h37m20s') → seconds`; `formatLength(seconds)` → `4:37:20` / `0:30`. Replaces `formatDuration` in `VodsPage`.
- `cleanTitle(raw)`: drop a leading `[…]` language tag, cut at the first `💥` or ` | `, collapse whitespace, trim trailing separators. Empty → `Untitled stream`.
- `tapeStock(seconds)`: up to 2h `T-120 · SP`, up to 4h `T-120 · LP`, up to 6h `T-120 · EP`, up to 8h `T-160 · EP`, longer `T-160 · EP ×2`.
- `dueBack(createdAt, now)` → `{ date, daysLeft }` from `createdAt + ARCHIVE_DAYS`; the shelf sticker shows when `daysLeft <= 7`.
- `weekShelves(vods, now, timeZone)` → `[{ key, label, vods }]`, Monday-start weeks on the viewer's calendar, newest first.
- `catalogueNo(id)` → last 4 digits.
- `coverUrl(vod)` → the 440×248 thumbnail, or `null` when `thumbnail_url` is empty or points at Twitch's `/_404/` processing image.
- `isUnlabeled(clip, vod)`: true when the raw clip title contains `💥` or equals its VOD's raw title.
- `clipMarks(vod, clips)` → clips with `video_id === vod.id` and a numeric `vod_offset`, sorted by offset, each with `position` = offset / length, clamped to 0–1.
- `splitClips(topClips, recentClips, now)` → `{ fresh, classics }`: deduped by id; fresh = created within `ARCHIVE_DAYS`, newest first; classics = the rest of the top clips.
- `cultAisles(classics)` → `[{ game, clips }]` per the rules above (numeric or empty game name → `Misc.`).
- `toTwitchTime(seconds)` → `1h2m3s`.
- `buildStore({ videos, topClips, recentClips, now, timeZone })` → everything `VideoStoreFront` renders: shelves, fresh, aisles, counts, and a lookup by id for the counter and `?tape=`.

## Components (`src/components/vods/`)

| File | Role |
| --- | --- |
| `VideoStoreFront.js` | Pure page: takes the `buildStore` output plus `loading`, `isLive`, `statusReady`, `viewerName`, and owns the counter state and `?tape=`. Fixtures feed it in dev and tests. |
| `StoreSign.js` | `h1` lightbox sign and the OPEN / After hours light. |
| `AisleSigns.js` | Jump links with counts. |
| `Shelf.js` | Shelf heading, row or wrap layout, shelf lip. |
| `VhsBox.js` | The VOD clamshell with stickers. |
| `ClipCassette.js` | The clip case and index card. |
| `RentalCounter.js` | The overlay: header, player, back of box, focus trap. |
| `TapeTimeline.js` | Counter strip, clip marks, muted bands. |
| `Clerk.js` | The clerk art in a pose, `aria-hidden`. |
| `useRecentClips.js` | The once-per-mount recent clips fetch. |
| `videoStoreFixtures.js` | `rich`, `fresh` (no classics), `classics` (no fresh), `expiring`, `noclips`, `nothumb`, `empty`, `loading`. |

- `src/pages/VodsPage.js` becomes the wiring: App props plus `useRecentClips` plus `useTwitchAuth().twitchUser` into `buildStore` and `VideoStoreFront`, with the dev-only `?fixture=` reader (the `SchedulePage` pattern; webpack drops the fixture module from production builds).
- `App.js` passes `statusReady` (and `isLive`) to `VodsPage`.
- **Deleted:** `src/components/VodCard.js` (only `VodsPage` uses it).

## Tokens, type and docs

- **Font:** `family=Permanent+Marker` added to the existing Bricolage/JetBrains Google Fonts URL in `public/index.html` (one stylesheet, `display=swap`). Token `fontFamily['onair-marker']: ['"Permanent Marker"', '"Bricolage Grotesque"', 'cursive']`.
- **Marker rules:** labels and index cards only, never below 15px, never for data (dates, times, lengths, counts stay mono).
- **Paper tokens:** `onair-paper` (label stock, warm off-white) and `onair-paper-ink` (dark ink on it), at least 7:1. Sticker teal and red are the existing `onair-signal` and `onair-loss` families as paper tints or ink.
- **Roles:** the OPEN light is the only thing that glows. `Picked by you` is viewer purple. No orange on the page (orange means the winner inside On Air, and nothing here wins).
- **DESIGN.md §7** gets a "Video store" subsection: the concept, shelves by week, Fresh picks and Cult classics, the counter, the marker rules, the clerk as set dressing. The type paragraph lists the marker face.
- **Contract test:** `src/components/vods` added to `DIRS` and to the raw colour / bare radius rule (fixtures exempt), plus one new rule: `font-onair-marker` appears only under `src/components/vods/`.

## Clerk art

- Made on the owner's ComfyUI Desktop with `scripts/gsn-art/` (Z-Image Turbo, then a Qwen edit for the second pose), picked by the owner, committed as webp. Nothing calls ComfyUI at request time.
- **Style:** the GSN STYLE string with the set swapped for a 1990s late-night video rental store (fluorescent tubes, wire racks of blank unlabeled VHS boxes, a counter with a CRT and a till), and the same `no text, no letters, no logos`.
- **Poses** (480×600, 60 KB budget each):
  - `public/gsn/video/clerk-restock.webp`: carrying a stack of blank tapes, deadpan.
  - `public/gsn/video/clerk-asleep.webp`: head down on the counter beside the CRT.
- **Rules:** no lettering (the boxes in the art are blank), no real likeness, recorded in `scripts/gsn-art/README.md` with prompts and seeds.
- **If ComfyUI isn't available during the build,** the page ships with the text-only states and the art lands as a follow-up commit.

## Share card

- `scripts/share/pages.js` `/vods` description becomes `Goofer Video. Every stream from the last 60 days on the shelf, and the clips chat kept.`
- `public/share/vods.jpg` is re-shot from goofer.tv after the deploy (`npm run share:shots -- --only=vods`) in a follow-up commit, as with PR #46.

## Testing

- **Model unit tests:** `cleanTitle` on the real titles above (including the 2018 `[EN/PT-BR] … | !trees …` form), `tapeStock` boundaries, `weekShelves` across a month and a Sunday-to-Monday edge in a non-UTC zone, `dueBack`, `clipMarks` (missing offset, clamp), `splitClips` dedupe, `cultAisles` order and `Misc.`, `isUnlabeled`, `toTwitchTime`.
- **Front render tests per fixture:**
  - shelves and headings;
  - stickers and their priority;
  - aisle signs left out when empty;
  - OPEN hidden before `statusReady`;
  - `Picked by you`;
  - loading and empty copy.
- **Counter tests:**
  - opens with the player for a VOD and a clip;
  - a clip mark seeks (iframe `src` gains `time=`);
  - `Found on tape` switches to the VOD;
  - Escape closes and focus returns to the box;
  - Tab stays inside;
  - `?tape=` opens on load and an unknown id is ignored.
- **`useRecentClips`:** builds the `started_at`/`ended_at` query and returns `[]` on failure.
- **Contract test** stays green with the new rules.
- **Manual check** on `npm start` with live data and every fixture, at phone width and desktop.

## Rollout

- One PR on `feat/onair-vods`.
- Follow-up after deploy: the `vods.jpg` re-shoot, and the clerk art if it wasn't ready for the PR.
