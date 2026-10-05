import { COUCH_FIXTURES as F } from '../couchFixtures';
import {
  DOOR_ORDER,
  buildCouch,
  isFinishedHunt,
  isNewTape,
  laptopState,
  latestFinished,
  steamCovers,
  withCommercial,
  withLaptopWindow,
} from '../couchModel';

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
  expect(c.laptop).toEqual({
    mode: 'hunt',
    opened: 14,
    total: 23,
    back: 412,
    cost: 600,
    currency: null,
    // The first unopened bonus is up next; the last three opened, newest first.
    next: { slot: 'Densho', bet: 0.25 },
    recent: [
      { slot: 'Sugar Rush 1000', multi: 96 },
      { slot: 'Chaos Crew 3', multi: 84 },
      { slot: 'Rip City', multi: 252 },
    ],
  });
  expect(door(c, 'laptop').sentence).toBe('A hunt is running. 14 of 23 bonuses opened, $412 back so far.');
  expect(door(c, 'laptop').href).toBe('/gamba/hunts');
  expect(door(c, 'laptop').lit).toBe(true);
});

test('a hunt in Canadian dollars keeps its currency and five-digit money', () => {
  expect(buildCouch(F.huntcad.input).laptop).toMatchObject({
    mode: 'hunt',
    back: 10300,
    cost: 12500,
    currency: 'CAD',
    next: { slot: 'Densho', bet: 6.25 },
  });
});

test('an open round', () => {
  const c = buildCouch(F.round.input);
  expect(c.laptop).toEqual({ mode: 'open', guesses: 37 });
  const locked = buildCouch({ ...F.round.input, round: { ...F.round.input.round, status: 'locked' } });
  expect(locked.laptop).toEqual({ mode: 'locked', guesses: 37 });
  expect(door(locked, 'laptop').href).toBe('/gamba/hunts');
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

describe('the laptop desktop', () => {
  const ids = (laptop) => laptop.windows.map((w) => w.id);
  const win = (laptop, id) => laptop.windows.find((w) => w.id === id);
  const RESETS = 3 * 86400000 + 4 * 3600000;
  const withRecent = (recent) => ({ ...F.offair.input, hunts: { ...F.offair.input.hunts, recent } });

  test('off air it lines up the board, the last hunt, the history and the screensaver', () => {
    const laptop = laptopState(F.offair.input);
    expect(laptop.mode).toBe('idle');
    expect(ids(laptop)).toEqual(['leaderboard', 'recap', 'history', 'screensaver']);
    expect(laptop.windows.map((w) => w.href)).toEqual(['/gamba/leaderboard', '/gamba/hunts', '/gamba/hunts', '/gamba']);
  });

  test('the board window carries the top five as given, handles never re-masked', () => {
    const board = win(laptopState(F.offair.input), 'leaderboard');
    expect(board.title).toBe('BEAN board');
    expect(board.rows).toEqual(F.offair.input.leaders);
    expect(board.resetsIn).toBe(RESETS);
    const six = [...F.offair.input.leaders, { rank: 6, handle: 'Xx***x', wagered: 5 }];
    expect(win(laptopState({ ...F.offair.input, leaders: six }), 'leaderboard').rows).toHaveLength(5);
  });

  test('the recap: the date on your calendar, cost to total, the result and the top three hits', () => {
    const recap = win(laptopState(F.offair.input), 'recap');
    // Ended 06:40 UTC on Oct 2, which is the evening of Oct 1 in Arizona.
    expect(recap.title).toBe('Hunt · Oct 1');
    expect(recap).toMatchObject({ start: 600, won: 412, result: -188, currency: null });
    expect(recap.best).toEqual({ multi: 1240, slot: 'Sugar Rush 1000' });
    expect(recap.top).toEqual([
      { slot: 'Sugar Rush 1000', bet: 0.2, multi: 1240 },
      { slot: 'Wanted Dead or a Wild', bet: 0.2, multi: 310 },
      { slot: 'Gates of Olympus 1000', bet: 0.4, multi: 96 },
    ]);
    const lastHunt = { ...F.offair.input.lastHunt, endedAt: null, startedAt: null };
    expect(win(laptopState({ ...F.offair.input, lastHunt }), 'recap').title).toBe('Last hunt');
  });

  test('the history: the last five finished hunts, oldest on the left, against 100%', () => {
    const history = win(laptopState(F.offair.input), 'history');
    expect(history.title).toBe('Last 5 hunts');
    expect(history.bars.map((b) => [b.id, b.pct, b.up])).toEqual([
      ['h5', 102, true],
      ['h6', 197, true],
      ['h7', 74, false],
      ['h8', 141, true],
      ['h9', 69, false],
    ]);
    expect(history.latest).toBe(69);
    expect(history.up).toBe(false);
    // The tallest bar fills the chart; the dashed line sits at 100%.
    expect(history.bars[1].height).toBe(1);
    expect(history.line).toBeCloseTo(100 / 196.8, 5);
    expect(history.bars.every((b) => b.height > 0 && b.height <= 1)).toBe(true);
  });

  test('a window without data sits out', () => {
    expect(ids(laptopState({ ...F.offair.input, leaders: [] }))).toEqual(['recap', 'history', 'screensaver']);
    const recent = F.offair.input.hunts.recent;
    expect(ids(laptopState(withRecent(recent.slice(0, 1))))).toEqual(['leaderboard', 'recap', 'screensaver']);
    // A live hunt in the list, or one without a cost, never counts as finished.
    const live = { id: 'h10', status: 'live', totalWon: 50, pot: 600 };
    const noPot = { id: 'h3', status: 'finished', totalWon: 50, pot: 0 };
    expect(ids(laptopState(withRecent([live, recent[0], noPot])))).not.toContain('history');
    expect(ids(laptopState({ ...F.offair.input, lastHunt: null }))).toEqual(['leaderboard', 'history', 'screensaver']);
    expect(ids(laptopState(F.empty.input))).toEqual(['screensaver']);
    expect(ids(laptopState(F.loading.input))).toEqual(['screensaver']);
  });

  test('each window says where its door goes', () => {
    const c = buildCouch(F.offair.input);
    const laptop = (id) => door(withLaptopWindow(c, id), 'laptop');
    expect(laptop('leaderboard')).toMatchObject({
      href: '/gamba/leaderboard',
      teaser: 'BEAN board',
      label: 'Laptop: Go***r leads the BEAN board with $1,284,310 wagered. It resets in 3 days 4 hours. Opens Leaderboard.',
    });
    expect(laptop('recap')).toMatchObject({
      href: '/gamba/hunts',
      teaser: 'Best hit 1,240x',
      label: 'Laptop: Last hunt paid $412 on $600. Best hit: 1,240x on Sugar Rush 1000. Opens Hunts.',
    });
    expect(laptop('history')).toMatchObject({
      href: '/gamba/hunts',
      teaser: 'Last 5 hunts',
      label: 'Laptop: 3 of the last 5 hunts paid back their cost. The latest paid back 69%. Opens Hunts.',
    });
    expect(laptop('screensaver')).toMatchObject({
      href: '/gamba',
      label: 'Laptop: The leaderboard resets in 3 days 4 hours. Opens Gamba.',
    });
    // The other doors are untouched; no window, an unknown one, or a live laptop is the couch as built.
    expect(withLaptopWindow(c, 'history').doors.filter((d) => d.id !== 'laptop')).toEqual(c.doors.filter((d) => d.id !== 'laptop'));
    expect(withLaptopWindow(c, null)).toBe(c);
    expect(withLaptopWindow(c, 'nope')).toBe(c);
    const hunt = buildCouch(F.hunt.input);
    expect(withLaptopWindow(hunt, 'leaderboard')).toBe(hunt);
  });

  test('a bust still shows: a 0% hunt is a red sliver, never an empty slot', () => {
    const bust = { id: 'b0', status: 'archived', totalWon: 0, pot: 600 };
    const history = win(laptopState(withRecent([bust, ...F.offair.input.hunts.recent])), 'history');
    const bar = history.bars[history.bars.length - 1];
    expect(bar).toMatchObject({ id: 'b0', pct: 0, up: false });
    expect(bar.height).toBe(0.03);
    expect(history.latest).toBe(0);
  });

  test('only finished hunts count, for the history and for the last hunt', () => {
    const recent = F.offair.input.hunts.recent;
    // The statuses in use: live, and finished, archived (communityhunts) or ended.
    for (const status of ['live', 'draft', 'pending', 'scheduled', 'upcoming', 'setup', 'created', 'Draft']) {
      const early = { id: `x-${status}`, status, totalWon: 0, pot: 600 };
      expect(isFinishedHunt(early)).toBe(false);
      expect(latestFinished({ recent: [early, ...recent] }).id).toBe('h9');
      expect(win(laptopState(withRecent([early, ...recent])), 'history').bars.map((b) => b.id)).not.toContain(early.id);
    }
    for (const status of ['finished', 'archived', 'ended', undefined]) {
      expect(isFinishedHunt({ id: 'y', status, totalWon: 1, pot: 2 })).toBe(true);
    }
    // When it's knowable that nothing was opened, it didn't happen yet.
    expect(isFinishedHunt({ id: 'z', status: 'archived', bonuses: [{ bet: 1, win: null }] })).toBe(false);
    expect(isFinishedHunt({ id: 'z', status: 'archived', bonusCount: 0 })).toBe(false);
    expect(isFinishedHunt({ id: 'z', status: 'archived', bonusCount: null })).toBe(true);
    expect(isFinishedHunt(null)).toBe(false);
  });

  test('every laptop door names the page it opens', () => {
    const label = (c) => door(c, 'laptop').label;
    expect(label(buildCouch(F.offair.input))).toMatch(/ Opens Gamba\.$/);
    expect(label(buildCouch(F.hunt.input))).toBe('Laptop: A hunt is running. 14 of 23 bonuses opened, $412 back so far. Opens Hunts.');
    expect(label(buildCouch(F.round.input))).toMatch(/ Opens Hunts\.$/);
    const c = buildCouch(F.offair.input);
    expect(c.laptop.windows.map((w) => [w.href, w.destination])).toEqual([
      ['/gamba/leaderboard', 'Leaderboard'],
      ['/gamba/hunts', 'Hunts'],
      ['/gamba/hunts', 'Hunts'],
      ['/gamba', 'Gamba'],
    ]);
  });

  test('a commercial on the TV and a window on the laptop at once: neither door clobbers the other', () => {
    const c = buildCouch(F.offair.input);
    for (const both of [withLaptopWindow(withCommercial(c, 'gsn'), 'recap'), withCommercial(withLaptopWindow(c, 'recap'), 'gsn')]) {
      expect(door(both, 'tv')).toMatchObject({ href: '/store', label: 'TV: A Goofer Shopping Network commercial. Opens Store.' });
      expect(door(both, 'laptop')).toMatchObject({ href: '/gamba/hunts', teaser: 'Best hit 1,240x' });
      expect(door(both, 'laptop').label).toMatch(/ Opens Hunts\.$/);
      expect(both.doors.filter((d) => d.id !== 'tv' && d.id !== 'laptop')).toEqual(c.doors.filter((d) => d.id !== 'tv' && d.id !== 'laptop'));
    }
  });

  test('every window keeps the voice rules', () => {
    const c = buildCouch(F.offair.input);
    for (const w of c.laptop.windows) {
      expect(door(withLaptopWindow(c, w.id), 'laptop').label).not.toMatch(/—|, not /i);
    }
    const recent = [F.offair.input.hunts.recent[0], { id: 'x', status: 'finished', totalWon: 1, pot: 600 }];
    expect(win(laptopState(withRecent(recent)), 'history').sentence).toBe(
      'None of the last 2 hunts paid back their cost. The latest paid back 69%.'
    );
  });
});
