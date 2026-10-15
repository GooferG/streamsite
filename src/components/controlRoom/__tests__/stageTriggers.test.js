import { RESULTS_HOLD_MS, ballDrawMoment, ballWinnerMoment, giveawayMoment, resultsMoment } from '../stageTriggers';
import { LOCK_HOLD_MS, REVEAL_MS } from '../../../utils/giveaway';

const NOW = 1_700_000_000_000;
const at = (ms) => ({ toMillis: () => ms });
const rolling = (rolledAt, id = 'tw1') => ({
  status: 'rolling',
  winnerTwitchId: id,
  rolledAt: at(rolledAt),
  winner: { twitchId: id },
});

test('a fresh pick stages until the winner has been held', () => {
  expect(giveawayMoment(rolling(NOW - 2_000), null, NOW)).toEqual({
    kind: 'giveaway',
    key: `tw1:${NOW - 2_000}`,
    endsAt: NOW - 2_000 + REVEAL_MS + LOCK_HOLD_MS,
  });
});

test('a pick older than 10s never replays (reload, or Stage turned on late)', () => {
  expect(giveawayMoment(rolling(NOW - 10_000), null, NOW)).toBeNull();
});

test('a pick whose hold has already elapsed never flashes just to power off', () => {
  expect(giveawayMoment(rolling(NOW - 8_000), null, NOW)).toBeNull();
});

test('the same pick stages once; a reroll is a new pick', () => {
  const g = rolling(NOW - 1_000);
  expect(giveawayMoment(g, `tw1:${NOW - 1_000}`, NOW)).toBeNull();
  expect(giveawayMoment(rolling(NOW - 500, 'tw2'), `tw1:${NOW - 1_000}`, NOW).key).toBe(`tw2:${NOW - 500}`);
});

test('only rolling giveaways with a winner stage', () => {
  expect(giveawayMoment({ ...rolling(NOW), status: 'open' }, null, NOW)).toBeNull();
  expect(giveawayMoment({ ...rolling(NOW), winner: null }, null, NOW)).toBeNull();
  expect(giveawayMoment(null, null, NOW)).toBeNull();
});

test('a fresh settle stages once, for 8s', () => {
  const round = { id: 'r1', status: 'settled', settledAt: at(NOW - 1_000) };
  expect(resultsMoment(round, null, NOW)).toEqual({ kind: 'results', key: 'r1', endsAt: NOW + RESULTS_HOLD_MS, round });
  expect(resultsMoment(round, 'r1', NOW)).toBeNull();
  expect(resultsMoment({ ...round, settledAt: at(NOW - 11_000) }, null, NOW)).toBeNull();
  expect(resultsMoment({ ...round, status: 'locked' }, null, NOW)).toBeNull();
});

describe('Goofer Ball moments', () => {
  const at2 = (ms) => ({ toMillis: () => ms });
  const NOW = 10_000_000;
  const round = (agoMs, extra = {}) => ({
    id: 'r1',
    status: 'open',
    rack: [{ drawNo: 2, slotName: 'Gates of Olympus', displayName: 'CoolGuy', drawnAt: at2(NOW - agoMs), scratched: false }],
    ...extra,
  });

  test('a fresh draw takes the stage once', () => {
    const m = ballDrawMoment(round(500), null, NOW);
    expect(m).toMatchObject({ kind: 'ball-draw', key: 'r1:2', at: NOW - 500, endsAt: NOW - 500 + 8000 });
    expect(ballDrawMoment(round(500), 'r1:2', NOW)).toBeNull();
    expect(ballDrawMoment(round(9000), null, NOW)).toBeNull();
  });

  test('a fresh settle plays the winner card', () => {
    const settled = { id: 'r1', status: 'settled', settledAt: at2(NOW - 1000), winner: { drawNo: 2 }, rack: [] };
    expect(ballWinnerMoment(settled, null, NOW)).toMatchObject({ kind: 'ball-winner', key: 'r1:winner', endsAt: NOW - 1000 + 12000 });
    expect(ballWinnerMoment(settled, 'r1:winner', NOW)).toBeNull();
  });

  test('a settle seen 11s late does not replay the winner card', () => {
    const settled = { id: 'r1', status: 'settled', settledAt: at2(NOW - 11_000), winner: { drawNo: 2 }, rack: [] };
    expect(ballWinnerMoment(settled, null, NOW)).toBeNull();
  });
});
