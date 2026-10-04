import { formatResets, guideRows, huntFeature, leaderboardFacts, pickFeatured, progressModel } from '../guide';

const LIVE_HUNT = {
  id: 'h9',
  status: 'live',
  huntType: 'community',
  currency: null,
  pot: 2421.82,
  bonusCount: 4,
  totalWon: null,
  bonuses: [
    { slot: 'Wanted', bet: 1, win: 212, multiplier: 212 },
    { slot: 'Sugar', bet: 1, win: 40, multiplier: 40 },
    { slot: 'Gates', bet: 1, win: null, multiplier: null },
    { slot: 'Dog', bet: 1, win: null, multiplier: null },
  ],
};
const ROUND = (status, over = {}) => ({
  id: 'r1',
  title: 'Thursday comm hunt',
  status,
  acceptPredictions: true,
  entryCount: 6,
  source: 'communityhunts',
  bonusHuntSnapshot: { huntId: 'h9', totalCost: 2421.82, currency: null, bonusCount: 4 },
  ...over,
});
const HUNTS = (over = {}) => ({ live: null, recent: [], loading: false, error: null, ...over });
const BOARD = (over = {}) => ({
  players: [
    { maskedUsername: 'ab***z', wagered: 41203.4, prize: 2000 },
    { maskedUsername: 'kr***9', wagered: 34333.1, prize: 1000 },
  ],
  prizePool: 5000,
  periodLabel: 'OCTOBER',
  endsAt: 1,
  isLoading: false,
  error: null,
  ...over,
});

describe('pickFeatured', () => {
  test('a live hunt takes the monitor', () => {
    expect(pickFeatured({ hunts: HUNTS({ live: LIVE_HUNT }), round: null })).toBe('hunts');
  });
  test('an open or locked round takes it before the hunt starts', () => {
    expect(pickFeatured({ hunts: HUNTS(), round: ROUND('open') })).toBe('hunts');
    expect(pickFeatured({ hunts: HUNTS(), round: ROUND('locked') })).toBe('hunts');
  });
  test('settled, paused or still-loading rounds leave it to the leaderboard', () => {
    expect(pickFeatured({ hunts: HUNTS(), round: ROUND('settled') })).toBe('leaderboard');
    expect(pickFeatured({ hunts: HUNTS(), round: ROUND('open', { acceptPredictions: false }) })).toBe('leaderboard');
    expect(pickFeatured({ hunts: HUNTS(), round: undefined })).toBe('leaderboard');
  });
  test('a loading hunts read never selects Hunts', () => {
    expect(pickFeatured({ hunts: HUNTS({ live: LIVE_HUNT, loading: true }), round: null })).toBe('leaderboard');
  });
});

describe('huntFeature', () => {
  test('live hunt with an open round', () => {
    const f = huntFeature({ hunts: HUNTS({ live: LIVE_HUNT }), round: ROUND('open') });
    expect(f).toMatchObject({ kind: 'live', mode: 'open', guessCount: 6 });
    expect(f.stats.wonSoFar).toBe(252);
    expect(f.stats.openedCount).toBe(2);
  });
  test('live hunt after its round settled: no round, offair mode', () => {
    const f = huntFeature({ hunts: HUNTS({ live: LIVE_HUNT }), round: ROUND('settled') });
    expect(f).toMatchObject({ kind: 'live', mode: 'offair', round: null, guessCount: 0, prize: null });
  });
  test('live hunt with a round open for a different hunt: the live hunt keeps its own figures', () => {
    const other = ROUND('open', { bonusHuntSnapshot: { huntId: 'h3', totalCost: 999, currency: 'ARS', bonusCount: 12 } });
    const f = huntFeature({ hunts: HUNTS({ live: LIVE_HUNT, recent: [{ id: 'h3', pot: 999, currency: 'ARS' }] }), round: other });
    expect(f).toMatchObject({ kind: 'live', mode: 'open', guessCount: 6, currency: null });
    expect(f.round).toBe(other);
    expect(f.stats.startCost).toBe(2421.82);
    expect(f.stats.bonusCount).toBe(4);
  });
  test('live hunt with a round that snapshots it: cost and currency from the round', () => {
    const own = ROUND('open', { bonusHuntSnapshot: { huntId: 'h9', totalCost: 2500, currency: 'ARS', bonusCount: 4 } });
    const f = huntFeature({ hunts: HUNTS({ live: LIVE_HUNT }), round: own });
    expect(f.stats.startCost).toBe(2500);
    expect(f.currency).toBe('ARS');
  });
  test('open round before the hunt starts', () => {
    const f = huntFeature({ hunts: HUNTS(), round: ROUND('open') });
    expect(f).toMatchObject({ kind: 'prehunt', mode: 'open' });
    expect(f.stats.startCost).toBe(2421.82);
  });
});

test('progressModel: notches up to 60 bonuses, then a bar; null without bonuses', () => {
  expect(progressModel({ bonuses: [1, 2, 3], openedCount: 1, bonusCount: 3 })).toEqual({ opened: 1, total: 3, style: 'notches' });
  expect(progressModel({ bonuses: new Array(61).fill(1), openedCount: 10, bonusCount: 61 }).style).toBe('bar');
  expect(progressModel({ bonuses: [], openedCount: 0, bonusCount: 0 })).toBeNull();
});

describe('leaderboardFacts', () => {
  test('leader, lead, prize and the top five standings in whole dollars', () => {
    expect(leaderboardFacts(BOARD())).toEqual({
      pool: '$5,000',
      period: 'OCTOBER',
      leader: { name: 'ab***z', wagered: '$41,203', prize: '$2,000' },
      lead: '$6,870',
      standings: ['1 ab***z $41,203', '2 kr***9 $34,333'],
    });
  });
  test('a new month with no players or pool', () => {
    expect(leaderboardFacts(BOARD({ players: [], prizePool: 0 }))).toEqual({ pool: null, period: 'OCTOBER', leader: null, lead: null, standings: [] });
  });
  test('loading, and a failed read with nothing to show', () => {
    expect(leaderboardFacts(BOARD({ isLoading: true, players: [] }))).toEqual({ loading: true });
    expect(leaderboardFacts(BOARD({ error: 'HTTP 502', players: [] }))).toEqual({ noSignal: true });
  });
});

test('formatResets', () => {
  expect(formatResets({ days: 27, hours: 4, minutes: 0, seconds: 0, isOver: false })).toBe('Resets in 27d 04h');
  expect(formatResets({ isOver: true })).toBe('Resetting now');
  expect(formatResets({ unknown: true })).toBeNull();
});

describe('guideRows', () => {
  const rows = (args) => Object.fromEntries(guideRows(args).map((r) => [r.id, r]));
  const base = { hunts: HUNTS(), leaderboard: BOARD(), resets: 'Resets in 27d 04h' };

  test('tool order, channels and paths', () => {
    expect(guideRows({ ...base, featured: 'leaderboard', feature: null }).map((r) => [r.id, r.channel, r.path])).toEqual([
      ['leaderboard', 'CH 01', '/gamba/leaderboard'],
      ['hunts', 'CH 02', '/gamba/hunts'],
      ['bonus-battle', 'CH 03', '/gamba/bonus-battle'],
      ['wheel', 'CH 04', '/gamba/wheel'],
    ]);
  });

  test('live hunt: the Hunts row is lit with the LIVE light; the leaderboard row adds the pool', () => {
    const hunts = HUNTS({ live: LIVE_HUNT });
    const feature = huntFeature({ hunts, round: ROUND('open') });
    const r = rows({ ...base, hunts, featured: 'hunts', feature });
    expect(r.hunts).toMatchObject({ lit: true, live: true, now: 'Community hunt · 2/4 opened · $252.00 won', next: 'Predictions open · 6 in' });
    expect(r.leaderboard).toMatchObject({ lit: false, now: '$5,000 pool · ab***z leads · $41,203', next: 'Resets in 27d 04h' });
  });

  test('locked round, and a live hunt without a round', () => {
    const hunts = HUNTS({ live: LIVE_HUNT });
    expect(rows({ ...base, hunts, featured: 'hunts', feature: huntFeature({ hunts, round: ROUND('locked') }) }).hunts.next).toBe('Entries closed · 6 guesses');
    expect(rows({ ...base, hunts, featured: 'hunts', feature: huntFeature({ hunts, round: null }) }).hunts.next).toBe('No round open');
  });

  test('pre-hunt, even with the hunts poll failing: lit with the round', () => {
    const hunts = HUNTS({ error: 'HTTP 502' });
    const feature = huntFeature({ hunts, round: ROUND('open') });
    expect(rows({ ...base, hunts, featured: 'hunts', feature }).hunts).toMatchObject({
      lit: true,
      live: false,
      now: 'Thursday comm hunt · Predictions open',
      next: '6 guesses in',
    });
  });

  test('off air: last result in signal or loss; nothing lit', () => {
    const win = { id: 'a', pot: 100, totalWon: 150, currency: null };
    const loss = { id: 'b', pot: 100, totalWon: 40, currency: null };
    expect(rows({ ...base, hunts: HUNTS({ recent: [win] }), featured: 'leaderboard', feature: null }).hunts).toMatchObject({
      lit: false,
      now: 'Last hunt +$50.00',
      tone: 'signal',
      next: 'No round open',
    });
    expect(rows({ ...base, hunts: HUNTS({ recent: [loss] }), featured: 'leaderboard', feature: null }).hunts).toMatchObject({ now: 'Last hunt −$60.00', tone: 'loss' });
  });

  test('off air with the round read failing: the next column says No signal', () => {
    const win = { id: 'a', pot: 100, totalWon: 150, currency: null };
    expect(rows({ ...base, hunts: HUNTS({ recent: [win] }), roundError: 'x', featured: 'leaderboard', feature: null }).hunts).toMatchObject({
      now: 'Last hunt +$50.00',
      next: 'No signal',
    });
    expect(rows({ ...base, hunts: HUNTS(), roundError: 'x', featured: 'leaderboard', feature: null }).hunts.next).toBe('No signal');
  });

  test('an untitled round reads as a prediction round', () => {
    const feature = huntFeature({ hunts: HUNTS(), round: ROUND('open', { title: '' }) });
    expect(rows({ ...base, featured: 'hunts', feature }).hunts.now).toBe('Prediction round · Predictions open');
  });

  test('hunts read failed with nothing cached: No signal', () => {
    expect(rows({ ...base, hunts: HUNTS({ error: 'HTTP 502' }), featured: 'leaderboard', feature: null }).hunts).toMatchObject({ now: 'No signal', next: '—' });
  });

  test('leaderboard row: no standings yet, no signal, loading', () => {
    expect(rows({ ...base, leaderboard: BOARD({ players: [], prizePool: 0 }), featured: 'leaderboard', feature: null }).leaderboard.now).toBe('No standings yet');
    expect(rows({ ...base, leaderboard: BOARD({ players: [], error: 'x' }), featured: 'leaderboard', feature: null }).leaderboard.now).toBe('No signal');
    expect(rows({ ...base, leaderboard: BOARD({ players: [], isLoading: true }), featured: 'leaderboard', feature: null }).leaderboard.now).toBe('Tuning…');
  });

  test('static channels', () => {
    const r = rows({ ...base, featured: 'leaderboard', feature: null });
    expect(r['bonus-battle']).toMatchObject({ now: 'Two bonuses, one winner. Call it.', next: 'Any time', lit: false });
    expect(r.wheel).toMatchObject({ now: 'Spin up a random slot to play next.', next: 'Any time', lit: false });
  });
});
