import { formatClock, formatEpisodeDate, screenClock, timeAgo, toMs } from '../huntTime';
import {
  formatAvg,
  formatAvgFigure,
  huntMode,
  huntStats,
  median,
  ordinal,
  quickPicks,
  signedMoney,
  splitMoney,
  tabHuntRef,
  topPrizeText,
  winnerPrizeText,
} from '../huntStats';

const BONUSES = [
  { slot: 'Wanted Dead or a Wild', bet: 0.6, win: 487.2, multiplier: 812 },
  { slot: 'Gates of Olympus', bet: 0.8, win: 33.2, multiplier: 41.5 },
  { slot: 'The Dog House', bet: 0.8, win: 0, multiplier: 0 },
  { slot: 'Sugar Rush', bet: 0.6, win: null, multiplier: null },
];
const ROUND = {
  id: 'r1',
  title: 'Thursday Comm Hunt',
  status: 'open',
  acceptPredictions: true,
  source: 'communityhunts',
  bonusHuntSnapshot: { huntId: 'h1', totalCost: 2421.82, currency: null, bonusCount: 4 },
  rewards: { tiers: [{ place: 2, tickets: 100, prize: null }, { place: 1, tickets: 500, prize: null }] },
};

describe('huntTime', () => {
  test('formatClock reads a Firestore timestamp, a Date or an ISO string', () => {
    const d = new Date(2026, 9, 1, 21, 58);
    expect(formatClock(d)).toEqual({ long: 'THU OCT 1 · 9:58 PM', short: '9:58 PM' });
    expect(formatClock({ toDate: () => d })).toEqual(formatClock(d));
    expect(formatClock(d.toISOString())).toEqual(formatClock(d));
    expect(formatClock(null)).toBeNull();
    expect(formatClock('not a date')).toBeNull();
  });

  test('timeAgo buckets', () => {
    const now = 10 * 60 * 60 * 1000;
    expect(timeAgo(now - 20 * 1000, now)).toBe('just now');
    expect(timeAgo(now - 5 * 60 * 1000, now)).toBe('5m ago');
    expect(timeAgo(now - 2 * 60 * 60 * 1000, now)).toBe('2h ago');
    expect(timeAgo(null, now)).toBe('');
  });

  test('toMs and formatEpisodeDate tolerate missing values', () => {
    expect(toMs(undefined)).toBe(0);
    expect(toMs({ toMillis: () => 5, toDate: () => new Date(5) })).toBe(5);
    expect(formatEpisodeDate(new Date(2026, 8, 27))).toBe('SEP 27');
    expect(formatEpisodeDate(null)).toBe('—');
  });

  test('screenClock: live clock while running, settledAt once settled, hunt end off air', () => {
    const now = new Date(2026, 9, 1, 21, 58).getTime();
    expect(screenClock('open', { now }).short).toBe('9:58 PM');
    expect(screenClock('settled', { round: { settledAt: new Date(2026, 9, 1, 23, 42) } }).short).toBe('11:42 PM');
    expect(screenClock('settled', { round: {} })).toBeNull();
    expect(screenClock('offair', { hunt: { endedAt: '2026-09-27T03:00:00Z' }, isLive: false })).not.toBeNull();
    expect(screenClock('tuning', { now })).toBeNull();
  });
});

describe('huntMode and tabHuntRef', () => {
  test('mode follows status, and rounds without predictions are off air', () => {
    expect(huntMode(null)).toBe('offair');
    expect(huntMode({ ...ROUND, acceptPredictions: false })).toBe('offair');
    expect(huntMode(ROUND)).toBe('open');
    expect(huntMode({ ...ROUND, status: 'locked' })).toBe('locked');
    expect(huntMode({ ...ROUND, status: 'settled' })).toBe('settled');
  });

  test('the round hunt comes from the live poll, else the recent list, else by id only', () => {
    const live = { id: 'h1', bonuses: BONUSES };
    expect(tabHuntRef(ROUND, live, [])).toEqual({ huntId: 'h1', summary: live, isLive: true });
    expect(tabHuntRef(ROUND, null, [{ id: 'h1' }])).toEqual({ huntId: 'h1', summary: { id: 'h1' }, isLive: false });
    expect(tabHuntRef(ROUND, null, [])).toEqual({ huntId: 'h1', summary: null, isLive: false });
  });

  test('manual rounds have no hunt; off air uses live, else the newest', () => {
    expect(tabHuntRef({ ...ROUND, source: 'manual' }, { id: 'x' }, [])).toEqual({ huntId: null, summary: null, isLive: false });
    expect(tabHuntRef(null, null, [{ id: 'a' }, { id: 'b' }]).huntId).toBe('a');
    expect(tabHuntRef(null, { id: 'live' }, [{ id: 'a' }])).toEqual({ huntId: 'live', summary: { id: 'live' }, isLive: true });
    expect(tabHuntRef(null, null, [])).toEqual({ huntId: null, summary: null, isLive: false });
  });
});

describe('huntStats', () => {
  test('required avg, opening progress, best hit and next up', () => {
    const s = huntStats({ id: 'h1', bonuses: BONUSES }, ROUND);
    expect(s.startCost).toBe(2421.82);
    expect(s.totalBet).toBe(2.8);
    expect(s.avgBet).toBe(0.7);
    expect(s.requiredAvg).toBeCloseTo(864.94, 2);
    expect(s.openedCount).toBe(3);
    expect(s.bonusCount).toBe(4);
    expect(s.wonSoFar).toBe(520.4);
    expect(s.stillNeedAvg).toBeCloseTo((2421.82 - 520.4) / 0.6, 6);
    expect(s.bestIndex).toBe(0);
    expect(s.nextIndex).toBe(3);
  });

  // Review Focus 4: degenerate hunts never produce NaN or Infinity.
  test('no bonuses, potless and manual rounds give nulls, not NaN', () => {
    const s = huntStats(null, { ...ROUND, source: 'manual', manualTotalCost: '' });
    expect(s.bonuses).toEqual([]);
    expect(s.startCost).toBeNull();
    expect(s.totalBet).toBeNull();
    expect(s.requiredAvg).toBeNull();
    expect(s.stillNeedAvg).toBeNull();
    expect(s.result).toBeNull();
    expect(s.bestIndex).toBe(-1);
    expect(s.nextIndex).toBe(-1);
    const potless = huntStats({ pot: 0, totalWon: 50, bonuses: [] }, null);
    expect(potless.startCost).toBeNull();
    expect(potless.result).toBeNull();
  });

  test('everything opened: still-need avg is null, a hunt of duds has no best hit', () => {
    const allOpen = BONUSES.slice(0, 3);
    expect(huntStats({ bonuses: allOpen }, ROUND).stillNeedAvg).toBeNull();
    const duds = [{ bet: 1, win: 0, multiplier: 0 }];
    expect(huntStats({ bonuses: duds }, ROUND).bestIndex).toBe(-1);
  });

  test('a settled round reports the actual payout as won, with result and avg multi', () => {
    const s = huntStats({ bonuses: BONUSES.slice(0, 3), averageMultiple: null }, { ...ROUND, status: 'settled', actual: { payout: 2046.12 } });
    expect(s.won).toBe(2046.12);
    expect(s.result).toBe(-375.7);
    expect(s.avgMulti).toBeCloseTo(2046.12 / 2.2, 6);
  });

  test('off air (no round) uses the hunt pot and total won', () => {
    const s = huntStats({ pot: 3103.62, totalWon: 1318.8, averageMultiple: 30.44, bonusCount: 18 }, null);
    expect(s.startCost).toBe(3103.62);
    expect(s.won).toBe(1318.8);
    expect(s.result).toBe(-1784.82);
    expect(s.avgMulti).toBe(30.44);
    expect(s.bonusCount).toBe(18);
  });
});

describe('formatting helpers', () => {
  test('median', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1855, 3663, 3100, 2777, 2122, 3333])).toBe(2938.5);
    expect(median([null, NaN])).toBeNull();
  });

  test('averages', () => {
    expect(formatAvgFigure(109.09)).toBe('109.1');
    expect(formatAvg(109.09)).toBe('109.1x');
    expect(formatAvg(1204.4)).toBe('1,204x');
    expect(formatAvg(null)).toBe('—');
  });

  test('quick picks spread around the start cost', () => {
    expect(quickPicks(150000)).toEqual([
      { label: 'Half back', value: 75000 },
      { label: 'Break-even', value: 150000 },
      { label: 'Double', value: 300000 },
    ]);
    expect(quickPicks(0)).toEqual([]);
  });

  test('prize text for the top tier and for winners', () => {
    expect(topPrizeText(ROUND)).toBe('+500 tickets');
    expect(topPrizeText({ rewards: { tiers: [{ place: 1, tickets: 500, prize: { kind: 'cash', amount: 50 } }] } })).toBe('+500 tickets + $50 cash');
    expect(topPrizeText({ rewards: { type: 'cash', tiers: [{ place: 1, tickets: 100, cashLabel: '$20' }] } })).toBe('$20');
    expect(topPrizeText(null)).toBeNull();
    expect(winnerPrizeText({ tickets: 500, label: null })).toBe('+500 tickets');
    expect(winnerPrizeText({ tickets: 0, label: 'Bonus buy $20' })).toBe('Bonus buy $20');
    expect(winnerPrizeText(null)).toBeNull();
  });

  test('splitMoney separates sign, currency symbol and figure', () => {
    expect(splitMoney('ARS 1,850,000.00')).toEqual({ sign: '', symbol: 'ARS', figure: '1,850,000.00' });
    expect(splitMoney('−$375.70')).toEqual({ sign: '−', symbol: '$', figure: '375.70' });
    expect(splitMoney('+CA$1,284.40')).toEqual({ sign: '+', symbol: 'CA$', figure: '1,284.40' });
    expect(splitMoney('—')).toEqual({ sign: '', symbol: '', figure: '—' });
  });

  test('signedMoney and ordinal', () => {
    expect(signedMoney(1284.4, null)).toBe('+$1,284.40');
    expect(signedMoney(-375.7, null)).toBe('−$375.70');
    expect(signedMoney(-191.12, null, { decimals: 0 })).toBe('−$191');
    expect(signedMoney(null, null)).toBe('—');
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd']);
  });
});
