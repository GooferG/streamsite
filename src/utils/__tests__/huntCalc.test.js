import { computeStats, bestWorstSlot } from '../huntCalc';

// A hunt mid-opening: 3 bonuses, 2 opened (win > 0), 1 not yet opened.
const HUNT = {
  startBalance: 1600,
  finishBalance: '',
  bonuses: [
    { stake: 10, win: 1000 }, // opened, 100x
    { stake: 10, win: 67.48 }, // opened, 6.748x
    { stake: 10, win: 0 }, // not opened yet
  ],
  gamblers: [],
};

describe('computeStats — running figures (no finish balance yet)', () => {
  test('runningProfit = totalWins − start (negative while down)', () => {
    const s = computeStats(HUNT);
    // 1067.48 − 1600 = −532.52
    expect(s.runningProfit).toBeCloseTo(-532.52, 2);
  });

  test('runningProfit is null when start is unset', () => {
    const s = computeStats({ ...HUNT, startBalance: '' });
    expect(s.runningProfit).toBeNull();
  });

  test('runningProfit goes positive once winnings exceed start', () => {
    const s = computeStats({
      ...HUNT,
      bonuses: [{ stake: 10, win: 2000 }],
    });
    expect(s.runningProfit).toBeCloseTo(400, 2); // 2000 − 1600
  });

  test('curAvgWin = totalWins / openedCount (avg $ per opened bonus)', () => {
    const s = computeStats(HUNT);
    // 1067.48 / 2 = 533.74
    expect(s.curAvgWin).toBeCloseTo(533.74, 2);
  });

  test('curAvgWin is null with no opened bonuses', () => {
    const s = computeStats({
      ...HUNT,
      bonuses: [{ stake: 10, win: 0 }],
    });
    expect(s.curAvgWin).toBeNull();
  });

  test('avgReqRemaining = (start − totalWins) / remaining bonuses', () => {
    const s = computeStats(HUNT);
    // (1600 − 1067.48) / 1 remaining = 532.52
    expect(s.avgReqRemaining).toBeCloseTo(532.52, 2);
  });

  test('avgReqRemaining is null when nothing remains to open', () => {
    const s = computeStats({
      ...HUNT,
      bonuses: [{ stake: 10, win: 50 }, { stake: 10, win: 60 }],
    });
    expect(s.avgReqRemaining).toBeNull();
  });

  test('totalX = sum of played multis', () => {
    const s = computeStats(HUNT);
    // 100 + 6.748 = 106.748
    expect(s.totalX).toBeCloseTo(106.748, 3);
  });

  test('curAvgX = average played multi', () => {
    const s = computeStats(HUNT);
    // (100 + 6.748) / 2 = 53.374
    expect(s.curAvgX).toBeCloseTo(53.374, 3);
  });

  test('curAvgX and totalX are null/zero with no played bonuses', () => {
    const s = computeStats({ ...HUNT, bonuses: [{ stake: 10, win: 0 }] });
    expect(s.curAvgX).toBeNull();
    expect(s.totalX).toBe(0);
  });
});

describe('bestWorstSlot — top and lowest X multi across played slots', () => {
  const BONUSES = [
    { slot: 'Banana Farm', stake: 10, win: 7664 }, // 766.4x
    { slot: 'Le Bandit', stake: 10, win: 1610 }, // 161x
    { slot: 'Slayers Inc', stake: 10, win: 4 }, // 0.4x
    { slot: 'Unopened', stake: 10, win: 0 }, // not played — ignored
  ];

  test('best is the highest multi played slot', () => {
    const { best } = bestWorstSlot(BONUSES);
    expect(best.slot).toBe('Banana Farm');
    expect(best.x).toBeCloseTo(766.4, 1);
  });

  test('worst is the lowest multi played slot', () => {
    const { worst } = bestWorstSlot(BONUSES);
    expect(worst.slot).toBe('Slayers Inc');
    expect(worst.x).toBeCloseTo(0.4, 2);
  });

  test('ignores bonuses with no win or no stake', () => {
    const { best, worst } = bestWorstSlot([
      { slot: 'Played', stake: 5, win: 50 }, // 10x
      { slot: 'NoWin', stake: 5, win: 0 },
      { slot: 'NoStake', stake: 0, win: 100 },
    ]);
    expect(best.slot).toBe('Played');
    expect(worst.slot).toBe('Played');
  });

  test('returns nulls when nothing is played', () => {
    expect(bestWorstSlot([{ slot: 'X', stake: 10, win: 0 }])).toEqual({
      best: null,
      worst: null,
    });
  });

  test('handles empty / missing input', () => {
    expect(bestWorstSlot([])).toEqual({ best: null, worst: null });
    expect(bestWorstSlot(undefined)).toEqual({ best: null, worst: null });
  });
});
