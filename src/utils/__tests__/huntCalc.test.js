import { computeStats, bestWorstSlot, computeCallerStats } from '../huntCalc';

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

describe('computeCallerStats — reputation layer', () => {
  // Caller "Ana": current hunt 2 calls (one played 100x, one unopened),
  // history 1 played call at 30x. "Bo": 1 played call at 0.5x (brick).
  const CURRENT = [
    { slot: 'Big Bass', stake: 10, win: 1000, caller: 'Ana' }, // 100x played
    { slot: 'Gates', stake: 10, win: 0, caller: 'Ana' },       // gotIn, not played
    { slot: 'Doom', stake: 10, win: 5, caller: 'Bo' },         // 0.5x brick
  ];
  const HISTORY = [
    { bonuses: [{ slot: 'Wanted', stake: 10, win: 300, caller: 'Ana' }] }, // 30x
  ];
  const SKIPS = [{ caller: 'Bo', slot: 'Skipped Slot' }];

  test('seeds gotIn from current + history, missed from skips', () => {
    const s = computeCallerStats(CURRENT, HISTORY, SKIPS);
    const ana = s.leaderboard.find((r) => r.name === 'Ana');
    const bo = s.leaderboard.find((r) => r.name === 'Bo');
    expect(ana.gotIn).toBe(3);   // 2 current + 1 history
    expect(ana.missed).toBe(0);
    expect(bo.gotIn).toBe(1);
    expect(bo.missed).toBe(1);   // one skip
    expect(bo.calls).toBe(2);
    expect(bo.acceptRate).toBeCloseTo(0.5, 2);
  });

  test('avgX / best / plays use played calls across current + history', () => {
    const s = computeCallerStats(CURRENT, HISTORY, SKIPS);
    const ana = s.leaderboard.find((r) => r.name === 'Ana');
    // played X: 100 (current) + 30 (history) -> avg 65, best 100, plays 2
    expect(ana.plays).toBe(2);
    expect(ana.best).toBeCloseTo(100, 2);
    expect(ana.avgX).toBeCloseTo(65, 2);
  });

  test('status: hot when avgX>=25 and acceptRate>=0.6, cold on low accept', () => {
    const s = computeCallerStats(CURRENT, HISTORY, SKIPS);
    const ana = s.leaderboard.find((r) => r.name === 'Ana');
    expect(ana.status).toBe('hot'); // avg 65, accept 1.0
  });

  test('backward compatible: one-arg call still returns legacy keys', () => {
    const s = computeCallerStats(CURRENT);
    expect(Array.isArray(s.leaderboard)).toBe(true);
    expect(s).toHaveProperty('bestCall');
    expect(s).toHaveProperty('worstCall');
    expect(s).toHaveProperty('bestAvgCaller'); // legacy alias preserved
  });

  test('empty input returns empty leaderboard and null highlights', () => {
    const s = computeCallerStats([]);
    expect(s.leaderboard).toEqual([]);
    expect(s.bestCall).toBeNull();
    expect(s.hotCaller).toBeNull();
  });

  test('status: cold via low accept rate + enough calls; coldCaller highlight', () => {
    // Cy: 1 played call (10x) + 3 skips -> gotIn 1, missed 3, calls 4,
    // acceptRate 0.25 (< 0.35) with calls >= 3 -> cold. avgX 10 so not hot.
    const current = [{ slot: 'Sugar', stake: 10, win: 100, caller: 'Cy' }]; // 10x
    const skips = [
      { caller: 'Cy', slot: 'Skip A' },
      { caller: 'Cy', slot: 'Skip B' },
      { caller: 'Cy', slot: 'Skip C' },
    ];
    const s = computeCallerStats(current, [], skips);
    const cy = s.leaderboard.find((r) => r.name === 'Cy');
    expect(cy.calls).toBe(4);
    expect(cy.gotIn).toBe(1);
    expect(cy.missed).toBe(3);
    expect(cy.acceptRate).toBeCloseTo(0.25, 2);
    expect(cy.status).toBe('cold');
    expect(s.coldCaller.name).toBe('Cy');
  });

  test('status: cold via cold streak (last 2+ played X < 1)', () => {
    // De: history plays at 0.5x then 0.3x -> trailing coldStreak 2 -> cold.
    // acceptRate 1.0 so the low-accept branch does not apply here.
    const history = [
      {
        bonuses: [
          { slot: 'Brick One', stake: 10, win: 5, caller: 'De' }, // 0.5x
          { slot: 'Brick Two', stake: 10, win: 3, caller: 'De' }, // 0.3x
        ],
      },
    ];
    const s = computeCallerStats([], history, []);
    const de = s.leaderboard.find((r) => r.name === 'De');
    expect(de.coldStreak).toBeGreaterThanOrEqual(2);
    expect(de.acceptRate).toBeCloseTo(1, 2);
    expect(de.status).toBe('cold');
  });

  test('status: hot via hot streak (last 2+ played X >= 20); hotCaller highlight', () => {
    // Ed: history plays at 50x then 30x -> trailing hotStreak 2 -> hot.
    const history = [
      {
        bonuses: [
          { slot: 'Boom One', stake: 10, win: 500, caller: 'Ed' }, // 50x
          { slot: 'Boom Two', stake: 10, win: 300, caller: 'Ed' }, // 30x
        ],
      },
    ];
    const s = computeCallerStats([], history, []);
    const ed = s.leaderboard.find((r) => r.name === 'Ed');
    expect(ed.hotStreak).toBeGreaterThanOrEqual(2);
    expect(ed.status).toBe('hot');
    expect(s.hotCaller.name).toBe('Ed');
  });

  test('status: steady when neither hot nor cold', () => {
    // Fi: single played call at 10x, acceptRate 1.0, plays 1.
    // avgX 10 < 25 -> not hot; accept 1.0 -> not cold; no streaks -> steady.
    const current = [{ slot: 'Mid', stake: 10, win: 100, caller: 'Fi' }]; // 10x
    const s = computeCallerStats(current, [], []);
    const fi = s.leaderboard.find((r) => r.name === 'Fi');
    expect(fi.status).toBe('steady');
  });

  test('form pips map played X to win / ok / brick in order', () => {
    // Gu: plays at 50x (win), 10x (ok), 0.5x (brick) in chronological order.
    const history = [
      {
        bonuses: [
          { slot: 'P1', stake: 10, win: 500, caller: 'Gu' }, // 50x -> win
          { slot: 'P2', stake: 10, win: 100, caller: 'Gu' }, // 10x -> ok
          { slot: 'P3', stake: 10, win: 5, caller: 'Gu' },   // 0.5x -> brick
        ],
      },
    ];
    const s = computeCallerStats([], history, []);
    const gu = s.leaderboard.find((r) => r.name === 'Gu');
    expect(gu.form).toEqual(['win', 'ok', 'brick']);
  });

  test('mostConsistent (and bestAvgCaller alias) require >= 2 plays', () => {
    // Hi: a single played call -> plays 1 -> excluded from consistency picks.
    const current = [{ slot: 'Solo', stake: 10, win: 100, caller: 'Hi' }]; // 10x
    const s = computeCallerStats(current, [], []);
    expect(s.mostConsistent).toBeNull();
    expect(s.bestAvgCaller).toBeNull();
  });
});
