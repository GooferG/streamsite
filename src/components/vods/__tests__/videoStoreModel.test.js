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
  promoSpots,
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
  expect(t.muted).toEqual([{ start: 5400 / 16640, width: 600 / 16640, from: '1:30:00', to: '1:40:00' }]);
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
  expect(rich.fresh.filter((c) => c.unlabeled)).toHaveLength(5);
  expect(rich.byId.GeniusSmokyOpossumFrankerZ.unlabeled).toBe(false);
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

test('byId has no prototype, so ids like constructor find nothing', () => {
  const { byId } = buildStore(F.rich);
  expect(byId.constructor).toBeUndefined();
  expect(Object.getPrototypeOf(byId)).toBeNull();
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

test('covers come at the size asked for', () => {
  const vod = { thumbnail_url: 'https://x/thumb0-%{width}x%{height}.jpg' };
  expect(coverUrl(vod, 1280, 720)).toBe('https://x/thumb0-1280x720.jpg');
  expect(rich.byId['2889109731'].wideCover).toMatch(/thumb0-1280x720\.jpg$/);
});

const LIVE_STREAM = {
  title: `Win Wednesdays 💥 Games and Gamba?  ${TAIL}`,
  game_name: 'Slots',
  viewer_count: 42,
  thumbnail_url: 'https://static-cdn.jtvnw.net/previews-ttv/live_user_gooferg-{width}x{height}.jpg',
};

test('promoSpots: the newest tape, the three most-watched named picks, the top classic', () => {
  const spots = promoSpots(rich);
  expect(spots.map((s) => s.kind)).toEqual(['vod', 'clip', 'clip', 'clip', 'clip']);
  expect(spots[0]).toMatchObject({
    key: 'vod-2889109731',
    kicker: 'Now on tape',
    title: 'Win Wednesdays',
    facts: ['Thu, Oct 1', '4:37:20', 'T-120 · EP'],
  });
  expect(spots[0].cover).toMatch(/thumb0-1280x720\.jpg$/);
  expect(spots[0].coverSet).toMatch(/thumb0-440x248\.jpg 440w, .*thumb0-1280x720\.jpg 1280w$/);
  expect(spots[1].coverSet).toBeNull();
  expect(spots[0].item.id).toBe('2889109731');
  expect(spots.slice(1, 4).map((s) => [s.kicker, s.title])).toEqual([
    ['Fresh pick', 'Leprecher max ARS'],
    ['Fresh pick', '5 scat? pants off'],
    ['Fresh pick', '500x hit'],
  ]);
  expect(spots[1].facts).toEqual(['1:00', '45 views']);
  expect(spots[4]).toMatchObject({ kicker: 'Staff pick · 2018', title: 'What just happened' });
  expect(spots.some((s) => s.title.startsWith('No label'))).toBe(false);
});

test('promoSpots: while live, the stream leads the reel', () => {
  const spots = promoSpots(rich, { isLive: true, stream: LIVE_STREAM });
  expect(spots[0]).toMatchObject({
    key: 'live',
    kind: 'live',
    kicker: 'On the air now',
    title: 'Win Wednesdays',
    facts: ['Slots', '42 watching'],
    item: null,
    cover: 'https://static-cdn.jtvnw.net/previews-ttv/live_user_gooferg-1280x720.jpg',
  });
  expect(spots).toHaveLength(6);
  expect(promoSpots(rich, { isLive: true, stream: null })[0]).toMatchObject({ kind: 'live', title: 'Goofer is live', cover: null, facts: [] });
});

test('promoSpots: an empty store has no reel unless Goofer is live', () => {
  const empty = buildStore({ now: FIXTURE_NOW, timeZone: AZ });
  expect(promoSpots(empty)).toEqual([]);
  expect(promoSpots(empty, { isLive: true, stream: LIVE_STREAM }).map((s) => s.kind)).toEqual(['live']);
  expect(promoSpots(buildStore(F.classics)).map((s) => s.kicker)).toEqual(['Now on tape', 'Staff pick · 2018']);
});

test('promoSpots: while live, the broadcast still recording is not a "Now on tape" spot', () => {
  const recording = {
    id: '2890000000',
    stream_id: 'live-stream',
    title: `Win Wednesdays 💥 Games and Gamba?  ${TAIL}`,
    created_at: '2026-10-04T17:00:00Z',
    duration: '2h0m0s',
    view_count: 3,
    thumbnail_url: '',
    url: 'https://www.twitch.tv/videos/2890000000',
    muted_segments: null,
  };
  const store = buildStore({ ...F.rich, videos: [recording, ...F.rich.videos] });
  const spots = promoSpots(store, { isLive: true, stream: { ...LIVE_STREAM, id: 'live-stream' } });
  expect(spots.map((s) => s.key).slice(0, 2)).toEqual(['live', 'vod-2889109731']);
  expect(promoSpots(store).find((s) => s.kind === 'vod').key).toBe('vod-2890000000');
});

test('promoSpots: the staff pick is the most-watched classic with a name', () => {
  const unnamed = {
    id: 'unnamed-classic',
    created_at: '2018-02-01T00:00:00Z',
    duration: 30,
    view_count: 999,
    title: `Old stream 💥 tail`,
    creator_name: 'GooferG',
    game_name: 'Escape from Tarkov',
    video_id: '',
    vod_offset: null,
    thumbnail_url: 'https://x/t.jpg',
    url: 'https://x',
  };
  const store = buildStore({ ...F.rich, topClips: [unnamed, ...F.rich.topClips] });
  expect(promoSpots(store).find((s) => s.kicker.startsWith('Staff pick')).title).toBe('What just happened');
});
