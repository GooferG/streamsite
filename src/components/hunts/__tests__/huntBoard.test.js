import { entryName, guessOf, guessPosition, lineupRows, meterModel, rankEntries, tickerItems } from '../huntBoard';
import { huntStats } from '../huntStats';

const at = (min) => ({ toMillis: () => min * 60 * 1000 });
const entry = (id, payoutGuess, min, extra = {}) => ({
  id,
  twitchId: id,
  displayName: id,
  payoutGuess,
  submittedAt: at(min),
  ...extra,
});

const ENTRIES = [
  entry('skillsytv', 1855, 1),
  entry('G4KUR4', 3663, 2),
  entry('GRUMPZILLA12', 3100, 3),
  entry('RYGARTEARROW', 2777, 4),
  entry('Xilentdrifter', 2122, 5),
  entry('JESSEJEK', 3333, 6),
];
const SETTLED = {
  status: 'settled',
  actual: { payout: 2046.12 },
  winners: [
    { place: 1, twitchId: 'Xilentdrifter' },
    { place: 2, twitchId: 'skillsytv' },
  ],
};

test('guessOf and entryName tolerate malformed entries (Review Focus 3)', () => {
  expect(guessOf({ payoutGuess: '12' })).toBeNull();
  expect(guessOf({ payoutGuess: NaN })).toBeNull();
  expect(guessOf(null)).toBeNull();
  expect(entryName({ twitchName: 'tn' })).toBe('tn');
  expect(entryName({})).toBe('Viewer');
});

test('ranking mirrors pickWinners: closest first, ties to the earlier final guess', () => {
  const tied = [entry('late', 2100, 9, { lastEditAt: at(9) }), entry('early', 1900, 1)];
  expect(rankEntries(tied, 2000).map((e) => e.id)).toEqual(['early', 'late']);
  expect(rankEntries(ENTRIES, 2046.12).map((e) => e.id)).toEqual([
    'Xilentdrifter',
    'skillsytv',
    'RYGARTEARROW',
    'GRUMPZILLA12',
    'JESSEJEK',
    'G4KUR4',
  ]);
});

test('settled lineup: places, signed offsets, winner places from round.winners', () => {
  const { rows, total } = lineupRows({ mode: 'settled', entries: ENTRIES, round: SETTLED, myId: null });
  expect(total).toBe(6);
  expect(rows[0]).toMatchObject({ name: 'Xilentdrifter', place: 1, no: 5, winnerPlace: 1 });
  expect(rows[0].off).toBeCloseTo(75.88, 2);
  expect(rows[1]).toMatchObject({ name: 'skillsytv', place: 2, winnerPlace: 2 });
  expect(rows[1].off).toBeCloseTo(-191.12, 2);
});

test('locked lineup runs low to high and skips entries without a guess', () => {
  const entries = [...ENTRIES, { id: 'broken', twitchId: 'broken' }];
  const { rows, total } = lineupRows({ mode: 'locked', entries, round: { status: 'locked' }, myId: null });
  expect(total).toBe(6);
  expect(rows.map((r) => r.guess)).toEqual([1855, 2122, 2777, 3100, 3333, 3663]);
});

// Review Focus 5: the viewer outside the top 10 is pinned; winner beats viewer.
test('the viewer is pinned under a long list and expanding unpins them', () => {
  const many = Array.from({ length: 14 }, (_, i) => entry(`v${i}`, 1000 + i, i));
  const me = entry('me', 9999, 20);
  const { rows, pinned, hiddenCount } = lineupRows({ mode: 'locked', entries: [...many, me], round: {}, myId: 'me' });
  expect(rows).toHaveLength(10);
  expect(hiddenCount).toBe(5);
  expect(pinned).toMatchObject({ name: 'me', isMe: true });
  const open = lineupRows({ mode: 'locked', entries: [...many, me], round: {}, myId: 'me', expanded: true });
  expect(open.rows).toHaveLength(15);
  expect(open.pinned).toBeNull();
});

test('guessPosition counts others either side', () => {
  const entries = [...ENTRIES, entry('me', 2450, 7)];
  expect(guessPosition(entries, 'me')).toEqual({ below: 2, above: 4 });
  expect(guessPosition(entries, 'nobody')).toBeNull();
});

test('sealed meter: half to one-and-a-half times the start cost, only the viewer dot', () => {
  const m = meterModel({
    mode: 'open',
    sealed: true,
    entries: [],
    myEntry: entry('me', 2450, 1),
    myId: 'me',
    startCost: 2000,
    wonSoFar: null,
    round: { entryCount: 9 },
  });
  expect(m.lo).toBeLessThanOrEqual(1000);
  expect(m.hi).toBeGreaterThanOrEqual(3000);
  expect(m.dots).toEqual([expect.objectContaining({ tone: 'me', value: 2450 })]);
  expect(m.markers.map((x) => x.key)).toEqual(['break-even']);
  expect(m.count).toBe(9);
  expect(m.sealed).toBe(true);
});

test('sealed meter widens for a far-off guess and hides with no cost and no guess', () => {
  const m = meterModel({ mode: 'open', sealed: true, entries: [], myEntry: entry('me', 9000, 1), myId: 'me', startCost: 2000, round: {} });
  expect(m.hi).toBeGreaterThan(9000);
  expect(meterModel({ mode: 'open', sealed: true, entries: [], myEntry: null, myId: null, startCost: null, round: {} })).toBeNull();
});

test('settled meter: actual marker, winner and runner-up tones, others dim; off air has none', () => {
  const m = meterModel({ mode: 'settled', sealed: false, entries: ENTRIES, myEntry: null, myId: null, startCost: 2421.82, round: SETTLED });
  expect(m.markers).toEqual([expect.objectContaining({ key: 'actual', value: 2046.12, tone: 'winner' })]);
  const tones = Object.fromEntries(m.dots.map((d) => [d.id, d.tone]));
  expect(tones).toMatchObject({ Xilentdrifter: 'winner', skillsytv: 'runner', G4KUR4: 'dim' });
  expect(m.dots.every((d) => d.pct >= 0 && d.pct <= 100)).toBe(true);
  expect(meterModel({ mode: 'offair', sealed: false, entries: [], startCost: 1, round: null })).toBeNull();
});

test('locked meter adds a so-far marker under the track', () => {
  const m = meterModel({ mode: 'locked', sealed: false, entries: ENTRIES, myEntry: null, myId: null, startCost: 2421.82, wonSoFar: 883.38, round: {} });
  expect(m.markers.map((x) => [x.key, x.labelAt])).toEqual([['break-even', 'top'], ['so-far', 'bottom']]);
});

test('ticker items per mode', () => {
  const stats = huntStats(
    { bonuses: [{ slot: 'Wanted Dead or a Wild', bet: 0.6, win: 487.2, multiplier: 812 }, { slot: 'Mental', bet: 0.4, win: null }] },
    { status: 'open', source: 'manual', manualTotalCost: 2421.82 }
  );
  const money = (v) => `$${v}`;
  const signed = (v) => `${v}`;
  const open = tickerItems('open', { stats, guessCount: 6, prize: '+500 tickets', money, signed });
  expect(open[0]).toBe('Predictions open');
  expect(open).toContain('6 guesses in');
  expect(open).toContain('Closest guess wins +500 tickets');
  const settled = tickerItems('settled', {
    stats: { ...stats, result: -375.7 },
    guessCount: 6,
    winner: { name: 'Xilentdrifter', prize: '+500 tickets' },
    runnerUp: { name: 'skillsytv', prize: '+100 tickets' },
    money,
    signed,
  });
  expect(settled[0]).toBe('Xilentdrifter takes +500 tickets');
  expect(settled).toContain('Hunt finishes -375.7');
  expect(settled).toContain('Best hit · Wanted Dead or a Wild 812x');
  expect(settled).toContain('Runner-up skillsytv +100 tickets');
  expect(tickerItems('settled', { stats, winner: null, money, signed })[0]).toBe('No eligible guesses');
  expect(tickerItems('offair', { stats, isLive: false, money, signed })).toContain('Predictions open when Goofer starts a round');
});
