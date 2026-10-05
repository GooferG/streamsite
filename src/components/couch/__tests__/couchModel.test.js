import { COUCH_FIXTURES as F } from '../couchFixtures';
import { DOOR_ORDER, buildCouch, isNewTape, steamCovers, withCommercial } from '../couchModel';

const door = (couch, id) => couch.doors.find((d) => d.id === id);
const NOW = F.offair.input.now;

test('off air: TV, guide, tapes, laptop and games say the right things', () => {
  const c = buildCouch(F.offair.input);
  expect(c.tv.state).toBe('offair');
  expect(c.doors.map((d) => d.id)).toEqual(['tv', 'laptop', 'tapes', 'guide', 'games', 'remote', 'photo']);
  expect(door(c, 'tv').sentence).toBe('Off the air. Back tomorrow at 11:00 AM for Bonus Hunt Time!');
  expect(door(c, 'tv').href).toBe('/vods');
  expect(door(c, 'guide').sentence).toBe('Next up: Bonus Hunt Time! tomorrow at 11:00 AM, in 1 day 1 hour.');
  expect(door(c, 'tapes').sentence).toBe('You missed Win Wednesdays. Thursday night, 4 hours 37.');
  expect(door(c, 'tapes').sticker).toBe('new');
  expect(door(c, 'laptop').sentence).toBe('Last hunt paid $412 on $600. Best hit: 1,240x on Sugar Rush 1000.');
  expect(door(c, 'laptop').href).toBe('/gamba');
  expect(door(c, 'games').sentence).toBe('Lately: Path of Exile 2, 14 hours in two weeks. Last streamed: Slots.');
  expect(door(c, 'tv').label).toBe('TV: Off the air. Back tomorrow at 11:00 AM for Bonus Hunt Time! Opens Vods.');
  expect(c.tv.cards.map((k) => k.text)).toEqual([
    door(c, 'tv').sentence,
    door(c, 'tapes').sentence,
    door(c, 'laptop').sentence,
  ]);
  expect(c.laptop.mode).toBe('idle');
  expect(c.laptop.resetsIn).toBe(3 * 86400000 + 4 * 3600000);
});

test('live: the TV goes to the stream and lights up', () => {
  const c = buildCouch(F.live.input);
  const tv = door(c, 'tv');
  expect(c.tv.state).toBe('live');
  expect(tv.href).toBe('https://twitch.tv/GooferG');
  expect(tv.lit).toBe(true);
  expect(tv.label).toBe("TV: Goofer's live right now. Lean in to watch. Opens the stream.");
  expect(c.tv.preview).toMatch(/live_user_gooferg-640x360\.jpg\?p=\d+$/);
  expect(c.tv.viewers).toBe(214);
  expect(c.tv.cards).toEqual([]);
});

test('an open giveaway sticks the note on the TV, second in order', () => {
  const c = buildCouch(F.giveaway.input);
  expect(c.doors[1].id).toBe('note');
  expect(c.doors[1].sentence).toBe("Giveaway's open. Type !goof in chat for a $25.00 bonus buy.");
  expect(c.doors[1].href).toBe('/giveaway');
  const closed = buildCouch({ ...F.giveaway.input, giveaway: { ...F.giveaway.input.giveaway, status: 'rolling' } });
  expect(closed.doors.find((d) => d.id === 'note')).toBeUndefined();
});

test('screens cut to static; the photo, the TV guide and the games close an iris', () => {
  const c = buildCouch(F.giveaway.input);
  expect(Object.fromEntries(c.doors.map((d) => [d.id, d.cut]))).toEqual({
    tv: 'static',
    note: 'static',
    laptop: 'static',
    tapes: 'static',
    guide: 'iris',
    games: 'iris',
    remote: 'static',
    photo: 'iris',
  });
});

test('a live hunt turns the laptop on and points it at Hunts', () => {
  const c = buildCouch(F.hunt.input);
  expect(c.laptop).toMatchObject({ mode: 'hunt', opened: 14, total: 23, back: 412 });
  expect(door(c, 'laptop').sentence).toBe('A hunt is running. 14 of 23 bonuses opened, $412 back so far.');
  expect(door(c, 'laptop').href).toBe('/gamba/hunts');
  expect(door(c, 'laptop').lit).toBe(true);
});

test('an open round', () => {
  const c = buildCouch(F.round.input);
  expect(c.laptop).toMatchObject({ mode: 'open', guesses: 37 });
  expect(door(c, 'laptop').sentence).toBe('Predictions are open. 37 guesses in so far. Guess the payout before it locks.');
});

test('a late show', () => {
  const c = buildCouch(F.late.input);
  expect(door(c, 'tv').sentence).toBe('Sunday Slots should be on by now. Give him a minute.');
  expect(door(c, 'guide').sentence).toBe('Next up: Sunday Slots, due now.');
});

test('loading never claims off air', () => {
  const c = buildCouch(F.loading.input);
  expect(c.tv.state).toBe('waiting');
  expect(door(c, 'tv').sentence).toBe("Checking whether Goofer's on.");
  expect(door(c, 'guide').sentence).toBe('Checking the guide.');
  expect(door(c, 'tapes').sentence).toBe('No tapes yet. Check back after the next stream.');
  expect(door(c, 'games').sentence).toBe('His game library and the wheel.');
});

test('empty', () => {
  const c = buildCouch(F.empty.input);
  expect(door(c, 'tv').sentence).toBe('Off the air. Nothing on the books yet.');
  expect(door(c, 'guide').sentence).toBe('Nothing on the books yet. The guide has the week.');
  expect(door(c, 'laptop').sentence).toBe('The gamba tools live here.');
  expect(door(c, 'tapes').sticker).toBeNull();
});

test('isNewTape', () => {
  const vod = { created_at: '2026-10-02T03:00:00Z' };
  expect(isNewTape(vod, Date.parse('2026-09-30T00:00:00Z'), NOW)).toBe(true);
  expect(isNewTape(vod, Date.parse('2026-10-03T00:00:00Z'), NOW)).toBe(false);
  expect(isNewTape(vod, null, NOW)).toBe(true);
  expect(isNewTape({ created_at: '2026-09-20T00:00:00Z' }, null, NOW)).toBe(false);
  expect(isNewTape(vod, undefined, NOW)).toBe(false);
  expect(isNewTape(null, null, NOW)).toBe(false);
});

test('steamCovers keeps three with portrait art', () => {
  const covers = steamCovers(F.offair.input.games);
  expect(covers).toHaveLength(3);
  expect(covers[0]).toEqual({
    appid: 2694490,
    name: 'Path of Exile 2',
    hours: 14,
    cover: 'https://cdn.cloudflare.steamstatic.com/steam/apps/2694490/library_600x900.jpg',
  });
  expect(steamCovers(null)).toEqual([]);
});

test('every fixture keeps the voice rules and the door order', () => {
  for (const { input } of Object.values(F)) {
    const c = buildCouch(input);
    const ids = c.doors.map((d) => d.id);
    expect(ids).toEqual(DOOR_ORDER.filter((id) => ids.includes(id)));
    for (const d of c.doors) {
      expect(d.label).not.toMatch(/—|, not /i);
    }
  }
});

test('a commercial on the TV points the TV door at its channel, off air only', () => {
  const c = buildCouch(F.offair.input);
  const tv = door(withCommercial(c, 'video'), 'tv');
  expect(tv.href).toBe('/vods');
  expect(tv.teaser).toBe('Goofer Video commercial');
  expect(tv.label).toBe('TV: A Goofer Video commercial. Opens Vods.');
  expect(door(withCommercial(c, 'guide'), 'tv').label).toBe('TV: A Goofer Guide commercial. Opens Schedule.');
  // The other doors are untouched; no commercial, or live, is the couch as built.
  expect(withCommercial(c, 'gsn').doors.filter((d) => d.id !== 'tv')).toEqual(c.doors.filter((d) => d.id !== 'tv'));
  expect(withCommercial(c, null)).toBe(c);
  const live = buildCouch(F.live.input);
  expect(withCommercial(live, 'gsn')).toBe(live);
});
