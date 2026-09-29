import { RESULTS_HOLD_MS, giveawayMoment, resultsMoment } from '../stageTriggers';
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
  expect(resultsMoment(round, null, NOW)).toEqual({ kind: 'results', key: 'r1', endsAt: NOW + RESULTS_HOLD_MS });
  expect(resultsMoment(round, 'r1', NOW)).toBeNull();
  expect(resultsMoment({ ...round, settledAt: at(NOW - 11_000) }, null, NOW)).toBeNull();
  expect(resultsMoment({ ...round, status: 'locked' }, null, NOW)).toBeNull();
});
