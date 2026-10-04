# Goofer Video (/vods on On Air) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/vods` as Goofer Video, a late-night rental store on the On Air language: VODs on week shelves, Fresh picks and Cult classics for clips, and a rental counter that plays a tape with its back cover and a clip-marked tape timeline.

**Architecture:** One pure model (`src/components/vods/videoStoreModel.js`) turns raw Helix VODs and clips into everything the page draws (`buildStore`). Presentational pieces (`Shelf`, `VhsBox`, `ClipCassette`, `StoreSign`, `AisleSigns`, `Clerk`, `TapeTimeline`, `RentalCounter`) take model objects. `VideoStoreFront` composes them and owns which tape is on the counter. `VodsPage` wires App's poll data, a once-per-visit `useRecentClips` fetch and the signed-in viewer into it, plus the `?tape=` and dev `?fixture=` params (the `SchedulePage` / `StorePage` pattern).

**Tech Stack:** React 19, react-router-dom 7 (`Link` only), Tailwind 3 with the `onair` tokens, Jest + React Testing Library via react-scripts (no jest-dom: assert with `toBeTruthy`, `getAttribute`, `textContent`). In Jest `react-router-dom` is `src/test/reactRouterDomStub.js`; its `Link` renders a plain `<a href>` outside a router.

**Spec:** `docs/superpowers/specs/2026-10-04-onair-vods-video-store-design.md` (approved 2026-10-04). Read it before starting.

**Deliberate deviations from the spec (called out for review):**
- **Two radius tokens added:** `onair-case` (6px) for the VHS box and `onair-label` (3px) for labels, stickers and photo windows. The §7 radii (10px and up) are too round for a tape box, and arbitrary `rounded-[…]` values would sneak raw values past the token rule.
- **The Due back sticker is red stock with paper ink,** instead of red ink on paper. `onair-loss` text on paper measures about 2.4:1; dark ink on the red sticker measures about 6:1.
- **Loading shows one shelf of four blank sleeves,** not one per section, because the sections aren't known until the data lands.
- **The counter closes itself when its tape leaves the data** (a VOD expiring between polls), which the spec didn't cover.

## Global Constraints

- **Branch and commits:**
  - Branch `feat/onair-vods` (already created from `origin/main` 8dc83c4, with the spec committed as f8926be). Work in the main checkout.
  - Another session may switch branches in this folder, so every commit command starts with `test "$(git branch --show-current)" = feat/onair-vods && …`.
  - Never stage `test-output.txt`.
  - Commit messages: short imperative subject (`feat(vods): …`), **no `Co-Authored-By` or any Claude attribution** (same for the PR body).
- **Tests:** run with `CI=true npm test -- --watchAll=false --testPathPattern=<pattern>`. CRA resets mocks before each test, so arm `jest.fn` implementations in `beforeEach` or inside the test.
- **Tokens only in `src/components/vods/`:**
  - No raw hex or `rgba(`.
  - Radii are `rounded-onair-*` or `rounded-full`, never bare `rounded` or `rounded-[…]`. The fixtures file is exempt.
- **Type:**
  - Never `font-semibold`; nothing below `text-[0.625rem]`.
  - Mono labels (`${MONO}`) carry `tracking-[…]` of 0.15em or more on the same line.
  - Scale: 96 / 60 / 30 / 24 / 22 / 20 / 17 / 15 / 14 / 13 / 12 / 11 / 10 px.
- **Marker:** `font-onair-marker` appears only under `src/components/vods/`, is 15px or larger (`text-[0.9375rem]` up) with its size on the same line, and is never used for data. Dates, times, lengths and counts stay mono.
- **Readable Labels:** informational text never fainter than `text-onair-ink-5`.
- **Glow Means Something:** only the OPEN light (`StatusLight status="live"`) and the "Picked by you" card (`shadow-onair-lit-viewer`) glow. No orange (`orange-*`, `onair-winner*`) anywhere on the page.
- **Motion Has An Off Switch:** hover lifts and the counter's entrance are `motion-safe:` only.
- **Copy rules (PRODUCT.md):**
  - No em dashes.
  - No "X, not Y" constructions.
  - Sentence case.
  - No forbidden vocabulary (leverage, seamless, unlock, elevate, …).
- **Exact copy:**
  - `Goofer Video`
  - `Every stream from the last 60 days, plus the clips chat couldn't let go.`
  - `Goofer is live, watch now`
  - `After hours`
  - `Restocking the shelves…`
  - `Shelves are empty.`
  - `Check back after the next stream.`
  - `Be kind, rewind.`
  - `Original tape lost.`
  - `Found on tape: {title}, {date} at {time}`
- **Constants:** `ARCHIVE_DAYS = 60`. VODs `first=100`. Recent clips are the last 60 days with `first=50`, and both `started_at` and `ended_at` are sent.

## Review Focus

These are failure modes the spec implies but doesn't spell out. Each line names the input, the behaviour a viewer would expect, and the task whose tests pin it.

1. **App's 120s poll re-renders while a tape plays.** The Twitch player keeps playing; the iframe is not remounted. (Task 7, "a poll refresh keeps the tape playing".)
2. **The tape on the counter drops out of the data** (it expired between polls). The counter closes, the scroll lock lifts, `?tape=` is cleared, nothing crashes. (Task 7, "a tape that leaves the archive closes the counter".)
3. **`?tape=` points at a clip that only arrives with the recent-clips fetch,** a few seconds after first paint. The counter opens when the clip arrives. (Task 7, "a deep link waits for clips that load late".)
4. **A clip with no clipper, no game and no thumbnail.** It files under Misc., credits "someone in chat", and shows the test card. (Task 1, "a clip without a clipper or a game still files"; Task 4, "a cassette without a picture shows the test card".)
5. **"Found on tape" switches tapes inside one open counter.** There's still one dialog and one scroll lock, and Escape returns focus to the cassette that opened it. (Task 7, "switching tapes keeps one counter and focus goes home".)

---

### Task 1: The store model

**Files:**
- Create: `src/components/vods/videoStoreModel.js`
- Create: `src/components/vods/videoStoreFixtures.js` (copied from the attachment)
- Test: `src/components/vods/__tests__/videoStoreModel.test.js`

**Interfaces:**
- Consumes: `calendarDay(ms, timeZone)` from `src/utils/scheduleTime.js` (a day count for the wall date in `timeZone`; `undefined` means the viewer's zone).
- Produces (later tasks import these exact names):
  - `buildStore({ videos, topClips, recentClips, now, timeZone })` → `{ shelves, fresh, aisles, counts, byId }`:
    - `shelves`: `[{ key, label, tapes }]`
    - `fresh`: `[clip]`
    - `aisles`: `[{ game, key, clips }]`
    - `counts`: `{ tapes, fresh, classics, clips }`
    - `byId`: `{ [id]: tape | clip }`
  - **Tape** fields: `kind: 'vod'`, `id`, `rawTitle`, `title`, `no`, `createdMs`, `weekday`, `dateLabel`, `seconds`, `length`, `stock`, `views`, `cover`, `url`, `daysLeft`, `dueDate`, `dueLabel`, `muted` (`[{ start, width }]`, 0–1), `marks` (`[{ clip, offset, at, position }]`), `stickers` (`[{ kind: 'new'|'due'|'clips', text }]`).
  - **Clip** fields: `kind: 'clip'`, `id`, `label`, `picker`, `createdMs`, `dateLabel`, `year`, `seconds`, `length`, `views`, `viewCount`, `cover`, `url`, `game`, `foundOn` (`{ id, title, dateLabel, offset, at } | null`).
  - Helpers: `pickedBy(clip, viewerName)` → `{ you, text }`; `playerSrc(item, at, host)` → string; `formatCounter(seconds)` → `'0:00:00'`; `padCount(n)` → `'027'`; `ARCHIVE_DAYS`.
  - `VIDEO_STORE_FIXTURES` keys: `rich`, `live`, `fresh`, `classics`, `expiring`, `noclips`, `nothumb`, `empty`, `loading`. Also `LIVE_VIDEOS`, `LIVE_TOP_CLIPS`, `LIVE_RECENT_CLIPS`, `FIXTURE_NOW`.

- [ ] **Step 1: Copy the fixtures**

They are GooferG's real archive and clips from 2026-10-04, saved beside this plan so nobody retypes 150 lines.

```bash
mkdir -p src/components/vods/__tests__
cp docs/superpowers/plans/assets/2026-10-04-videoStoreFixtures.js src/components/vods/videoStoreFixtures.js
```

- [ ] **Step 2: Write the failing model tests**

Create `src/components/vods/__tests__/videoStoreModel.test.js`:

```js
import {
  ARCHIVE_DAYS,
  aisleName,
  buildStore,
  catalogueNo,
  cleanTitle,
  clipMarks,
  coverUrl,
  dueBack,
  formatCounter,
  formatLength,
  formatViews,
  isUnlabeled,
  padCount,
  parseDuration,
  pickedBy,
  playerSrc,
  tapeStickers,
  tapeStock,
  toTwitchTime,
  weekShelves,
} from '../videoStoreModel';
import { FIXTURE_NOW, VIDEO_STORE_FIXTURES as F } from '../videoStoreFixtures';

const TAIL = '💥communityhunts.gg / goofer.tv / beantwitch.com 💥 "HIGH" QUALITY  💥 EN/PT-BR 💥';
const AZ = 'America/Phoenix';
const rich = buildStore(F.rich);

test('Twitch keeps past broadcasts 60 days', () => {
  expect(ARCHIVE_DAYS).toBe(60);
});

test('parseDuration reads Helix lengths, and junk as zero', () => {
  expect(parseDuration('4h37m20s')).toBe(16640);
  expect(parseDuration('12m10s')).toBe(730);
  expect(parseDuration('45s')).toBe(45);
  expect(parseDuration('')).toBe(0);
  expect(parseDuration('garbage')).toBe(0);
});

test('lengths, tape counters, player times, views and counts', () => {
  expect(formatLength(16640)).toBe('4:37:20');
  expect(formatLength(730)).toBe('12:10');
  expect(formatLength(30.4)).toBe('0:30');
  expect(formatCounter(0)).toBe('0:00:00');
  expect(formatCounter(14240)).toBe('3:57:20');
  expect(toTwitchTime(14240)).toBe('3h57m20s');
  expect(toTwitchTime(0)).toBe('0h0m0s');
  expect(formatViews(237)).toBe('237');
  expect(formatViews(1234)).toBe('1.2K');
  expect(padCount(27)).toBe('027');
});

test('cleanTitle cuts the 💥 tail and the old | chat commands', () => {
  expect(cleanTitle(`Win Wednesdays 💥 Games and Gamba?  ${TAIL}`)).toBe('Win Wednesdays');
  expect(cleanTitle(`Chill Thursday - !giveaway After Hunt!${TAIL}`)).toBe('Chill Thursday - !giveaway After Hunt!');
  expect(
    cleanTitle('[EN/PT-BR] Zed Aint Dead.  🔥 | !trees | JOIN !discord | !social | free !bong hits | #GooferGang')
  ).toBe('Zed Aint Dead. 🔥');
  expect(
    cleanTitle('[ENG/PT-BR] Shoot everything/everyone Saturday! |  !asuh !help !currency | !ROAD TO 420 FOLLOWS (GIVEAWAY) <3')
  ).toBe('Shoot everything/everyone Saturday!');
  expect(cleanTitle('5 scat? pants off')).toBe('5 scat? pants off');
  expect(cleanTitle(TAIL)).toBe('Untitled stream');
  expect(cleanTitle('', 'Untitled clip')).toBe('Untitled clip');
});

test('tapeStock picks the tape and speed a stream needs', () => {
  const H = 3600;
  expect(tapeStock(2 * H)).toBe('T-120 · SP');
  expect(tapeStock(2 * H + 1)).toBe('T-120 · LP');
  expect(tapeStock(4 * H)).toBe('T-120 · LP');
  expect(tapeStock(4 * H + 1)).toBe('T-120 · EP');
  expect(tapeStock(6 * H)).toBe('T-120 · EP');
  expect(tapeStock(6 * H + 1)).toBe('T-160 · EP');
  expect(tapeStock(8 * H)).toBe('T-160 · EP');
  expect(tapeStock(8 * H + 1)).toBe('T-160 · EP ×2');
});

test('catalogue numbers and covers', () => {
  expect(catalogueNo('2888141530')).toBe('1530');
  expect(coverUrl({ thumbnail_url: 'https://x/thumb0-%{width}x%{height}.jpg' })).toBe('https://x/thumb0-440x248.jpg');
  expect(coverUrl({ thumbnail_url: '' })).toBeNull();
  expect(
    coverUrl({ thumbnail_url: 'https://vod-secure.twitch.tv/_404/404_processing_%{width}x%{height}.png' })
  ).toBeNull();
});

test('dueBack counts calendar days to the 60-day expiry, never below zero', () => {
  expect(dueBack('2026-10-01T18:24:30Z', FIXTURE_NOW, AZ).daysLeft).toBe(57);
  expect(dueBack('2026-08-17T19:28:09Z', Date.parse('2026-10-16T15:00:00Z'), AZ).daysLeft).toBe(0);
  expect(dueBack('2026-08-01T00:00:00Z', FIXTURE_NOW, AZ).daysLeft).toBe(0);
});

test('weekShelves: Monday-to-Sunday weeks on the viewer calendar, newest first', () => {
  expect(rich.shelves.map((s) => s.label)).toEqual([
    'This week',
    'Last week',
    'Sep 14–20',
    'Sep 7–13',
    'Aug 31–Sep 6',
    'Aug 24–30',
    'Aug 17–23',
  ]);
  expect(rich.shelves.map((s) => s.tapes.length)).toEqual([3, 4, 5, 3, 3, 4, 5]);
  expect(rich.shelves[0].tapes.map((t) => t.no)).toEqual(['9731', '1530', '6857']);
});

test('weekShelves: a Sunday night in Arizona is still last week', () => {
  const tape = { createdMs: Date.parse('2026-09-28T05:30:00Z') };
  expect(weekShelves([tape], FIXTURE_NOW, AZ)[0].label).toBe('Last week');
  expect(weekShelves([tape], FIXTURE_NOW, 'UTC')[0].label).toBe('This week');
});

test('tapes carry their box facts', () => {
  const t = rich.byId['2889109731'];
  expect(t).toMatchObject({
    kind: 'vod',
    title: 'Win Wednesdays',
    no: '9731',
    weekday: 'THU',
    dateLabel: 'Thu, Oct 1',
    length: '4:37:20',
    stock: 'T-120 · EP',
    views: '237',
    dueDate: 'Nov 30',
    dueLabel: 'Due back Nov 30',
  });
  expect(t.cover).toMatch(/thumb0-440x248\.jpg$/);
  expect(t.muted).toEqual([{ start: 5400 / 16640, width: 600 / 16640 }]);
});

test('stickers: new release, then due back, then clips inside, two at most', () => {
  expect(rich.byId['2889109731'].stickers).toEqual([{ kind: 'new', text: 'New release' }]);
  expect(rich.byId['2888141530'].stickers).toEqual([{ kind: 'clips', text: '2 clips inside' }]);
  expect(rich.byId['2881575909'].stickers).toEqual([{ kind: 'clips', text: '1 clip inside' }]);
  const expiring = buildStore(F.expiring);
  expect(expiring.byId['2848973257'].stickers).toEqual([{ kind: 'due', text: 'Due back today' }]);
  expect(expiring.byId['2848973257'].dueDate).toBe('Today');
  expect(expiring.byId['2849770799'].stickers).toEqual([{ kind: 'due', text: 'Due back Oct 17' }]);
  expect(
    tapeStickers({ daysLeft: 3, dueLabel: 'Due back Oct 7', marks: [{}, {}] }, true).map((s) => s.text)
  ).toEqual(['New release', 'Due back Oct 7']);
});

test('Fresh picks: every clip from the last 60 days once, newest first', () => {
  expect(rich.counts).toEqual({ tapes: 27, fresh: 12, classics: 16, clips: 28 });
  expect(new Set(rich.fresh.map((c) => c.id)).size).toBe(12);
  expect(rich.fresh[0].label).toBe("That's a whole lot of bombs aint it?");
  expect(rich.fresh[11].label).toBe('goofer voice');
});

test('clips nobody named read No label at their timestamp', () => {
  expect(rich.fresh.filter((c) => c.label.startsWith('No label')).map((c) => c.label)).toEqual([
    'No label · at 2:30:39',
    'No label · at 2:21:24',
    'No label · at 2:17:41',
    'No label · at 1:41:31',
    'No label · at 3:16:55',
  ]);
  expect(isUnlabeled(`Monday Hunts and Twists${TAIL}`, null)).toBe(true);
  expect(isUnlabeled('Win Wednesdays', 'Win Wednesdays')).toBe(true);
  expect(isUnlabeled('500x hit', 'Hunting')).toBe(false);
});

test('a clip links to its tape while the VOD is in the archive', () => {
  expect(rich.byId['CarefulHyperCasetteKlappa-YJOqxReFjKsu26i4'].foundOn).toEqual({
    id: '2888141530',
    title: 'Win Wednesdays',
    dateLabel: 'Sep 30',
    offset: 14240,
    at: '3:57:20',
  });
  expect(rich.byId.GeniusSmokyOpossumFrankerZ).toMatchObject({
    foundOn: null,
    year: '© 2018',
    length: '0:39',
    picker: 'Moogle_Cat',
    game: 'Escape from Tarkov',
  });
});

test('Cult classics: one aisle per game, the most-watched clip first', () => {
  expect(rich.aisles.map((a) => a.game)).toEqual([
    'Escape from Tarkov',
    'League of Legends',
    'Nioh',
    'Misc.',
    'Slots',
    'iRacing',
    'PUBG: BATTLEGROUNDS',
    'World of Warcraft',
    'Fortnite',
  ]);
  expect(rich.aisles[1].clips.map((c) => c.label)).toEqual([
    'Zed Aint Dead. 🔥',
    'Always Learning... JGL/TOP 🔥',
    'Lux ult?',
  ]);
  expect(aisleName('0')).toBe('Misc.');
  expect(aisleName('Various')).toBe('Misc.');
  expect(aisleName('')).toBe('Misc.');
  expect(aisleName('Nioh')).toBe('Nioh');
});

test('clip marks sit at their offsets, clamped to the tape', () => {
  const marks = rich.byId['2888141530'].marks;
  expect(marks.map((m) => m.at)).toEqual(['3:57:20', '4:05:44']);
  expect(marks[0].position).toBeCloseTo(14240 / 18150, 5);
  const tape = { id: 'x', seconds: 100 };
  expect(clipMarks(tape, [{ id: 'late', foundOn: { id: 'x', offset: 150, at: '0:02:30' } }]).map((m) => m.position)).toEqual([1]);
  expect(clipMarks(tape, [{ id: 'none', foundOn: { id: 'x', offset: null, at: null } }])).toEqual([]);
});

test('a clip without a clipper or a game still files', () => {
  const store = buildStore({
    ...F.rich,
    recentClips: [],
    topClips: [
      {
        id: 'anon',
        created_at: '2018-01-01T00:00:00Z',
        duration: 12,
        view_count: 3,
        title: 'mystery',
        creator_name: '',
        game_name: '',
        video_id: '',
        vod_offset: null,
        thumbnail_url: '',
        url: 'https://www.twitch.tv/gooferg/clip/anon',
      },
    ],
  });
  expect(store.byId.anon).toMatchObject({ picker: 'someone in chat', game: 'Misc.', cover: null });
});

test('pickedBy names you, whatever the case', () => {
  const clip = { picker: 'larrymenta' };
  expect(pickedBy(clip, 'LarryMenta')).toEqual({ you: true, text: 'Picked by you' });
  expect(pickedBy(clip, null)).toEqual({ you: false, text: 'Picked by larrymenta' });
});

test('playerSrc: VODs start where you seek, clips use the clip embed', () => {
  const vod = rich.byId['2888141530'];
  expect(playerSrc(vod, null, 'goofer.tv')).toBe('https://player.twitch.tv/?video=2888141530&parent=goofer.tv&autoplay=true');
  expect(playerSrc(vod, 14240, 'goofer.tv')).toBe(
    'https://player.twitch.tv/?video=2888141530&parent=goofer.tv&autoplay=true&time=3h57m20s'
  );
  expect(playerSrc(rich.byId.GeniusSmokyOpossumFrankerZ, 99, 'goofer.tv')).toBe(
    'https://clips.twitch.tv/embed?clip=GeniusSmokyOpossumFrankerZ&parent=goofer.tv&autoplay=true'
  );
});

test('an empty archive builds an empty store', () => {
  expect(buildStore({ now: FIXTURE_NOW, timeZone: AZ })).toEqual({
    shelves: [],
    fresh: [],
    aisles: [],
    counts: { tapes: 0, fresh: 0, classics: 0, clips: 0 },
    byId: {},
  });
});
```

- [ ] **Step 3: Run the tests and watch them fail**

Run: `CI=true npm test -- --watchAll=false --testPathPattern=videoStoreModel`
Expected: FAIL with `Cannot find module '../videoStoreModel'`.

- [ ] **Step 4: Write the model**

Create `src/components/vods/videoStoreModel.js`:

```js
import { calendarDay } from '../../utils/scheduleTime';

// Goofer Video's floor, worked out from raw Helix data (DESIGN.md §7, Video
// store). Pure: VideoStoreFront renders what buildStore returns.

// Twitch keeps past broadcasts this long on GooferG's tier (the oldest VOD was
// 48 days old on 2026-10-04).
export const ARCHIVE_DAYS = 60;
const DAY_MS = 86400000;
const HOUR = 3600;
// Every stream title ends in a 💥 tail of links; labels cut it.
const TAIL_MARK = '💥';

const pad = (n) => String(n).padStart(2, '0');
const clamp01 = (n) => Math.min(1, Math.max(0, n));

const formats = new Map();
function format(ms, timeZone, options) {
  const key = `${timeZone}|${JSON.stringify(options)}`;
  if (!formats.has(key)) formats.set(key, new Intl.DateTimeFormat('en-US', { timeZone, ...options }));
  return formats.get(key).format(new Date(ms));
}
const shortDate = (ms, tz) => format(ms, tz, { month: 'short', day: 'numeric' });
const longDate = (ms, tz) => format(ms, tz, { weekday: 'short', month: 'short', day: 'numeric' });
const fullDate = (ms, tz) => format(ms, tz, { month: 'short', day: 'numeric', year: 'numeric' });

// Helix lengths: '4h37m20s', '12m10s', '45s'.
export function parseDuration(text) {
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(String(text || ''));
  if (!m) return 0;
  return (Number(m[1]) || 0) * HOUR + (Number(m[2]) || 0) * 60 + (Number(m[3]) || 0);
}

// 4:37:20, 12:10, 0:30.
export function formatLength(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / HOUR);
  const m = Math.floor((s % HOUR) / 60);
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

// The tape counter always shows hours: 0:00:00, 3:57:20.
export function formatCounter(seconds) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / HOUR)}:${pad(Math.floor((s % HOUR) / 60))}:${pad(s % 60)}`;
}

// The Twitch player's start time: 3h57m20s.
export function toTwitchTime(seconds) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / HOUR)}h${Math.floor((s % HOUR) / 60)}m${s % 60}s`;
}

// Counts on signs and the sign-off: 027.
export const padCount = (n) => String(n).padStart(3, '0');

export function formatViews(n) {
  const v = Number(n) || 0;
  return v >= 1000 ? `${(v / 1000).toFixed(1)}K` : String(v);
}

// "Win Wednesdays 💥 Games and Gamba? 💥communityhunts.gg / …" → "Win Wednesdays".
// "[EN/PT-BR] Zed Aint Dead.  🔥 | !trees | …" → "Zed Aint Dead. 🔥".
export function cleanTitle(raw, fallback = 'Untitled stream') {
  let t = String(raw || '').replace(/^\s*\[[^\]]*\]\s*/, '');
  const cut = t.search(/💥| \| /);
  if (cut >= 0) t = t.slice(0, cut);
  t = t.replace(/\s+/g, ' ').replace(/[\s|·:-]+$/, '').trim();
  return t || fallback;
}

// The VHS tape a stream this long needs: a T-120 holds 2h SP, 4h LP or 6h EP;
// a T-160 holds 8h EP.
export function tapeStock(seconds) {
  if (seconds <= 2 * HOUR) return 'T-120 · SP';
  if (seconds <= 4 * HOUR) return 'T-120 · LP';
  if (seconds <= 6 * HOUR) return 'T-120 · EP';
  if (seconds <= 8 * HOUR) return 'T-160 · EP';
  return 'T-160 · EP ×2';
}

// The last 4 digits of the VOD id: stable while older tapes expire around it.
export function catalogueNo(id) {
  return String(id).slice(-4);
}

// The 440×248 cover, or null for a VOD with no picture yet (an empty URL, or
// Twitch's /_404/ processing image).
export function coverUrl(video) {
  const url = video && video.thumbnail_url;
  if (!url || url.includes('/_404/')) return null;
  return url.replace('%{width}', '440').replace('%{height}', '248');
}

// When Twitch deletes the VOD, in calendar days on the viewer's clock.
export function dueBack(createdAt, now, timeZone) {
  const date = Date.parse(createdAt) + ARCHIVE_DAYS * DAY_MS;
  return { date, daysLeft: Math.max(0, calendarDay(date, timeZone) - calendarDay(now, timeZone)) };
}

// A clip nobody named carries its stream's title: the 💥 tail, or the VOD's
// title exactly.
export function isUnlabeled(rawClipTitle, rawVodTitle) {
  const t = String(rawClipTitle || '');
  return t.includes(TAIL_MARK) || (!!rawVodTitle && t === rawVodTitle);
}

// App falls back to the raw game id (or 'Various') when Helix has no name.
export function aisleName(gameName) {
  const name = String(gameName || '').trim();
  return !name || name === 'Various' || /^\d+$/.test(name) ? 'Misc.' : name;
}

export function pickedBy(clip, viewerName) {
  const you = !!viewerName && clip.picker.toLowerCase() === String(viewerName).toLowerCase();
  return { you, text: you ? 'Picked by you' : `Picked by ${clip.picker}` };
}

export function playerSrc(item, at, host) {
  if (item.kind === 'clip') {
    return `https://clips.twitch.tv/embed?clip=${encodeURIComponent(item.id)}&parent=${host}&autoplay=true`;
  }
  const time = at != null ? `&time=${toTwitchTime(at)}` : '';
  return `https://player.twitch.tv/?video=${encodeURIComponent(item.id)}&parent=${host}&autoplay=true${time}`;
}

// The Monday starting the week a calendarDay falls in (day 0, 1970-01-01, was a Thursday).
const mondayOf = (day) => day - ((((day + 3) % 7) + 7) % 7);

function weekLabel(monday, thisMonday) {
  if (monday === thisMonday) return 'This week';
  if (monday === thisMonday - 7) return 'Last week';
  const a = monday * DAY_MS;
  const b = (monday + 6) * DAY_MS;
  const month = (ms) => format(ms, 'UTC', { month: 'short' });
  const day = (ms) => format(ms, 'UTC', { day: 'numeric' });
  return month(a) === month(b) ? `${month(a)} ${day(a)}–${day(b)}` : `${month(a)} ${day(a)}–${month(b)} ${day(b)}`;
}

// One shelf per Monday-to-Sunday week on the viewer's calendar, newest first.
export function weekShelves(tapes, now, timeZone) {
  const thisMonday = mondayOf(calendarDay(now, timeZone));
  const weeks = new Map();
  for (const tape of tapes) {
    const monday = mondayOf(calendarDay(tape.createdMs, timeZone));
    if (!weeks.has(monday)) weeks.set(monday, []);
    weeks.get(monday).push(tape);
  }
  return [...weeks.entries()]
    .sort(([a], [b]) => b - a)
    .map(([monday, list]) => ({
      key: `week-${monday}`,
      label: weekLabel(monday, thisMonday),
      tapes: [...list].sort((x, y) => y.createdMs - x.createdMs),
    }));
}

function toTape(video, now, timeZone) {
  const seconds = parseDuration(video.duration);
  const createdMs = Date.parse(video.created_at);
  const due = dueBack(video.created_at, now, timeZone);
  return {
    kind: 'vod',
    id: String(video.id),
    rawTitle: video.title || '',
    title: cleanTitle(video.title),
    no: catalogueNo(video.id),
    createdMs,
    weekday: format(createdMs, timeZone, { weekday: 'short' }).toUpperCase(),
    dateLabel: longDate(createdMs, timeZone),
    seconds,
    length: formatLength(seconds),
    stock: tapeStock(seconds),
    views: formatViews(video.view_count),
    cover: coverUrl(video),
    url: video.url,
    daysLeft: due.daysLeft,
    dueDate: due.daysLeft === 0 ? 'Today' : shortDate(due.date, timeZone),
    dueLabel: due.daysLeft === 0 ? 'Due back today' : `Due back ${shortDate(due.date, timeZone)}`,
    muted:
      seconds > 0
        ? (video.muted_segments || []).map((m) => ({
            start: clamp01(m.offset / seconds),
            width: clamp01(m.duration / seconds),
          }))
        : [],
    marks: [],
    stickers: [],
  };
}

function toClip(clip, tapesById, timeZone) {
  const createdMs = Date.parse(clip.created_at);
  const seconds = Math.round(Number(clip.duration) || 0);
  const offset = Number.isFinite(clip.vod_offset) ? clip.vod_offset : null;
  const tape = clip.video_id ? tapesById.get(String(clip.video_id)) : null;
  const label = isUnlabeled(clip.title, tape && tape.rawTitle)
    ? `No label · ${offset != null ? `at ${formatCounter(offset)}` : shortDate(createdMs, timeZone)}`
    : cleanTitle(clip.title, 'Untitled clip');
  return {
    kind: 'clip',
    id: String(clip.id),
    label,
    picker: clip.creator_name || 'someone in chat',
    createdMs,
    dateLabel: fullDate(createdMs, timeZone),
    year: `© ${format(createdMs, timeZone, { year: 'numeric' })}`,
    seconds,
    length: formatLength(seconds),
    views: formatViews(clip.view_count),
    viewCount: Number(clip.view_count) || 0,
    cover: clip.thumbnail_url || null,
    url: clip.url,
    game: aisleName(clip.game_name),
    foundOn: tape
      ? {
          id: tape.id,
          title: tape.title,
          dateLabel: shortDate(tape.createdMs, timeZone),
          offset,
          at: offset != null ? formatCounter(offset) : null,
        }
      : null,
  };
}

// Clip marks on a tape, in tape order. `position` runs 0 to 1 along it.
export function clipMarks(tape, clips) {
  return clips
    .filter((c) => c.foundOn && c.foundOn.id === tape.id && c.foundOn.offset != null)
    .sort((a, b) => a.foundOn.offset - b.foundOn.offset)
    .map((c) => ({
      clip: c,
      offset: c.foundOn.offset,
      at: c.foundOn.at,
      position: tape.seconds > 0 ? clamp01(c.foundOn.offset / tape.seconds) : 0,
    }));
}

// At most two stickers per box, in this order.
export function tapeStickers(tape, isNewest) {
  const out = [];
  if (isNewest) out.push({ kind: 'new', text: 'New release' });
  if (tape.daysLeft <= 7) out.push({ kind: 'due', text: tape.dueLabel });
  const n = tape.marks.length;
  if (n > 0) out.push({ kind: 'clips', text: `${n} ${n === 1 ? 'clip' : 'clips'} inside` });
  return out.slice(0, 2);
}

// Fresh picks: every clip from the last ARCHIVE_DAYS, newest first. Cult
// classics: the rest of the all-time top clips, in their views order.
export function splitClips(topClips, recentClips, now) {
  const cutoff = now - ARCHIVE_DAYS * DAY_MS;
  const seen = new Set();
  const fresh = [];
  for (const c of [...recentClips, ...topClips]) {
    if (seen.has(c.id) || c.createdMs < cutoff) continue;
    seen.add(c.id);
    fresh.push(c);
  }
  fresh.sort((a, b) => b.createdMs - a.createdMs);
  const classics = [];
  for (const c of topClips) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    classics.push(c);
  }
  return { fresh, classics };
}

// One aisle per game, the aisle with the most-watched clip first.
export function cultAisles(classics) {
  const games = new Map();
  for (const c of classics) {
    if (!games.has(c.game)) games.set(c.game, []);
    games.get(c.game).push(c);
  }
  return [...games.entries()]
    .map(([game, clips]) => ({
      game,
      key: `aisle-${game.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      clips: [...clips].sort((a, b) => b.viewCount - a.viewCount),
    }))
    .sort((a, b) => b.clips[0].viewCount - a.clips[0].viewCount);
}

// Everything VideoStoreFront renders, from App's props and the recent clips.
export function buildStore({ videos = [], topClips = [], recentClips = [], now, timeZone }) {
  const tapes = videos.map((v) => toTape(v, now, timeZone)).sort((a, b) => b.createdMs - a.createdMs);
  const tapesById = new Map(tapes.map((t) => [t.id, t]));
  const norm = (list) => list.map((c) => toClip(c, tapesById, timeZone));
  const { fresh, classics } = splitClips(norm(topClips), norm(recentClips), now);
  const clips = [...fresh, ...classics];
  tapes.forEach((tape, i) => {
    tape.marks = clipMarks(tape, clips);
    tape.stickers = tapeStickers(tape, i === 0);
  });
  const byId = {};
  for (const item of [...tapes, ...clips]) byId[item.id] = item;
  return {
    shelves: weekShelves(tapes, now, timeZone),
    fresh,
    aisles: cultAisles(classics),
    counts: { tapes: tapes.length, fresh: fresh.length, classics: classics.length, clips: clips.length },
    byId,
  };
}
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `CI=true npm test -- --watchAll=false --testPathPattern=videoStoreModel`
Expected: PASS, 20 tests.

- [ ] **Step 6: Commit**

```bash
test "$(git branch --show-current)" = feat/onair-vods && git add src/components/vods && git commit -m "feat(vods): store model and fixtures for Goofer Video"
```

---

### Task 2: Paper tokens, the marker face and the contract

**Files:**
- Modify: `tailwind.config.js` (`colors.onair`, `fontFamily`, `borderRadius`)
- Modify: `public/index.html:37` (Google Fonts URL)
- Modify: `src/components/onAir/__tests__/onAirContract.test.js`

**Interfaces:**
- Produces these classes, used by Tasks 4–7:
  - colours: `bg-onair-paper`, `text-onair-paper`, `text-onair-paper-ink`
  - font: `font-onair-marker`
  - radii: `rounded-onair-case` (6px), `rounded-onair-label` (3px)

- [ ] **Step 1: Write the failing contract rules**

In `src/components/onAir/__tests__/onAirContract.test.js`:

Add `'src/components/vods'` to `DIRS`:

```js
const DIRS = [
  'src/components/onAir',
  'src/components/hunts',
  'src/components/store',
  'src/components/schedule',
  'src/components/nav',
  'src/components/gamba',
  'src/components/vods',
];
```

Add the vods fixtures to the raw-colour exemptions:

```js
const RAW_COLOUR_EXEMPT = [
  'src/components/hunts/huntFixtures.js',
  'src/components/store/storeFixtures.js',
  'src/components/vods/videoStoreFixtures.js',
];
```

In the `'Tokens: no raw colours or bare radii …'` test, add vods to the `only` filter (keep the rest of the test as it is):

```js
        (rel.startsWith('src/components/hunts/') ||
          rel.startsWith('src/components/store/') ||
          rel.startsWith('src/components/schedule/') ||
          rel.startsWith('src/components/vods/') ||
          isNavChrome(rel)) &&
```

Then append these tests at the end of the file:

```js
const isVods = (rel) => rel.startsWith('src/components/vods/');

function srcFiles(dir) {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((d) => {
    const rel = `${dir}/${d.name}`;
    if (d.isDirectory()) return d.name === '__tests__' ? [] : srcFiles(rel);
    return d.name.endsWith('.js') ? [rel] : [];
  });
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test('Type: the marker face is Goofer Video only', () => {
  const outside = srcFiles('src')
    .filter((rel) => !isVods(rel))
    .filter((rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').includes('font-onair-marker'));
  expect(outside).toEqual([]);
});

test('Type: marker text is 15px or larger, its size set on the same line', () => {
  expect(
    offenders(/font-onair-marker(?!.*text-\[(0\.9375|1\.0625|1\.25|1\.375|1\.5|1\.875|3\.75)rem\])/, { only: isVods })
  ).toEqual([]);
});

test('Tokens: Goofer Video radii are tokens, never arbitrary values', () => {
  expect(offenders(/rounded-\[/, { only: isVods })).toEqual([]);
});

test('Readable Labels: paper ink holds 7:1 on label stock and 4.5:1 on the signal and loss stickers', () => {
  expect(contrast(onair.paper.ink, onair.paper.DEFAULT)).toBeGreaterThanOrEqual(7);
  expect(contrast(onair.paper.ink, onair.signal.DEFAULT)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(onair.paper.ink, onair.loss)).toBeGreaterThanOrEqual(4.5);
});
```

- [ ] **Step 2: Run the contract test and watch the paper rule fail**

Run: `CI=true npm test -- --watchAll=false --testPathPattern=onAirContract`
Expected: FAIL in `Readable Labels: paper ink …` with `Cannot read properties of undefined (reading 'ink')`. The other new rules pass, because nothing uses the marker yet.

- [ ] **Step 3: Add the tokens**

In `tailwind.config.js`, inside `colors.onair`, after the `ticket` line:

```js
          ticket: { top: '#2a1d3d', mid: '#231933', bottom: '#17121f' },
          // Goofer Video's label stock and the ink printed on it (DESIGN.md §7, Video store).
          paper: { DEFAULT: '#ece3cf', ink: '#231c17' },
```

In `fontFamily`, after `'onair-mono'`:

```js
        'onair-mono': ['"JetBrains Mono"', 'source-code-pro', 'Menlo', 'Consolas', 'monospace'],
        // Goofer Video's handwritten labels and index cards only (DESIGN.md §7).
        'onair-marker': ['"Permanent Marker"', '"Bricolage Grotesque"', 'cursive'],
```

In `borderRadius`, after `'onair-tile'`:

```js
        'onair-tile': '10px',
        // Goofer Video: the VHS box, and its labels, stickers and photo windows.
        'onair-case': '6px',
        'onair-label': '3px',
```

In `public/index.html`, replace line 37 so the existing On Air stylesheet also loads Permanent Marker:

```html
    <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=JetBrains+Mono:wght@400;600;700&family=Permanent+Marker&display=swap" rel="stylesheet" />
```

- [ ] **Step 4: Run the contract test and watch it pass**

Run: `CI=true npm test -- --watchAll=false --testPathPattern=onAirContract`
Expected: PASS (paper ink measures about 13:1 on paper, 10:1 on signal and 6:1 on loss).

- [ ] **Step 5: Commit**

```bash
test "$(git branch --show-current)" = feat/onair-vods && git add tailwind.config.js public/index.html src/components/onAir/__tests__/onAirContract.test.js && git commit -m "feat(vods): paper tokens, marker face and contract rules"
```

---

### Task 3: The whole archive and the recent clips

**Files:**
- Modify: `src/utils/twitchApi.js:37-49` (`getTwitchVideos`), and add `getTwitchClipsBetween` after `getTwitchClips`
- Create: `src/components/vods/useRecentClips.js`
- Test: `src/utils/__tests__/twitchApi.test.js`, `src/components/vods/__tests__/useRecentClips.test.js`

**Interfaces:**
- Consumes: `getTwitchAccessToken()`, `getTwitchUserId(token)` and `getGameNames(token, ids)` (resolves `{ [gameId]: name }`, `{}` on error) from `src/utils/twitchApi.js`; `ARCHIVE_DAYS` from Task 1.
- Produces:
  - `getTwitchClipsBetween(accessToken, userId, startedAt, endedAt, first = 50)` → `Promise<clip[]>`, which throws on a non-OK response.
  - `useRecentClips()` (default export) → Helix clips with `game_name` added. It returns `[]` while loading and on failure.

- [ ] **Step 1: Write the failing API tests**

Create `src/utils/__tests__/twitchApi.test.js`:

```js
import { getTwitchClipsBetween, getTwitchVideos } from '../twitchApi';

const realFetch = global.fetch;

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [{ id: 'a' }] }) });
});

afterEach(() => {
  global.fetch = realFetch;
});

test('getTwitchVideos asks for the whole archive', async () => {
  await getTwitchVideos('tok', '42');
  expect(global.fetch.mock.calls[0][0]).toBe('https://api.twitch.tv/helix/videos?user_id=42&first=100&type=archive');
});

test('getTwitchClipsBetween sends both ends of the window', async () => {
  const clips = await getTwitchClipsBetween('tok', '42', '2026-08-05T19:00:00.000Z', '2026-10-04T19:00:00.000Z');
  const url = new URL(global.fetch.mock.calls[0][0]);
  expect(url.origin + url.pathname).toBe('https://api.twitch.tv/helix/clips');
  expect(Object.fromEntries(url.searchParams)).toEqual({
    broadcaster_id: '42',
    first: '50',
    started_at: '2026-08-05T19:00:00.000Z',
    ended_at: '2026-10-04T19:00:00.000Z',
  });
  expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer tok');
  expect(clips).toEqual([{ id: 'a' }]);
});

test('getTwitchClipsBetween throws on a Helix error', async () => {
  global.fetch.mockResolvedValue({ ok: false, status: 429, json: async () => ({}) });
  await expect(getTwitchClipsBetween('tok', '42', 'a', 'b')).rejects.toThrow('429');
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `CI=true npm test -- --watchAll=false --testPathPattern=twitchApi`
Expected: FAIL. The videos URL still has `first=20`, and `getTwitchClipsBetween is not a function`.

- [ ] **Step 3: Change the API**

In `src/utils/twitchApi.js`, change the `getTwitchVideos` URL:

```js
    `https://api.twitch.tv/helix/videos?user_id=${userId}&first=100&type=archive`,
```

Add `getTwitchClipsBetween` after `getTwitchClips`:

```js
// Clips made between two instants (ISO strings). Helix defaults ended_at to a
// week after started_at, so /vods always sends both.
export async function getTwitchClipsBetween(accessToken, userId, startedAt, endedAt, first = 50) {
  const params = new URLSearchParams({
    broadcaster_id: userId,
    first: String(first),
    started_at: startedAt,
    ended_at: endedAt,
  });
  const response = await fetch(`https://api.twitch.tv/helix/clips?${params}`, {
    headers: {
      'Client-ID': TWITCH_CLIENT_ID,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) throw new Error(`Helix clips ${response.status}`);
  const data = await response.json();
  return data.data || [];
}
```

- [ ] **Step 4: Run the API tests and watch them pass**

Run: `CI=true npm test -- --watchAll=false --testPathPattern=twitchApi`
Expected: PASS, 3 tests.

- [ ] **Step 5: Write the failing hook tests**

Create `src/components/vods/__tests__/useRecentClips.test.js`:

```js
import { act, render, waitFor } from '@testing-library/react';
import useRecentClips from '../useRecentClips';
import { getGameNames, getTwitchAccessToken, getTwitchClipsBetween, getTwitchUserId } from '../../../utils/twitchApi';

jest.mock('../../../utils/twitchApi', () => ({
  getTwitchAccessToken: jest.fn(),
  getTwitchUserId: jest.fn(),
  getTwitchClipsBetween: jest.fn(),
  getGameNames: jest.fn(),
}));

function Probe({ onValue }) {
  onValue(useRecentClips());
  return null;
}

beforeEach(() => {
  getTwitchAccessToken.mockResolvedValue('tok');
  getTwitchUserId.mockResolvedValue('42');
  getTwitchClipsBetween.mockResolvedValue([{ id: 'a', game_id: '498566' }]);
  getGameNames.mockResolvedValue({ 498566: 'Slots' });
});

test('fetches the last 60 days once and names the games', async () => {
  let value;
  render(<Probe onValue={(v) => { value = v; }} />);
  expect(value).toEqual([]);
  await waitFor(() => expect(value).toEqual([{ id: 'a', game_id: '498566', game_name: 'Slots' }]));
  expect(getTwitchClipsBetween).toHaveBeenCalledTimes(1);
  const [token, userId, startedAt, endedAt] = getTwitchClipsBetween.mock.calls[0];
  expect([token, userId]).toEqual(['tok', '42']);
  expect(Date.parse(endedAt) - Date.parse(startedAt)).toBe(60 * 86400000);
  expect(Math.abs(Date.parse(endedAt) - Date.now())).toBeLessThan(5000);
  expect(getGameNames).toHaveBeenCalledWith('tok', ['498566']);
});

test('a failed fetch leaves an empty list', async () => {
  getTwitchClipsBetween.mockRejectedValue(new Error('Helix clips 500'));
  let value;
  render(<Probe onValue={(v) => { value = v; }} />);
  await waitFor(() => expect(getTwitchClipsBetween).toHaveBeenCalled());
  await act(async () => {});
  expect(value).toEqual([]);
});

test('leaving the page before the clips land sets nothing', async () => {
  let resolve;
  getTwitchClipsBetween.mockImplementation(() => new Promise((r) => { resolve = r; }));
  let value;
  const { unmount } = render(<Probe onValue={(v) => { value = v; }} />);
  await waitFor(() => expect(getTwitchClipsBetween).toHaveBeenCalled());
  unmount();
  await act(async () => resolve([{ id: 'late', game_id: '1' }]));
  expect(value).toEqual([]);
});
```

- [ ] **Step 6: Run them and watch them fail**

Run: `CI=true npm test -- --watchAll=false --testPathPattern=useRecentClips`
Expected: FAIL with `Cannot find module '../useRecentClips'`.

- [ ] **Step 7: Write the hook**

Create `src/components/vods/useRecentClips.js`:

```js
import { useEffect, useState } from 'react';
import { getGameNames, getTwitchAccessToken, getTwitchClipsBetween, getTwitchUserId } from '../../utils/twitchApi';
import { ARCHIVE_DAYS } from './videoStoreModel';

const DAY_MS = 86400000;

// The last ARCHIVE_DAYS of clips, fetched once per visit to /vods. App's poll
// only carries the all-time top 20, mostly from 2016 to 2018, and this isn't
// worth adding to every visitor's 120s poll. [] while loading or on failure:
// Fresh picks then falls back to the recent clips in the top 20.
export default function useRecentClips() {
  const [clips, setClips] = useState([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getTwitchAccessToken();
        const userId = await getTwitchUserId(token);
        const now = Date.now();
        const found = await getTwitchClipsBetween(
          token,
          userId,
          new Date(now - ARCHIVE_DAYS * DAY_MS).toISOString(),
          new Date(now).toISOString()
        );
        const names = await getGameNames(token, found.map((c) => c.game_id));
        if (!cancelled) setClips(found.map((c) => ({ ...c, game_name: names[c.game_id] || '' })));
      } catch {
        // App's top clips still fill Fresh picks.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return clips;
}
```

- [ ] **Step 8: Run the hook tests and watch them pass**

Run: `CI=true npm test -- --watchAll=false --testPathPattern=useRecentClips`
Expected: PASS, 3 tests.

- [ ] **Step 9: Commit**

```bash
test "$(git branch --show-current)" = feat/onair-vods && git add src/utils/twitchApi.js src/utils/__tests__/twitchApi.test.js src/components/vods/useRecentClips.js src/components/vods/__tests__/useRecentClips.test.js && git commit -m "feat(vods): fetch the whole archive and the last 60 days of clips"
```

---

### Task 4: Shelves, VHS boxes and clip cassettes

**Files:**
- Create: `src/components/vods/Shelf.js` (named exports `Aisle`, `Shelf`)
- Create: `src/components/vods/VhsBox.js` (default `VhsBox`, named `Sticker`)
- Create: `src/components/vods/ClipCassette.js`
- Test: `src/components/vods/__tests__/shelfPieces.test.js`

**Interfaces:**
- Consumes: tape and clip objects from `buildStore` (Task 1); `pickedBy`, `padCount`; `FOCUS` and `MONO` from `src/components/onAir/classes.js`; the Task 2 tokens.
- Produces:
  - `<Aisle id title count>` renders a `section` region named by an `h2` whose `id` is `id` and that has `tabIndex={-1}`.
  - `<Shelf label divider? size="box"|"clip">` renders an `h3` and a `ul` labelled by it, each child wrapped in an `li` with a lip.
  - `<VhsBox tape onOpen>` calls `onOpen(tape.id)` when clicked.
  - `<ClipCassette clip viewerName showYear? onOpen>` calls `onOpen(clip.id)` when clicked.
  - Button names (Tasks 7 and 8 query these exact strings):
    - box: `"{title}, {dateLabel}, {length}[, {sticker text}…]"`
    - cassette: `"{label}, {Picked by …}, {length}[, {year}]"`

- [ ] **Step 1: Write the failing tests**

Create `src/components/vods/__tests__/shelfPieces.test.js`:

```js
import { fireEvent, render, screen, within } from '@testing-library/react';
import { Aisle, Shelf } from '../Shelf';
import VhsBox from '../VhsBox';
import ClipCassette from '../ClipCassette';
import { buildStore } from '../videoStoreModel';
import { VIDEO_STORE_FIXTURES as F } from '../videoStoreFixtures';

const store = buildStore(F.rich);

test('a VHS box names itself and opens its tape', () => {
  const onOpen = jest.fn();
  render(<VhsBox tape={store.byId['2888141530']} onOpen={onOpen} />);
  const box = screen.getByRole('button', { name: 'Win Wednesdays, Wed, Sep 30, 5:02:30, 2 clips inside' });
  expect(within(box).getByText('No. 1530')).toBeTruthy();
  expect(within(box).getByText('WED')).toBeTruthy();
  expect(within(box).getByText('T-120 · EP')).toBeTruthy();
  expect(within(box).getByText('2 clips inside')).toBeTruthy();
  fireEvent.click(box);
  expect(onOpen).toHaveBeenCalledWith('2888141530');
});

test('the newest box wears New release over its cover', () => {
  render(<VhsBox tape={store.byId['2889109731']} onOpen={() => {}} />);
  expect(screen.getByText('New release')).toBeTruthy();
  expect(screen.getByRole('button').querySelector('img').getAttribute('src')).toMatch(/thumb0-440x248\.jpg$/);
});

test('a box with no picture shows the test card', () => {
  const tape = buildStore(F.nothumb).byId['2889109731'];
  render(<VhsBox tape={tape} onOpen={() => {}} />);
  expect(screen.getByTestId('no-picture')).toBeTruthy();
  expect(screen.getByRole('button').querySelector('img')).toBeNull();
});

test('a cassette credits whoever clipped it, with its year in the classics', () => {
  const onOpen = jest.fn();
  render(<ClipCassette clip={store.byId.GeniusSmokyOpossumFrankerZ} viewerName={null} showYear onOpen={onOpen} />);
  const cassette = screen.getByRole('button', { name: 'What just happened, Picked by Moogle_Cat, 0:39, © 2018' });
  expect(within(cassette).getByText('© 2018')).toBeTruthy();
  expect(within(cassette).getByText('219 views')).toBeTruthy();
  fireEvent.click(cassette);
  expect(onOpen).toHaveBeenCalledWith('GeniusSmokyOpossumFrankerZ');
});

test('your own clip reads Picked by you', () => {
  render(<ClipCassette clip={store.byId.GeniusSmokyOpossumFrankerZ} viewerName="moogle_cat" onOpen={() => {}} />);
  expect(screen.getByText('Picked by you').getAttribute('data-you')).toBe('true');
  expect(screen.queryByText('© 2018')).toBeNull();
});

test('a cassette without a picture shows the test card', () => {
  const clip = { ...store.byId.GeniusSmokyOpossumFrankerZ, cover: null };
  render(<ClipCassette clip={clip} viewerName={null} onOpen={() => {}} />);
  expect(screen.getByTestId('no-picture')).toBeTruthy();
});

test('a shelf labels its row and puts every tape on the lip', () => {
  render(
    <Shelf label="This week">
      <span>a</span>
      <span>b</span>
    </Shelf>
  );
  expect(screen.getByRole('heading', { level: 3, name: 'This week' })).toBeTruthy();
  expect(within(screen.getByRole('list', { name: 'This week' })).getAllByRole('listitem')).toHaveLength(2);
});

test('a divider shelf is still a level-3 heading', () => {
  render(
    <Shelf label="Nioh" divider size="clip">
      <span>a</span>
    </Shelf>
  );
  expect(screen.getByRole('heading', { level: 3, name: 'Nioh' })).toBeTruthy();
});

test('an aisle is a region named by a focusable heading', () => {
  render(
    <Aisle id="fresh-picks" title="Fresh picks" count={12}>
      <p>shelves</p>
    </Aisle>
  );
  const heading = screen.getByRole('heading', { level: 2, name: 'Fresh picks' });
  expect(screen.getByRole('region', { name: 'Fresh picks' })).toBeTruthy();
  expect(heading.id).toBe('fresh-picks');
  expect(heading.getAttribute('tabindex')).toBe('-1');
  expect(screen.getByText('012 on the shelf')).toBeTruthy();
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `CI=true npm test -- --watchAll=false --testPathPattern=shelfPieces`
Expected: FAIL with `Cannot find module '../Shelf'`.

- [ ] **Step 3: Write `Shelf.js`**

```js
import { Children, useId } from 'react';
import { MONO } from '../onAir/classes';
import { padCount } from './videoStoreModel';

// An aisle of the store (New releases, Fresh picks, Cult classics). Its
// heading is the aisle sign's jump target, so it can take focus.
export function Aisle({ id, title, count, children }) {
  return (
    <section aria-labelledby={id} className="mt-14">
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id={id}
          tabIndex={-1}
          className="scroll-mt-24 text-[1.875rem] font-extrabold leading-none tracking-[-0.03em] text-onair-ink-1 outline-none"
        >
          {title}
        </h2>
        <span className={`${MONO} text-[0.6875rem] tracking-[0.2em] text-onair-ink-4`}>{padCount(count)} on the shelf</span>
      </div>
      <div className="mt-6 space-y-10">{children}</div>
    </section>
  );
}

// One shelf: a heading (a week, or a game's paper divider), then the row of
// tapes on a lip. Below md the row scrolls sideways; from md it wraps, and
// each item carries its own stretch of lip so the lip runs under every row.
export function Shelf({ label, divider = false, size = 'box', children }) {
  const headingId = useId();
  const width = size === 'box' ? 'w-[42vw]' : 'w-[64vw]';
  const columns =
    size === 'box'
      ? 'md:grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))]'
      : 'md:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]';
  return (
    <div>
      {divider ? (
        <h3
          id={headingId}
          className="inline-block rounded-onair-label bg-onair-paper px-3 py-1.5 text-[1.0625rem] font-extrabold text-onair-paper-ink shadow-onair-raised"
        >
          {label}
        </h3>
      ) : (
        <h3 id={headingId} className={`${MONO} text-[0.75rem] font-bold tracking-[0.2em] text-onair-ink-3`}>
          {label}
        </h3>
      )}
      <ul
        aria-labelledby={headingId}
        className={`-mx-2 mt-3 flex snap-x snap-mandatory overflow-x-auto pb-2 md:grid md:snap-none md:gap-y-6 md:overflow-visible ${columns}`}
      >
        {Children.map(children, (child) => (
          <li className={`shrink-0 snap-start px-2 md:w-auto ${width}`}>
            {child}
            <div
              aria-hidden="true"
              className="-mx-2 mt-3 h-2.5 bg-gradient-to-b from-onair-surface-raised to-onair-surface-4 shadow-onair-card"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Write `VhsBox.js`**

```js
import { FOCUS, MONO } from '../onAir/classes';

const STICKER = {
  new: 'bg-onair-signal text-onair-paper-ink',
  due: 'bg-onair-loss text-onair-paper-ink',
  clips: 'bg-onair-paper text-onair-paper-ink',
};

export function Sticker({ sticker }) {
  return (
    <span
      className={`${MONO} inline-block rounded-onair-label px-1.5 py-0.5 text-[0.625rem] font-bold tracking-[0.15em] shadow-onair-raised ${STICKER[sticker.kind]}`}
    >
      {sticker.text}
    </span>
  );
}

// A VOD on the shelf: a portrait clamshell. The sleeve has the 16:9 thumbnail
// in a photo window, the title on a marker label, the catalogue number and
// weekday down the spine, and the tape stock and length along the bottom.
export default function VhsBox({ tape, onOpen }) {
  const name = [tape.title, tape.dateLabel, tape.length, ...tape.stickers.map((s) => s.text)].join(', ');
  return (
    <button
      type="button"
      onClick={() => onOpen(tape.id)}
      aria-label={name}
      className={`group block w-full rounded-onair-case text-left ${FOCUS}`}
    >
      <div className="relative flex aspect-[2/3] overflow-hidden rounded-onair-case bg-gradient-to-b from-onair-surface-1 to-onair-surface-4 shadow-onair-card transition-transform duration-200 motion-safe:group-hover:-translate-y-1 motion-safe:group-focus-visible:-translate-y-1">
        <div aria-hidden="true" className="flex w-6 shrink-0 flex-col items-center justify-between bg-onair-surface-4 py-2 shadow-onair-row">
          <span className={`${MONO} text-[0.625rem] tracking-[0.15em] text-onair-ink-4 [writing-mode:vertical-rl]`}>No. {tape.no}</span>
          <span className={`${MONO} text-[0.625rem] font-bold tracking-[0.15em] text-onair-ink-3 [writing-mode:vertical-rl]`}>{tape.weekday}</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col p-2">
          <div className="relative aspect-video overflow-hidden rounded-onair-label bg-onair-surface-4 shadow-onair-well">
            {tape.cover ? (
              <img src={tape.cover} alt="" loading="lazy" className="h-full w-full object-cover" />
            ) : (
              <div data-testid="no-picture" className="flex h-full items-center justify-center bg-onair-track">
                <span className={`${MONO} text-[0.625rem] tracking-[0.15em] text-onair-ink-4`}>No picture</span>
              </div>
            )}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-onair-scanlines" />
          </div>
          <p className="mt-2 line-clamp-3 break-words rounded-onair-label bg-onair-paper px-2 py-1 font-onair-marker text-[0.9375rem] leading-tight text-onair-paper-ink">
            {tape.title}
          </p>
          {tape.stickers.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {tape.stickers.map((s) => (
                <Sticker key={s.kind} sticker={s} />
              ))}
            </div>
          )}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2 border-t border-white/10 pt-1.5">
            <span className={`${MONO} text-[0.625rem] font-bold tracking-[0.15em] text-onair-ink-3`}>{tape.stock}</span>
            <span className={`${MONO} text-[0.625rem] tracking-[0.15em] text-onair-ink-4`}>{tape.length}</span>
          </div>
        </div>
      </div>
    </button>
  );
}
```

The test queries `within(box).getByText('No. 1530')`. `getByText` matches the span's text `No. 1530` even though the span is `aria-hidden`, because `within(...).getByText` doesn't filter on accessibility.

- [ ] **Step 5: Write `ClipCassette.js`**

```js
import { FOCUS, MONO } from '../onAir/classes';
import { pickedBy } from './videoStoreModel';

// A clip: a small landscape camcorder case (the thumbnail fits it uncropped),
// its label line, and the index card crediting whoever clipped it. A viewer's
// own clip says "Picked by you" on a purple card, the On Air "you" role.
export default function ClipCassette({ clip, viewerName, showYear = false, onOpen }) {
  const pick = pickedBy(clip, viewerName);
  const name = [clip.label, pick.text, clip.length, showYear ? clip.year : null].filter(Boolean).join(', ');
  return (
    <button
      type="button"
      onClick={() => onOpen(clip.id)}
      aria-label={name}
      className={`group block w-full rounded-onair-tile text-left ${FOCUS}`}
    >
      <div className="relative rounded-onair-tile bg-gradient-to-b from-onair-surface-1 to-onair-surface-4 p-2 shadow-onair-card transition-transform duration-200 motion-safe:group-hover:-translate-y-1 motion-safe:group-focus-visible:-translate-y-1">
        <div className="relative aspect-video overflow-hidden rounded-onair-label bg-onair-surface-4 shadow-onair-well">
          {clip.cover ? (
            <img src={clip.cover} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div data-testid="no-picture" className="h-full bg-onair-track" />
          )}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-onair-scanlines" />
          {showYear && (
            <span className={`${MONO} absolute right-1.5 top-1.5 rotate-2 rounded-onair-label bg-onair-paper px-1.5 py-0.5 text-[0.625rem] font-bold tracking-[0.15em] text-onair-paper-ink`}>
              {clip.year}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <span className={`${MONO} text-[0.625rem] tracking-[0.15em] text-onair-ink-4`}>{clip.length}</span>
          <span className={`${MONO} text-[0.625rem] tracking-[0.15em] text-onair-ink-4`}>{clip.views} views</span>
        </div>
      </div>
      <p className="mt-2 line-clamp-2 break-words text-[0.875rem] font-bold leading-snug text-onair-ink-1">{clip.label}</p>
      <p
        data-you={pick.you || undefined}
        className={`mt-1.5 inline-block -rotate-1 rounded-onair-label px-2 py-0.5 font-onair-marker text-[0.9375rem] leading-tight ${pick.you ? 'bg-onair-viewer-deep text-white-body shadow-onair-lit-viewer' : 'bg-onair-paper text-onair-paper-ink'}`}
      >
        {pick.text}
      </p>
    </button>
  );
}
```

- [ ] **Step 6: Run the tests and the contract, and watch them pass**

Run: `CI=true npm test -- --watchAll=false --testPathPattern="shelfPieces|onAirContract"`
Expected: PASS. If the contract fails, the message names the file and line: fix the class, don't exempt it.

- [ ] **Step 7: Commit**

```bash
test "$(git branch --show-current)" = feat/onair-vods && git add src/components/vods && git commit -m "feat(vods): shelves, VHS boxes and clip cassettes"
```

---

### Task 5: The store sign, aisle signs and the clerk

**Files:**
- Create: `src/components/vods/StoreSign.js`
- Create: `src/components/vods/AisleSigns.js`
- Create: `src/components/vods/Clerk.js`
- Test: `src/components/vods/__tests__/storeChrome.test.js`

**Interfaces:**
- Consumes: `StatusLight` from `src/components/onAir/StatusLight.js` (`status="live"`, `children` replaces the label); `Link` from `react-router-dom`; `padCount`.
- Produces:
  - `<StoreSign isLive statusReady>`: the `h1` "Goofer Video". It shows "Open" plus a link to `/` while live, `data-testid="after-hours"` off air, and nothing before `statusReady`.
  - `<AisleSigns aisles={[{ id, label, count }]}>`: `nav` "Aisles" with one link per aisle. A click focuses `#id`.
  - `<Clerk pose="restock"|"asleep" className?>`: an `aria-hidden` img with `data-testid="clerk-{pose}"` that removes itself on load error.

- [ ] **Step 1: Write the failing tests**

Create `src/components/vods/__tests__/storeChrome.test.js`:

```js
import { fireEvent, render, screen } from '@testing-library/react';
import StoreSign from '../StoreSign';
import AisleSigns from '../AisleSigns';
import Clerk from '../Clerk';

test('the sign is the page heading', () => {
  render(<StoreSign isLive={false} statusReady={false} />);
  expect(screen.getByRole('heading', { level: 1, name: 'Goofer Video' })).toBeTruthy();
  expect(screen.getByText("Every stream from the last 60 days, plus the clips chat couldn't let go.")).toBeTruthy();
});

test('the OPEN light waits for the first Twitch poll', () => {
  render(<StoreSign isLive statusReady={false} />);
  expect(screen.queryByText('Open')).toBeNull();
  expect(screen.queryByTestId('after-hours')).toBeNull();
});

test('live: OPEN is lit and links to the stream', () => {
  render(<StoreSign isLive statusReady />);
  expect(screen.getByText('Open')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Goofer is live, watch now' }).getAttribute('href')).toBe('/');
});

test('off air: the sign reads After hours, unlit', () => {
  render(<StoreSign isLive={false} statusReady />);
  expect(screen.getByTestId('after-hours').textContent).toBe('After hours');
  expect(screen.queryByText('Open')).toBeNull();
});

test('aisle signs jump to their aisle and hand it focus', () => {
  render(
    <>
      <AisleSigns
        aisles={[
          { id: 'new-releases', label: 'New releases', count: 27 },
          { id: 'fresh-picks', label: 'Fresh picks', count: 12 },
        ]}
      />
      <h2 id="fresh-picks" tabIndex={-1}>
        Fresh picks
      </h2>
    </>
  );
  const link = screen.getByRole('link', { name: /^Fresh picks\s*012$/ });
  expect(link.getAttribute('href')).toBe('#fresh-picks');
  expect(screen.getByRole('navigation', { name: 'Aisles' })).toBeTruthy();
  fireEvent.click(link);
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Fresh picks' }));
});

test('the clerk is set dressing and bows out when the art is missing', () => {
  render(<Clerk pose="asleep" />);
  const img = screen.getByTestId('clerk-asleep');
  expect(img.getAttribute('aria-hidden')).toBe('true');
  expect(img.getAttribute('alt')).toBe('');
  expect(img.getAttribute('src')).toBe('/gsn/video/clerk-asleep.webp');
  fireEvent.error(img);
  expect(screen.queryByTestId('clerk-asleep')).toBeNull();
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `CI=true npm test -- --watchAll=false --testPathPattern=storeChrome`
Expected: FAIL with `Cannot find module '../StoreSign'`.

- [ ] **Step 3: Write `StoreSign.js`**

```js
import { Link } from 'react-router-dom';
import { FOCUS, MONO } from '../onAir/classes';
import StatusLight from '../onAir/StatusLight';

// The shop sign (the page's h1) and the OPEN light, which is the page's LIVE
// light: the red tally while Goofer is live, an unlit "After hours" otherwise,
// and nothing until App's first Twitch poll lands.
export default function StoreSign({ isLive, statusReady }) {
  return (
    <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className={`${MONO} text-[0.6875rem] font-bold tracking-[0.2em] text-onair-signal`}>CH 03 · Tape rental</p>
        <h1 className="mt-3 inline-block rounded-onair-card bg-gradient-to-b from-onair-surface-1 to-onair-surface-3 px-6 py-4 text-[1.875rem] font-extrabold leading-[0.9] tracking-[-0.04em] text-onair-paper shadow-onair-card sm:text-[3.75rem]">
          Goofer Video
        </h1>
        <p className="mt-4 max-w-md text-[0.9375rem] leading-relaxed text-onair-ink-4">
          Every stream from the last 60 days, plus the clips chat couldn't let go.
        </p>
      </div>
      {statusReady &&
        (isLive ? (
          <div className="flex items-center gap-3">
            <StatusLight status="live">Open</StatusLight>
            <Link to="/" className={`text-[0.9375rem] font-bold text-onair-ink-1 underline-offset-4 hover:underline ${FOCUS}`}>
              Goofer is live, watch now
            </Link>
          </div>
        ) : (
          <span
            data-testid="after-hours"
            className={`${MONO} self-start rounded-onair-tile bg-white/[0.07] px-3 py-1.5 text-[0.6875rem] font-bold tracking-[0.2em] text-onair-ink-4 lg:self-auto`}
          >
            After hours
          </span>
        ))}
    </header>
  );
}
```

- [ ] **Step 4: Write `AisleSigns.js`**

```js
import { FOCUS, MONO } from '../onAir/classes';
import { padCount } from './videoStoreModel';

// Jump links to the store's aisles. Focus moves to the aisle's heading so the
// next Tab carries on from there; the scroll is smooth unless motion is reduced.
export default function AisleSigns({ aisles }) {
  const jump = (event, id) => {
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }
    target.focus({ preventScroll: true });
  };
  return (
    <nav aria-label="Aisles" className="mt-8">
      <ul className="flex flex-wrap gap-2">
        {aisles.map((a) => (
          <li key={a.id}>
            <a
              href={`#${a.id}`}
              onClick={(e) => jump(e, a.id)}
              className={`inline-flex items-baseline gap-2 rounded-onair-control bg-gradient-to-b from-onair-surface-1 to-onair-surface-3 px-4 py-2.5 shadow-onair-card transition-colors hover:from-onair-surface-raised ${FOCUS}`}
            >
              <span className="text-[0.9375rem] font-bold text-onair-ink-1">{a.label}</span>
              <span className={`${MONO} text-[0.6875rem] tracking-[0.2em] text-onair-ink-4`}>{padCount(a.count)}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 5: Write `Clerk.js`**

```js
import { useState } from 'react';

const POSES = {
  restock: '/gsn/video/clerk-restock.webp',
  asleep: '/gsn/video/clerk-asleep.webp',
};

// The night clerk: set dressing for the loading and empty floor (DESIGN.md §7,
// Video store). Always aria-hidden; the text beside it says what is going on.
// Until the art is committed (or if it fails to load) it bows out.
export default function Clerk({ pose, className = '' }) {
  const [missing, setMissing] = useState(false);
  if (missing) return null;
  return (
    <img
      src={POSES[pose]}
      alt=""
      aria-hidden="true"
      width={240}
      height={300}
      onError={() => setMissing(true)}
      data-testid={`clerk-${pose}`}
      className={`rounded-onair-inner shadow-onair-card ${className}`}
    />
  );
}
```

- [ ] **Step 6: Run the tests and the contract, and watch them pass**

Run: `CI=true npm test -- --watchAll=false --testPathPattern="storeChrome|onAirContract"`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
test "$(git branch --show-current)" = feat/onair-vods && git add src/components/vods && git commit -m "feat(vods): store sign, aisle signs and the night clerk"
```

---

### Task 6: The rental counter and the tape timeline

**Files:**
- Create: `src/components/vods/TapeTimeline.js`
- Create: `src/components/vods/RentalCounter.js`
- Test: `src/components/vods/__tests__/RentalCounter.test.js`

**Interfaces:**
- Consumes: tape and clip objects (Task 1); `playerSrc`, `pickedBy`, `formatCounter`.
- Produces:
  - `<TapeTimeline tape at onSeek>`: one `Jump to {at}, {label}` button per mark (`aria-current="true"` on the one at `at`), plus `[data-muted]` bands.
  - `<RentalCounter item at viewerName onSeek(at) onSwitch(id, at) onClose()>`, rendered into `document.body`:
    - a dialog named by its `h2` (`id="rental-title"`);
    - a close button named `Esc, close the counter`;
    - a scrim with `data-testid="counter-scrim"`.
  - It locks the body scroll and focuses the close button on mount, and gives focus back to the opener on unmount.

- [ ] **Step 1: Write the failing tests**

Create `src/components/vods/__tests__/RentalCounter.test.js`:

```js
import { fireEvent, render, screen, within } from '@testing-library/react';
import RentalCounter from '../RentalCounter';
import { buildStore } from '../videoStoreModel';
import { VIDEO_STORE_FIXTURES as F } from '../videoStoreFixtures';

const store = buildStore(F.rich);
const SEP30 = store.byId['2888141530'];
const OCT1 = store.byId['2889109731'];
const SCAT = store.byId['CarefulHyperCasetteKlappa-YJOqxReFjKsu26i4'];
const CLASSIC = store.byId.GeniusSmokyOpossumFrankerZ;

function renderCounter(props = {}) {
  const handlers = { onSeek: jest.fn(), onSwitch: jest.fn(), onClose: jest.fn() };
  const view = render(<RentalCounter item={SEP30} at={null} viewerName={null} {...handlers} {...props} />);
  return { ...view, ...handlers, dialog: () => screen.getByRole('dialog') };
}

test('a VOD plays on the TV with the back of its box beside it', () => {
  const { dialog } = renderCounter();
  expect(screen.getByRole('dialog', { name: 'Win Wednesdays' })).toBeTruthy();
  expect(within(dialog()).getByText('Rental No. 1530')).toBeTruthy();
  expect(dialog().querySelector('iframe').getAttribute('src')).toBe(
    'https://player.twitch.tv/?video=2888141530&parent=localhost&autoplay=true'
  );
  const back = within(within(dialog()).getByRole('region', { name: 'Back of the box' }));
  expect(back.getByText('Wed, Sep 30')).toBeTruthy();
  expect(back.getByText('T-120 · EP')).toBeTruthy();
  expect(back.getByText('Nov 29')).toBeTruthy();
});

test('a seek starts the player at the clip, and its mark reads as current', () => {
  const { dialog } = renderCounter({ at: 14240 });
  expect(dialog().querySelector('iframe').getAttribute('src')).toBe(
    'https://player.twitch.tv/?video=2888141530&parent=localhost&autoplay=true&time=3h57m20s'
  );
  const mark = within(dialog()).getByRole('button', { name: 'Jump to 3:57:20, 5 scat? pants off' });
  expect(mark.getAttribute('aria-current')).toBe('true');
});

test('clip marks and the clip list both seek', () => {
  const { dialog, onSeek } = renderCounter();
  fireEvent.click(within(dialog()).getByRole('button', { name: 'Jump to 4:05:44, That\'s a whole lot of bombs aint it?' }));
  expect(onSeek).toHaveBeenLastCalledWith(14744);
  fireEvent.click(within(dialog()).getByRole('button', { name: /^5 scat\? pants off 3:57:20/ }));
  expect(onSeek).toHaveBeenLastCalledWith(14240);
});

test('muted stretches show as static, and a tape nobody clipped says so', () => {
  const { dialog } = renderCounter({ item: OCT1 });
  expect(dialog().querySelectorAll('[data-muted]')).toHaveLength(1);
  expect(within(dialog()).getByText('No clips on this tape yet')).toBeTruthy();
  expect(within(dialog()).getByText('Nobody clipped this one yet.')).toBeTruthy();
});

test('a clip plays in the clip embed and links to its tape', () => {
  const { dialog, onSwitch } = renderCounter({ item: SCAT });
  expect(screen.getByRole('dialog', { name: '5 scat? pants off' })).toBeTruthy();
  expect(dialog().querySelector('iframe').getAttribute('src')).toBe(
    'https://clips.twitch.tv/embed?clip=CarefulHyperCasetteKlappa-YJOqxReFjKsu26i4&parent=localhost&autoplay=true'
  );
  fireEvent.click(within(dialog()).getByRole('button', { name: 'Found on tape: Win Wednesdays, Sep 30 at 3:57:20' }));
  expect(onSwitch).toHaveBeenCalledWith('2888141530', 14240);
});

test('a classic whose VOD is gone says the original tape is lost', () => {
  const { dialog } = renderCounter({ item: CLASSIC, viewerName: 'moogle_cat' });
  expect(within(dialog()).getByText('Original tape lost.')).toBeTruthy();
  expect(within(dialog()).getByText('Picked by you')).toBeTruthy();
  expect(within(dialog()).getByText('Escape from Tarkov')).toBeTruthy();
});

test('Escape and the scrim close the counter; a click inside does not', () => {
  const { dialog, onClose } = renderCounter();
  fireEvent.click(dialog());
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onClose).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByTestId('counter-scrim'));
  expect(onClose).toHaveBeenCalledTimes(2);
});

test('focus moves in, stays in, and goes back to the box', () => {
  const opener = document.createElement('button');
  document.body.appendChild(opener);
  opener.focus();
  const { dialog, unmount } = renderCounter();
  const focusables = dialog().querySelectorAll('a[href], button:not([disabled]), iframe');
  expect(document.activeElement).toBe(within(dialog()).getByRole('button', { name: 'Esc, close the counter' }));
  focusables[focusables.length - 1].focus();
  fireEvent.keyDown(document, { key: 'Tab' });
  expect(document.activeElement).toBe(focusables[0]);
  fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
  expect(document.activeElement).toBe(focusables[focusables.length - 1]);
  unmount();
  expect(document.activeElement).toBe(opener);
  opener.remove();
});

test('the page behind does not scroll while the counter is open', () => {
  const { unmount } = renderCounter();
  expect(document.body.style.overflow).toBe('hidden');
  unmount();
  expect(document.body.style.overflow).toBe('');
});
```

`Nov 29` is the Sep 30 tape's due date (created 2026-09-30T16:07Z + 60 days). The list row's accessible name is its two spans joined with a space: `5 scat? pants off 3:57:20 · Picked by GooferG`.

- [ ] **Step 2: Run them and watch them fail**

Run: `CI=true npm test -- --watchAll=false --testPathPattern=RentalCounter`
Expected: FAIL with `Cannot find module '../RentalCounter'`.

- [ ] **Step 3: Write `TapeTimeline.js`**

```js
import { FOCUS, MONO } from '../onAir/classes';
import { formatCounter } from './videoStoreModel';

// The tape counter under the TV: a mark at every clip's offset (press one to
// jump there) and static where Twitch muted the audio.
export default function TapeTimeline({ tape, at, onSeek }) {
  return (
    <div>
      <div className={`${MONO} flex justify-between text-[0.6875rem] tracking-[0.2em] text-onair-ink-4`}>
        <span>0:00:00</span>
        <span>{formatCounter(tape.seconds)}</span>
      </div>
      <div className="relative mt-2 h-9 overflow-hidden rounded-onair-tile bg-onair-surface-4 shadow-onair-well">
        {tape.muted.map((m, i) => (
          <div
            key={i}
            data-muted=""
            aria-hidden="true"
            className="absolute inset-y-0 bg-onair-track"
            style={{ left: `${m.start * 100}%`, width: `${m.width * 100}%` }}
          />
        ))}
        <ul aria-label="Clip marks">
          {tape.marks.map((m) => {
            const current = at === m.offset;
            return (
              <li key={m.clip.id}>
                <button
                  type="button"
                  aria-label={`Jump to ${m.at}, ${m.clip.label}`}
                  aria-current={current ? 'true' : undefined}
                  onClick={() => onSeek(m.offset)}
                  className={`absolute inset-y-0 flex w-6 -translate-x-1/2 justify-center ${FOCUS}`}
                  style={{ left: `${m.position * 100}%` }}
                >
                  <span aria-hidden="true" className={`my-1.5 w-[3px] rounded-full ${current ? 'bg-onair-signal' : 'bg-onair-ink-3'}`} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {tape.marks.length === 0 && (
        <p className={`${MONO} mt-2 text-[0.6875rem] tracking-[0.2em] text-onair-ink-5`}>No clips on this tape yet</p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write `RentalCounter.js`**

```js
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FOCUS, MONO } from '../onAir/classes';
import { pickedBy, playerSrc } from './videoStoreModel';
import TapeTimeline from './TapeTimeline';

const FOCUSABLE = 'a[href], button:not([disabled]), iframe';

function Fact({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/[0.06] py-2 last:border-b-0">
      <dt className={`${MONO} text-[0.6875rem] tracking-[0.2em] text-onair-ink-5`}>{label}</dt>
      <dd className={`${MONO} text-right text-[0.75rem] tracking-[0.15em] text-onair-ink-2`}>{children}</dd>
    </div>
  );
}

function WatchOnTwitch({ url }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`mt-5 inline-flex rounded-onair-control bg-white/[0.07] px-3.5 py-2 text-[0.875rem] font-bold text-onair-ink-2 hover:bg-white/[0.12] ${FOCUS}`}
    >
      Watch on Twitch
    </a>
  );
}

function VodBack({ tape, at, viewerName, onSeek }) {
  return (
    <section aria-label="Back of the box" className="min-w-0">
      <h2 id="rental-title" className="break-words font-onair-marker text-[1.5rem] leading-tight text-onair-paper">
        {tape.title}
      </h2>
      <dl className="mt-4">
        <Fact label="Taped">{tape.dateLabel}</Fact>
        <Fact label="Length">{tape.length}</Fact>
        <Fact label="Tape">{tape.stock}</Fact>
        <Fact label="Views">{tape.views}</Fact>
        <Fact label="Due back">{tape.dueDate}</Fact>
      </dl>
      <h3 className={`${MONO} mt-6 text-[0.6875rem] font-bold tracking-[0.2em] text-onair-ink-3`}>Clips on this tape</h3>
      {tape.marks.length === 0 ? (
        <p className="mt-2 text-[0.875rem] text-onair-ink-4">Nobody clipped this one yet.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {tape.marks.map((m) => {
            const pick = pickedBy(m.clip, viewerName);
            const current = at === m.offset;
            return (
              <li key={m.clip.id}>
                <button
                  type="button"
                  onClick={() => onSeek(m.offset)}
                  aria-current={current ? 'true' : undefined}
                  className={`w-full rounded-onair-tile px-3 py-2 text-left transition-colors hover:bg-white/[0.07] ${current ? 'bg-white/[0.07]' : ''} ${FOCUS}`}
                >
                  <span className="block text-[0.875rem] font-bold text-onair-ink-1">{m.clip.label}</span>{' '}
                  <span className={`${MONO} mt-0.5 block text-[0.625rem] tracking-[0.15em] ${pick.you ? 'text-onair-viewer-light' : 'text-onair-ink-4'}`}>
                    {m.at} · {pick.text}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <WatchOnTwitch url={tape.url} />
    </section>
  );
}

function ClipBack({ clip, viewerName, onSwitch }) {
  const pick = pickedBy(clip, viewerName);
  const found = clip.foundOn;
  return (
    <section aria-label="Back of the box" className="min-w-0">
      <h2 id="rental-title" className="break-words font-onair-marker text-[1.5rem] leading-tight text-onair-paper">
        {clip.label}
      </h2>
      <p className={`mt-2 text-[0.9375rem] font-bold ${pick.you ? 'text-onair-viewer-light' : 'text-onair-ink-3'}`}>{pick.text}</p>
      <dl className="mt-4">
        <Fact label="Game">{clip.game}</Fact>
        <Fact label="Clipped">{clip.dateLabel}</Fact>
        <Fact label="Length">{clip.length}</Fact>
        <Fact label="Views">{clip.views}</Fact>
      </dl>
      {found ? (
        <button
          type="button"
          onClick={() => onSwitch(found.id, found.offset)}
          className={`mt-5 w-full rounded-onair-control bg-white/[0.07] px-3.5 py-2.5 text-left text-[0.875rem] font-bold text-onair-ink-1 hover:bg-white/[0.12] ${FOCUS}`}
        >
          {`Found on tape: ${found.title}, ${found.dateLabel}${found.at ? ` at ${found.at}` : ''}`}
        </button>
      ) : (
        <p className={`${MONO} mt-5 text-[0.6875rem] tracking-[0.2em] text-onair-ink-5`}>Original tape lost.</p>
      )}
      <WatchOnTwitch url={clip.url} />
    </section>
  );
}

// The rental counter: the tape already playing on the TV, the back of its box
// beside it (below it on phones). Owns Escape, the focus trap, the scroll lock
// and handing focus back to whatever opened it; VideoStoreFront owns which
// tape and where it starts.
export default function RentalCounter({ item, at, viewerName, onSeek, onSwitch, onClose }) {
  const panelRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    const opener = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      if (opener && opener !== document.body && document.contains(opener)) opener.focus();
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const list = panelRef.current?.querySelectorAll(FOCUSABLE);
      if (!list || list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isVod = item.kind === 'vod';
  const src = playerSrc(item, isVod ? at : null, window.location.hostname);

  return createPortal(
    <div
      data-testid="counter-scrim"
      onClick={onClose}
      className="fixed inset-0 z-[100] overflow-y-auto bg-onair-surface-4/90 p-4 backdrop-blur-sm sm:p-6"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rental-title"
        onClick={(e) => e.stopPropagation()}
        className="relative mx-auto w-full max-w-6xl rounded-onair-card bg-gradient-to-b from-onair-surface-1 to-onair-surface-3 shadow-onair-card motion-safe:animate-modal-in"
      >
        <div className="flex items-center gap-3 px-5 pt-4">
          <span className={`${MONO} text-[0.6875rem] font-bold tracking-[0.2em] text-onair-signal`}>Goofer Video</span>
          <span className={`${MONO} text-[0.6875rem] tracking-[0.2em] text-onair-ink-4`}>
            {isVod ? `Rental No. ${item.no}` : 'Clip'}
          </span>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Esc, close the counter"
            className={`${MONO} ml-auto rounded-onair-control bg-white/[0.07] px-3 py-1.5 text-[0.6875rem] font-bold tracking-[0.2em] text-onair-ink-2 hover:bg-white/[0.12] ${FOCUS}`}
          >
            Esc
          </button>
        </div>
        <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0">
            <div className="relative aspect-video overflow-hidden rounded-onair-inner bg-onair-surface-4 shadow-onair-screen">
              <iframe
                key={src}
                src={src}
                title={`${isVod ? item.title : item.label} on the Twitch player`}
                className="absolute inset-0 h-full w-full"
                allowFullScreen
                allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              />
            </div>
            {isVod && (
              <div className="mt-4">
                <TapeTimeline tape={item} at={at} onSeek={onSeek} />
              </div>
            )}
          </div>
          {isVod ? (
            <VodBack tape={item} at={at} viewerName={viewerName} onSeek={onSeek} />
          ) : (
            <ClipBack clip={item} viewerName={viewerName} onSwitch={onSwitch} />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
```

- [ ] **Step 5: Run the tests and the contract, and watch them pass**

Run: `CI=true npm test -- --watchAll=false --testPathPattern="RentalCounter|onAirContract"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
test "$(git branch --show-current)" = feat/onair-vods && git add src/components/vods && git commit -m "feat(vods): rental counter with a clip-marked tape timeline"
```

---

### Task 7: The store floor

**Files:**
- Create: `src/components/vods/VideoStoreFront.js`
- Test: `src/components/vods/__tests__/VideoStoreFront.test.js`

**Interfaces:**
- Consumes: everything from Tasks 1 and 4–6; `useNow(intervalMs, enabled)` from `src/components/hunts/useNow.js`.
- Produces: `<VideoStoreFront videos topClips recentClips loading isLive statusReady viewerName now? timeZone? initialTapeId? onTapeChange?>`.
  - `onTapeChange(id)` fires when a viewer opens or switches tapes.
  - `onTapeChange(null)` fires on close, and when the open tape leaves the data.
  - A deep link opens without calling `onTapeChange` (the URL already has it).

- [ ] **Step 1: Write the failing tests**

Create `src/components/vods/__tests__/VideoStoreFront.test.js`:

```js
import { fireEvent, render, screen, within } from '@testing-library/react';
import VideoStoreFront from '../VideoStoreFront';
import { VIDEO_STORE_FIXTURES as F } from '../videoStoreFixtures';

const renderStore = (key, props = {}) => render(<VideoStoreFront {...F[key]} {...props} />);
const aisle = (name) => within(screen.getByRole('region', { name }));
const SEP30_BOX = /^Win Wednesdays, Wed, Sep 30/;

test('New releases shelves the tapes by week, newest first', () => {
  renderStore('rich');
  expect(aisle('New releases').getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
    'This week',
    'Last week',
    'Sep 14–20',
    'Sep 7–13',
    'Aug 31–Sep 6',
    'Aug 24–30',
    'Aug 17–23',
  ]);
  const thisWeek = within(screen.getByRole('list', { name: 'This week' })).getAllByRole('button');
  expect(thisWeek.map((b) => b.getAttribute('aria-label'))).toEqual([
    'Win Wednesdays, Thu, Oct 1, 4:37:20, New release',
    'Win Wednesdays, Wed, Sep 30, 5:02:30, 2 clips inside',
    'Monday Hunts and Twists, Mon, Sep 28, 2:45:00, 5 clips inside',
  ]);
  expect(screen.queryByText(/communityhunts\.gg/)).toBeNull();
});

test('aisle signs carry the counts and hand focus to the aisle', () => {
  renderStore('rich');
  const nav = within(screen.getByRole('navigation', { name: 'Aisles' }));
  expect(nav.getAllByRole('link').map((a) => a.textContent)).toEqual(['New releases027', 'Fresh picks012', 'Cult classics016']);
  fireEvent.click(nav.getByRole('link', { name: /^Cult classics/ }));
  expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: 'Cult classics' }));
});

test('an aisle with nothing in it is left out, and so is its sign', () => {
  const { unmount } = renderStore('fresh');
  expect(screen.queryByRole('region', { name: 'Cult classics' })).toBeNull();
  expect(screen.queryByRole('link', { name: /^Cult classics/ })).toBeNull();
  unmount();
  renderStore('classics');
  expect(screen.queryByRole('region', { name: 'Fresh picks' })).toBeNull();
  expect(screen.queryByRole('link', { name: /^Fresh picks/ })).toBeNull();
});

test('Cult classics files clips behind a divider per game, most watched first', () => {
  renderStore('rich');
  expect(aisle('Cult classics').getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
    'Escape from Tarkov',
    'League of Legends',
    'Nioh',
    'Misc.',
    'Slots',
    'iRacing',
    'PUBG: BATTLEGROUNDS',
    'World of Warcraft',
    'Fortnite',
  ]);
  expect(
    within(screen.getByRole('list', { name: 'Escape from Tarkov' }))
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label'))
  ).toEqual(['What just happened, Picked by Moogle_Cat, 0:39, © 2018', 'ghost?, Picked by GooferG, 0:08, © 2018']);
});

test('Fresh picks credit the clipper, and you in purple', () => {
  renderStore('rich', { viewerName: 'LARRYMENTA' });
  const fresh = within(screen.getByRole('list', { name: 'Last 60 days' }));
  expect(fresh.getAllByRole('button')).toHaveLength(12);
  expect(fresh.getByRole('button', { name: '500x hit, Picked by you, 0:30' })).toBeTruthy();
  expect(fresh.getByText('Picked by you').getAttribute('data-you')).toBe('true');
  expect(fresh.getByRole('button', { name: 'No label · at 2:30:39, Picked by GooferG, 0:30' })).toBeTruthy();
});

test('stickers: due back as the archive runs out', () => {
  renderStore('expiring');
  expect(screen.getAllByText('Due back today')).toHaveLength(2);
  expect(screen.getByText('Due back Oct 17')).toBeTruthy();
  expect(screen.getByText('New release')).toBeTruthy();
});

test('tapes without a picture show the test card', () => {
  renderStore('nothumb');
  expect(screen.getAllByTestId('no-picture')).toHaveLength(2);
});

test('the OPEN sign is the live light', () => {
  const { unmount } = renderStore('live');
  expect(screen.getByText('Open')).toBeTruthy();
  unmount();
  renderStore('rich');
  expect(screen.getByTestId('after-hours')).toBeTruthy();
});

test('loading: blank sleeves and the clerk restocking', () => {
  renderStore('loading');
  expect(screen.getByRole('status').textContent).toBe('Restocking the shelves…');
  expect(screen.getByTestId('clerk-restock')).toBeTruthy();
  expect(screen.queryByRole('navigation', { name: 'Aisles' })).toBeNull();
  expect(screen.queryByText(/clips on the floor/)).toBeNull();
});

test('an empty store: the clerk asleep and a plain message', () => {
  renderStore('empty');
  expect(screen.getByRole('heading', { level: 2, name: 'Shelves are empty.' })).toBeTruthy();
  expect(screen.getByText('Check back after the next stream.')).toBeTruthy();
  expect(screen.getByTestId('clerk-asleep')).toBeTruthy();
});

test('the sign-off counts the floor', () => {
  renderStore('rich');
  expect(screen.getByText('Be kind, rewind.')).toBeTruthy();
  expect(screen.getByText('027 tapes · 028 clips on the floor')).toBeTruthy();
});

test('a box opens the counter and reports the tape', () => {
  const onTapeChange = jest.fn();
  renderStore('rich', { onTapeChange });
  fireEvent.click(screen.getByRole('button', { name: SEP30_BOX }));
  const dialog = screen.getByRole('dialog', { name: 'Win Wednesdays' });
  expect(dialog.querySelector('iframe').getAttribute('src')).toBe(
    'https://player.twitch.tv/?video=2888141530&parent=localhost&autoplay=true'
  );
  expect(onTapeChange).toHaveBeenCalledWith('2888141530');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Jump to 3:57:20, 5 scat? pants off' }));
  expect(dialog.querySelector('iframe').getAttribute('src')).toBe(
    'https://player.twitch.tv/?video=2888141530&parent=localhost&autoplay=true&time=3h57m20s'
  );
});

test('Escape closes the counter, clears the tape and returns focus to the box', () => {
  const onTapeChange = jest.fn();
  renderStore('rich', { onTapeChange });
  const box = screen.getByRole('button', { name: /^Monday Hunts and Twists, Mon, Sep 28/ });
  box.focus();
  fireEvent.click(box);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(box);
  expect(onTapeChange).toHaveBeenLastCalledWith(null);
});

test('switching tapes keeps one counter and focus goes home', () => {
  const onTapeChange = jest.fn();
  renderStore('rich', { onTapeChange });
  const cassette = screen.getByRole('button', { name: '5 scat? pants off, Picked by GooferG, 0:30' });
  cassette.focus();
  fireEvent.click(cassette);
  fireEvent.click(screen.getByRole('button', { name: 'Found on tape: Win Wednesdays, Sep 30 at 3:57:20' }));
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  const dialog = screen.getByRole('dialog', { name: 'Win Wednesdays' });
  expect(dialog.querySelector('iframe').getAttribute('src')).toBe(
    'https://player.twitch.tv/?video=2888141530&parent=localhost&autoplay=true&time=3h57m20s'
  );
  expect(onTapeChange).toHaveBeenLastCalledWith('2888141530');
  expect(document.body.style.overflow).toBe('hidden');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(document.activeElement).toBe(cassette);
  expect(document.body.style.overflow).toBe('');
});

test('?tape= opens the counter on load; an unknown id is ignored', () => {
  const { unmount } = renderStore('rich', { initialTapeId: '2886426857' });
  expect(screen.getByRole('dialog', { name: 'Monday Hunts and Twists' })).toBeTruthy();
  unmount();
  renderStore('rich', { initialTapeId: 'nope' });
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('a deep link waits for clips that load late', () => {
  const id = 'FamousBlindingAlmondOSkomodo-jvd8g9Ok0a4EkTUz';
  const { rerender } = render(<VideoStoreFront {...F.rich} recentClips={[]} initialTapeId={id} />);
  expect(screen.queryByRole('dialog')).toBeNull();
  rerender(<VideoStoreFront {...F.rich} initialTapeId={id} />);
  expect(screen.getByRole('dialog', { name: 'goofer voice' })).toBeTruthy();
});

test('a poll refresh keeps the tape playing', () => {
  const { rerender } = render(<VideoStoreFront {...F.rich} />);
  fireEvent.click(screen.getByRole('button', { name: SEP30_BOX }));
  const frame = screen.getByRole('dialog').querySelector('iframe');
  rerender(<VideoStoreFront {...F.rich} videos={F.rich.videos.map((v) => ({ ...v }))} topClips={[...F.rich.topClips]} />);
  expect(screen.getByRole('dialog').querySelector('iframe')).toBe(frame);
});

test('a tape that leaves the archive closes the counter', () => {
  const onTapeChange = jest.fn();
  const { rerender } = render(<VideoStoreFront {...F.rich} onTapeChange={onTapeChange} />);
  fireEvent.click(screen.getByRole('button', { name: SEP30_BOX }));
  rerender(
    <VideoStoreFront {...F.rich} videos={F.rich.videos.filter((v) => v.id !== '2888141530')} onTapeChange={onTapeChange} />
  );
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.body.style.overflow).toBe('');
  expect(onTapeChange).toHaveBeenLastCalledWith(null);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `CI=true npm test -- --watchAll=false --testPathPattern=VideoStoreFront`
Expected: FAIL with `Cannot find module '../VideoStoreFront'`.

- [ ] **Step 3: Write `VideoStoreFront.js`**

```js
import { useCallback, useEffect, useMemo, useState } from 'react';
import { MONO } from '../onAir/classes';
import useNow from '../hunts/useNow';
import { buildStore, padCount } from './videoStoreModel';
import StoreSign from './StoreSign';
import AisleSigns from './AisleSigns';
import { Aisle, Shelf } from './Shelf';
import VhsBox from './VhsBox';
import ClipCassette from './ClipCassette';
import RentalCounter from './RentalCounter';
import Clerk from './Clerk';

const NONE = [];
const BLANKS = [0, 1, 2, 3];
const noop = () => {};

function LoadingFloor() {
  return (
    <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-end">
      <div>
        <p role="status" className={`${MONO} text-[0.75rem] font-bold tracking-[0.2em] text-onair-ink-3`}>
          Restocking the shelves…
        </p>
        <ul aria-hidden="true" className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {BLANKS.map((i) => (
            <li key={i} className="aspect-[2/3] rounded-onair-case bg-gradient-to-b from-onair-surface-1 to-onair-surface-4 shadow-onair-card" />
          ))}
        </ul>
      </div>
      <Clerk pose="restock" className="hidden w-60 lg:block" />
    </div>
  );
}

function EmptyFloor() {
  return (
    <div className="mt-10 flex flex-col items-start gap-6 sm:flex-row sm:items-center">
      <Clerk pose="asleep" className="w-48" />
      <div>
        <h2 className="text-[1.5rem] font-extrabold tracking-[-0.02em] text-onair-ink-1">Shelves are empty.</h2>
        <p className="mt-1 text-[0.9375rem] text-onair-ink-4">Check back after the next stream.</p>
      </div>
    </div>
  );
}

// Goofer Video: the /vods floor, composed from raw Helix data (VodsPage wires
// App's poll and useRecentClips; fixtures feed it in dev and tests). Owns which
// tape is on the rental counter. `now` and `timeZone` are for fixtures and
// tests; live, the clock ticks each minute and the zone is the viewer's.
export default function VideoStoreFront({
  videos = NONE,
  topClips = NONE,
  recentClips = NONE,
  loading = false,
  isLive = false,
  statusReady = false,
  viewerName = null,
  now: frozenNow = null,
  timeZone,
  initialTapeId = null,
  onTapeChange = noop,
}) {
  const ticking = useNow(60 * 1000, frozenNow == null);
  const now = frozenNow ?? ticking;
  const store = useMemo(
    () => buildStore({ videos, topClips, recentClips, now, timeZone }),
    [videos, topClips, recentClips, now, timeZone]
  );

  // A ?tape= link waits until its tape is in the data (recent clips land a few
  // seconds after App's poll); any tape the viewer opens cancels it.
  const [pending, setPending] = useState(initialTapeId);
  const [rental, setRental] = useState(null);

  useEffect(() => {
    if (pending && store.byId[pending]) {
      setRental({ id: pending, at: null });
      setPending(null);
    }
  }, [pending, store]);

  // The tape on the counter left the data (it expired between polls): close.
  useEffect(() => {
    if (rental && !store.byId[rental.id]) {
      setRental(null);
      onTapeChange(null);
    }
  }, [rental, store, onTapeChange]);

  const open = (id) => {
    setPending(null);
    setRental({ id, at: null });
    onTapeChange(id);
  };
  const seek = (at) => setRental((r) => (r ? { ...r, at } : r));
  const switchTo = (id, at) => {
    setRental({ id, at });
    onTapeChange(id);
  };
  const close = useCallback(() => {
    setRental(null);
    onTapeChange(null);
  }, [onTapeChange]);

  const { shelves, fresh, aisles, counts } = store;
  const item = rental ? store.byId[rental.id] : null;
  const empty = !loading && counts.tapes === 0 && counts.clips === 0;
  const signs = [
    counts.tapes > 0 && { id: 'new-releases', label: 'New releases', count: counts.tapes },
    counts.fresh > 0 && { id: 'fresh-picks', label: 'Fresh picks', count: counts.fresh },
    counts.classics > 0 && { id: 'cult-classics', label: 'Cult classics', count: counts.classics },
  ].filter(Boolean);

  return (
    <div className="font-onair text-onair-ink-1">
      <StoreSign isLive={isLive} statusReady={statusReady} />

      {loading && <LoadingFloor />}
      {empty && <EmptyFloor />}

      {!loading && !empty && (
        <>
          <AisleSigns aisles={signs} />
          {counts.tapes > 0 && (
            <Aisle id="new-releases" title="New releases" count={counts.tapes}>
              {shelves.map((shelf) => (
                <Shelf key={shelf.key} label={shelf.label}>
                  {shelf.tapes.map((tape) => (
                    <VhsBox key={tape.id} tape={tape} onOpen={open} />
                  ))}
                </Shelf>
              ))}
            </Aisle>
          )}
          {counts.fresh > 0 && (
            <Aisle id="fresh-picks" title="Fresh picks" count={counts.fresh}>
              <Shelf label="Last 60 days" size="clip">
                {fresh.map((clip) => (
                  <ClipCassette key={clip.id} clip={clip} viewerName={viewerName} onOpen={open} />
                ))}
              </Shelf>
            </Aisle>
          )}
          {counts.classics > 0 && (
            <Aisle id="cult-classics" title="Cult classics" count={counts.classics}>
              {aisles.map((a) => (
                <Shelf key={a.key} label={a.game} divider size="clip">
                  {a.clips.map((clip) => (
                    <ClipCassette key={clip.id} clip={clip} viewerName={viewerName} showYear onOpen={open} />
                  ))}
                </Shelf>
              ))}
            </Aisle>
          )}
        </>
      )}

      <footer className="mt-16">
        <p className="font-onair-marker text-[1.25rem] text-onair-ink-2">Be kind, rewind.</p>
        {!loading && !empty && (
          <p className={`${MONO} mt-2 text-[0.6875rem] tracking-[0.2em] text-onair-ink-5`}>
            {padCount(counts.tapes)} tapes · {padCount(counts.clips)} clips on the floor
          </p>
        )}
      </footer>

      {item && (
        <RentalCounter item={item} at={rental.at} viewerName={viewerName} onSeek={seek} onSwitch={switchTo} onClose={close} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `CI=true npm test -- --watchAll=false --testPathPattern="vods|onAirContract"`
Expected: PASS for every vods suite and the contract.

If `aisle signs carry the counts` fails on the textContent strings, check that `AisleSigns` renders the label span directly followed by the count span with no space between them.

- [ ] **Step 5: Commit**

```bash
test "$(git branch --show-current)" = feat/onair-vods && git add src/components/vods && git commit -m "feat(vods): Goofer Video floor with week shelves and the counter"
```

---

### Task 8: Wire the page, drop the old card

**Files:**
- Modify: `src/pages/VodsPage.js` (full rewrite)
- Modify: `src/App.js:271`
- Delete: `src/components/VodCard.js`
- Modify: `scripts/share/pages.js` (the `vods` description)
- Test: `src/pages/__tests__/VodsPage.test.js`

**Interfaces:**
- Consumes:
  - `VideoStoreFront` (Task 7) and `useRecentClips` (Task 3).
  - `useTwitchAuth()` from `src/contexts/TwitchAuthContext.js` (`twitchUser.displayName`).
  - App's `videos`, `clips`, `loading`, `isLive` and `statusReady` state.
- Produces: `/vods` on the new floor, with `?tape=` kept in the address bar (`replaceState`) and dev `?fixture=<key>`.

- [ ] **Step 1: Write the failing page tests**

Create `src/pages/__tests__/VodsPage.test.js`:

```js
import { fireEvent, render, screen } from '@testing-library/react';
import VodsPage from '../VodsPage';
import { LIVE_TOP_CLIPS, LIVE_VIDEOS } from '../../components/vods/videoStoreFixtures';

jest.mock('../../contexts/TwitchAuthContext', () => ({
  useTwitchAuth: () => ({ twitchUser: { displayName: 'larrymenta' } }),
}));
jest.mock('../../components/vods/useRecentClips', () => ({
  __esModule: true,
  default: () => [],
}));

const renderPage = () =>
  render(<VodsPage videos={LIVE_VIDEOS} clips={LIVE_TOP_CLIPS} loading={false} isLive={false} statusReady />);

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

test("renders App's tapes on the Goofer Video floor, with the viewer's own clips", () => {
  window.history.replaceState(null, '', '/vods');
  renderPage();
  expect(screen.getByRole('heading', { level: 1, name: 'Goofer Video' })).toBeTruthy();
  expect(screen.getAllByRole('button', { name: /^Win Wednesdays/ })).toHaveLength(2);
  expect(screen.getByText('Picked by you')).toBeTruthy();
});

test('opening a tape writes ?tape=, closing clears it', () => {
  window.history.replaceState(null, '', '/vods');
  renderPage();
  fireEvent.click(screen.getAllByRole('button', { name: /^Win Wednesdays/ })[0]);
  expect(new URLSearchParams(window.location.search).get('tape')).toBe('2889109731');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(window.location.search).toBe('');
});

test('a ?tape= link opens the counter', () => {
  window.history.replaceState(null, '', '/vods?tape=2888141530');
  renderPage();
  expect(screen.getByRole('dialog', { name: 'Win Wednesdays' })).toBeTruthy();
});

test('?fixture= renders a fixture outside production', () => {
  window.history.replaceState(null, '', '/vods?fixture=empty');
  renderPage();
  expect(screen.getByRole('heading', { level: 2, name: 'Shelves are empty.' })).toBeTruthy();
});
```

The first two tests use the real clock, so week labels move over time. They only rely on the newest-first order and on `500x hit` being in the top clips, which stay true.

- [ ] **Step 2: Run them and watch them fail**

Run: `CI=true npm test -- --watchAll=false --testPathPattern=VodsPage`
Expected: FAIL. The old page has no `Goofer Video` heading.

- [ ] **Step 3: Rewrite `src/pages/VodsPage.js`**

```js
import { useState } from 'react';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import VideoStoreFront from '../components/vods/VideoStoreFront';
import useRecentClips from '../components/vods/useRecentClips';

// /vods: Goofer Video. Wires App's Twitch poll, the recent clips and the
// signed-in viewer into VideoStoreFront.
let readFixture = () => null;
if (process.env.NODE_ENV !== 'production') {
  // Dev-only: /vods?fixture=rich|live|fresh|classics|expiring|noclips|nothumb|empty|loading
  // renders the store from videoStoreFixtures. Webpack drops this branch, and
  // the fixture module with it, from production builds.
  readFixture = () => {
    const key = new URLSearchParams(window.location.search).get('fixture');
    if (!key) return null;
    return require('../components/vods/videoStoreFixtures').VIDEO_STORE_FIXTURES[key] || null;
  };
}

const readTapeParam = () => new URLSearchParams(window.location.search).get('tape');

// The counter keeps ?tape= in the address bar so a tape can go in chat.
// replaceState: changing tapes adds no history entries.
function writeTapeParam(id) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set('tape', id);
  else url.searchParams.delete('tape');
  window.history.replaceState(window.history.state, '', url);
}

function LiveStore({ videos, clips, loading, isLive, statusReady }) {
  const { twitchUser } = useTwitchAuth();
  const recentClips = useRecentClips();
  const [initialTapeId] = useState(readTapeParam);
  return (
    <VideoStoreFront
      videos={videos}
      topClips={clips}
      recentClips={recentClips}
      loading={loading}
      isLive={isLive}
      statusReady={statusReady}
      viewerName={(twitchUser && twitchUser.displayName) || null}
      initialTapeId={initialTapeId}
      onTapeChange={writeTapeParam}
    />
  );
}

export default function VodsPage({ videos = [], clips = [], loading = false, isLive = false, statusReady = false }) {
  const [fixture] = useState(readFixture);
  return (
    <div className="relative min-h-screen px-4 pb-20 pt-24 sm:px-6">
      <div className="mx-auto max-w-6xl 2xl:max-w-7xl">
        {fixture ? (
          <VideoStoreFront {...fixture} />
        ) : (
          <LiveStore videos={videos} clips={clips} loading={loading} isLive={isLive} statusReady={statusReady} />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Pass the live state from App**

In `src/App.js`, replace line 271:

```js
              <VodsPage videos={videos} clips={clips} loading={loading} isLive={isLive} statusReady={statusReady} />
```

- [ ] **Step 5: Delete the old card and update the share copy**

```bash
git rm src/components/VodCard.js
```

In `scripts/share/pages.js`, set the `vods` entry's description:

```js
    description: 'Goofer Video. Every stream from the last 60 days on the shelf, and the clips chat kept.',
```

- [ ] **Step 6: Run the page tests and the share test, and watch them pass**

Run: `CI=true npm test -- --watchAll=false --testPathPattern="VodsPage|sharePages"`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
test "$(git branch --show-current)" = feat/onair-vods && git add src/pages/VodsPage.js src/pages/__tests__/VodsPage.test.js src/App.js scripts/share/pages.js && git commit -m "feat(vods): /vods opens Goofer Video, with ?tape= deep links"
```

(`git rm` already staged the VodCard deletion; this commit includes it.)

---

### Task 9: Docs, the full suite and a look in the browser

**Files:**
- Modify: `DESIGN.md` §7 (intro, Tokens, Type, new "Video store" subsection)
- Modify: `CLAUDE.md` (Gotchas bullet, Design Context line)

- [ ] **Step 1: Update DESIGN.md §7**

In the §7 intro sentence, after ``the schedule (`/schedule`, the Goofer Guide)``, add ``, the video store (`/vods`, Goofer Video)``.

In **Tokens**, add one bullet after the Surfaces bullet:

```markdown
- **Paper:** `onair-paper` (label stock) and `onair-paper-ink` (the ink on it, about 13:1). Stickers use `onair-signal` and `onair-loss` as stock with paper ink. Goofer Video only.
```

In the **Radii** bullet, change `tile 10.` to `tile 10, case 6 and label 3 (Goofer Video's tape box and its labels).`

In the **Type** bullet, after the `font-onair-mono` clause, add: ``; `font-onair-marker` (Permanent Marker 400) for Goofer Video's handwritten labels and index cards only``.

Add this subsection after **Schedule guide** and before **Named Rules**:

```markdown
### Video store

- **A late-night rental store.** `/vods` is Goofer Video: a lightbox sign (the `h1`), aisle signs that jump to New releases, Fresh picks and Cult classics, then the shelves. It has no bezel or monitor, so it doesn't repeat the Gamba hub or the guide.
- **Shelves.** VODs are portrait clamshells on one shelf per week (Monday to Sunday, the viewer's calendar). The sleeve holds the 16:9 thumbnail in a photo window, the cleaned title on a marker label, the catalogue number and weekday on the spine, and the tape stock (`T-120 · EP`) and length in mono. Clips are landscape camcorder cases with a "Picked by" index card; Cult classics sit behind one paper divider per game. Below `md` a shelf scrolls sideways; from `md` it wraps, with the lip under every row.
- **Stickers.** At most two per box: New release, Due back (within 7 days of Twitch's 60-day expiry), N clips inside. Paper stock with paper ink. Nothing on the floor glows.
- **The OPEN light** is the page's LIVE light: the red `StatusLight` while live, an unlit "After hours" off air, nothing before the first Twitch poll.
- **The rental counter.** One click plays a tape in an overlay with the back of its box beside it. The tape timeline marks each clip at its offset, and a mark seeks the VOD. A clip's back links to its tape while the VOD is in the archive. Focus is trapped and goes back to the box.
- **The marker.** `font-onair-marker` is for labels, index cards and the sign-off: 15px or larger, never for data. Dates, times, lengths and counts stay mono.
- **The clerk is set dressing.** The night clerk (`public/gsn/video/`) appears only in the loading and empty states, always `aria-hidden`, and bows out when its art is missing.
```

In **Contract Test**, nothing changes: the new rules are self-describing in the test file.

- [ ] **Step 2: Update CLAUDE.md**

In **Gotchas**, add after the Schedule bullet:

```markdown
- Vods (`/vods`) is Goofer Video, a late-night rental store (DESIGN.md §7). `VodsPage` wires App's `videos` (Helix `first=100`, the whole archive) and `clips` (all-time top 20) plus `useRecentClips` (the last 60 days, fetched once per visit, not in App's poll) into the pure `src/components/vods/VideoStoreFront.js` (dev: `?fixture=rich|live|fresh|classics|expiring|noclips|nothumb|empty|loading`; `?tape=<id>` opens the rental counter). Rules live in `videoStoreModel.js`: titles drop the 💥 tail, shelves are Monday-to-Sunday weeks on the viewer's calendar, `ARCHIVE_DAYS = 60` drives Due back and the Fresh picks / Cult classics split. Helix `/videos` has no `game_id`, so VODs have no category. Permanent Marker (`font-onair-marker`) is for those labels only (contract test).
```

In **Design Context**, change ``the nav, `/gamba/hunts`, `/store` and `/schedule` use the On Air language`` to ``the nav, `/gamba/hunts`, `/store`, `/schedule` and `/vods` use the On Air language``.

- [ ] **Step 3: Run the whole suite**

Run: `CI=true npm test -- --watchAll=false`
Expected: every suite passes. Record the suite and test counts for the PR body.

- [ ] **Step 4: Build**

Run: `CI=true npm run build`
Expected: `Compiled successfully` (with `CI=true`, CRA fails on any ESLint warning), then the share pages are written. Fix any warning at its source.

- [ ] **Step 5: Look at it**

Run `npm start` in the background and open `http://localhost:3000/vods` at 390px and at 1280px wide. Check each item:

- [ ] Live data: 27 tapes on week shelves. Fresh picks fills in a moment after the first paint (recent clips). Clip thumbnails show; this was the old bug.
- [ ] `?fixture=rich`: the Oct 1 tape's counter shows the static band at about a third of the timeline. The Sep 28 tape shows 5 marks.
- [ ] `?fixture=expiring`, `nothumb`, `empty`, `loading`, `live`, `fresh`, `classics`, `noclips` each render as their test describes.
- [ ] Phone: shelves swipe sideways with snap, nothing scrolls the page horizontally, and the counter stacks TV → timeline → back of box.
- [ ] Keyboard: Tab reaches the aisle signs, boxes and cassettes in order with a visible ring. Enter opens the counter, Tab stays inside, and Escape returns to the box.
- [ ] Reduced motion (DevTools rendering panel): no hover lift and no counter entrance.
- [ ] Labels with long unbroken titles (`!giveaway if we print! $ARS2500 tip for best slot call`) wrap inside the box.

Fix what you find, re-run Step 3, and commit the fixes with the docs.

- [ ] **Step 6: Commit**

```bash
test "$(git branch --show-current)" = feat/onair-vods && git add DESIGN.md CLAUDE.md && git commit -m "docs(vods): Goofer Video in DESIGN.md and CLAUDE.md"
```

---

### Task 10: The night clerk art (needs the owner and ComfyUI)

**Files:**
- Create: `public/gsn/video/clerk-restock.webp`, `public/gsn/video/clerk-asleep.webp`
- Modify: `scripts/gsn-art/README.md` (a Goofer Video style line and two "What shipped" rows)

This task needs ComfyUI Desktop running on the owner's machine (`:8000`) and the owner picking the candidates. If it isn't running, ask the owner to open it. If they'd rather not now, skip this task: the page already works without the art (Clerk bows out), and it lands as a follow-up commit.

- [ ] **Step 1: Check ComfyUI**

Run: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/system_stats`
Expected: `200`. Anything else: ask the owner to start ComfyUI Desktop, or skip the task.

- [ ] **Step 2: Render restocking candidates**

Set the scratch folder (your session scratchpad, never the repo) and the style string for this set:

```bash
SCRATCH="<your scratchpad directory>/clerk"
mkdir -p "$SCRATCH"
VIDEO_STYLE="1990s late-night video rental store interior, shot on a camcorder, buzzing fluorescent tube lights, deep shadows, wire racks of blank unlabeled black VHS boxes, a counter with a beige CRT television and a cash register, set lit in dark teal and plum with warm practical light, light VHS grain, slight chromatic bleed, analog video softness, no text, no letters, no logos, no signs, no watermark"
```

Shell variables don't persist between tool calls, so run each render loop in the same command as these lines. Render seeds 1 to 4:

```bash
for s in 1 2 3 4; do node scripts/gsn-art/render.mjs scripts/gsn-art/workflows/zimage-turbo.json "$SCRATCH/clerk-restock-$s.png" --prompt "waist-up portrait of an invented late-night video rental store clerk, a person in their twenties with a deadpan, sleepy expression and messy hair, wearing a faded staff vest over a band t-shirt, carrying a tall stack of blank black VHS tapes against their chest, standing between the shelves, $VIDEO_STYLE" --width 960 --height 1200 --seed $s; done
```

Show the four images to the owner and ask which one ships. Reject any image with lettering on boxes, signs or the vest, or with a CRT showing text (README "Lessons").

- [ ] **Step 3: Edit the picked restock pose into the asleep pose**

```bash
for s in 1 2 3; do node scripts/gsn-art/render.mjs scripts/gsn-art/workflows/qwen-edit-2509.json "$SCRATCH/clerk-asleep-$s.png" --image "$SCRATCH/clerk-restock-<picked>.png" --prompt "Keep the same person, outfit, store, framing and lighting. They are now asleep behind the store counter, head resting on folded arms next to a beige CRT television and a cash register, the stack of tapes set down beside them." --seed $s; done
```

Show these to the owner and ask which one ships.

- [ ] **Step 4: Convert to the size budget**

```bash
mkdir -p public/gsn/video
python scripts/gsn-art/to_webp.py "$SCRATCH/clerk-restock-<picked>.png" public/gsn/video/clerk-restock.webp 480 600 60
python scripts/gsn-art/to_webp.py "$SCRATCH/clerk-asleep-<picked>.png" public/gsn/video/clerk-asleep.webp 480 600 60
```

Expected: both lines end without `(OVER BUDGET)`.

- [ ] **Step 5: Record it in the README**

In `scripts/gsn-art/README.md`, add the `VIDEO_STYLE` string under the GSN style, introduced with `Goofer Video (/vods) swaps the set for a rental store:`. Then add two rows to "What shipped": `video/clerk-restock.webp` (Z-Image 960×1200, the prompt above, the picked seed, 480×600) and `video/clerk-asleep.webp` (the Qwen edit above, the picked seed, 480×600).

- [ ] **Step 6: Check it on the page and commit**

Open `/vods?fixture=empty` and `/vods?fixture=loading` (desktop width for the restock pose).

```bash
test "$(git branch --show-current)" = feat/onair-vods && git add public/gsn/video scripts/gsn-art/README.md && git commit -m "feat(vods): the night clerk art"
```

---

## After the tasks

- Push and open the PR (`feat/onair-vods` → `main`, no Claude attribution). The body lists:
  - the deviations above;
  - the test counts;
  - follow-ups: the `vods.jpg` share re-shoot after deploy (`npm run share:shots -- --only=vods`), the clerk art if Task 10 was skipped, and caching the Twitch app token in App's poll.
- The owner merges. Then reset local `main` to `origin/main`.
