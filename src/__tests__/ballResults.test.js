/**
 * @jest-environment node
 */
import * as server from '../../api/_lib/ballResults.js';
import * as client from '../utils/ballResults';

const at = (ms) => ({ toMillis: () => ms });
const ROUND = {
  rack: [
    { drawNo: 1, twitchId: 'a', displayName: 'CoolGuy', slotId: 'goo', slotName: 'Gates of Olympus', thumb: 't1', drawnAt: at(1), scratched: false },
    { drawNo: 2, twitchId: 'b', displayName: 'BigWinz', slotId: 'wanted', slotName: 'Wanted Dead or a Wild', thumb: null, drawnAt: at(2), scratched: false },
    { drawNo: 3, twitchId: 'c', displayName: 'Pupper', slotId: 'dog', slotName: 'The Dog House', thumb: null, drawnAt: at(3), scratched: true },
    { drawNo: 4, twitchId: 'd', displayName: 'SugarFan', slotId: 'sugar', slotName: 'Sugar Rush 1000', thumb: null, drawnAt: at(4), scratched: false },
  ],
};
const BONUSES = [
  { slot: 'gates of olympus', bet: 1, win: 412, multiplier: 412 },
  { slot: 'Wanted Dead or a Wild', bet: '2', win: '176', multiplier: '88' },
  { slot: 'The Dog House', bet: 1, win: 900, multiplier: 900 },
  { slot: 'Sugar Rush 1000', bet: 1, win: null, multiplier: null },
  { slot: 'Not On The Rack', bet: 1, win: 5000, multiplier: 5000 },
];

describe.each([
  ['server', server],
  ['client', client],
])('%s', (_label, m) => {
  test('rows: scratched skipped, strings parsed, unopened is pending, case and punctuation ignored', () => {
    const rows = m.resultRows(ROUND, BONUSES);
    expect(rows.map((r) => [r.drawNo, r.multiplier, r.win, r.bet, r.source, r.matchCount])).toEqual([
      [1, 412, 412, 1, 'hunt', 1],
      [2, 88, 176, 2, 'hunt', 1],
      [4, null, null, null, null, 1],
    ]);
  });

  test('a manual multiplier beats the hunt; bonusIndex picks between duplicates', () => {
    const dupes = [...BONUSES, { slot: 'Gates of Olympus', bet: 1, win: 1000, multiplier: 1000 }];
    expect(m.resultRows(ROUND, dupes)[0]).toMatchObject({ multiplier: 412, matchCount: 2 });
    expect(m.resultRows(ROUND, dupes, { 1: { multiplier: null, bonusIndex: 1 } })[0]).toMatchObject({ multiplier: 1000, source: 'hunt' });
    expect(m.resultRows(ROUND, BONUSES, { 4: { multiplier: 41, win: 41, bet: 1, bonusIndex: null } })[2]).toMatchObject({
      multiplier: 41,
      source: 'manual',
    });
  });

  test('ranking: multiplier, then win, then the earlier draw', () => {
    const rows = [
      { drawNo: 1, multiplier: 50, win: 50 },
      { drawNo: 2, multiplier: 50, win: 100 },
      { drawNo: 3, multiplier: 50, win: 100 },
      { drawNo: 4, multiplier: null, win: null },
    ];
    expect(m.rankRows(rows).map((r) => r.drawNo)).toEqual([2, 3, 1]);
    expect(m.winnerOf(rows).drawNo).toBe(2);
    expect(m.winnerOf([{ drawNo: 1, multiplier: null }])).toBeNull();
  });

  test('sanitizeOverrides keeps only usable entries', () => {
    expect(
      m.sanitizeOverrides({ 1: { multiplier: '12.5', win: '25', bet: 'x' }, 0: { multiplier: 3 }, 2: { multiplier: -1 }, 3: { bonusIndex: '1' }, a: { multiplier: 2 } })
    ).toEqual({ 1: { multiplier: 12.5, win: 25, bet: null, bonusIndex: null }, 3: { multiplier: null, win: null, bet: null, bonusIndex: 1 } });
    expect(m.sanitizeOverrides(null)).toEqual({});
  });
});

test('client and server agree', () => {
  const overrides = { 4: { multiplier: 41, win: 41, bet: 1, bonusIndex: null } };
  expect(client.resultRows(ROUND, BONUSES, overrides)).toEqual(server.resultRows(ROUND, BONUSES, overrides));
  expect(client.normName('The Dog House!')).toBe(server.normName('The Dog House!'));
});

test('settledRows reads results off the round', () => {
  const settled = { ...ROUND, results: { 1: { multiplier: 412, win: 412, bet: 1, source: 'hunt' }, 4: { multiplier: 41, win: 41, bet: 1, source: 'manual' } } };
  expect(client.settledRows(settled).map((r) => [r.drawNo, r.multiplier, r.source])).toEqual([
    [1, 412, 'hunt'],
    [2, null, null],
    [4, 41, 'manual'],
  ]);
});
