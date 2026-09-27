import { pickWinners } from '../../api/_lib/predictions';

const ts = (ms) => ({ toMillis: () => ms });
const round = (payout, places = [1, 2]) => ({
  actual: { payout },
  rewards: { tiers: places.map((place) => ({ place })) },
});

test('closest payout guess wins, in tier order', () => {
  const entries = [
    { twitchId: 'a', payoutGuess: 900, submittedAt: ts(1) },
    { twitchId: 'b', payoutGuess: 1010, submittedAt: ts(2) },
    { twitchId: 'c', payoutGuess: 2000, submittedAt: ts(3) },
  ];
  const [first, second] = pickWinners(entries, round(1000));
  expect(first.twitchId).toBe('b');
  expect(first.payoutDiff).toBe(10);
  expect(second.twitchId).toBe('a');
});

test('a tie goes to the earlier submission', () => {
  const entries = [
    { twitchId: 'late', payoutGuess: 1100, submittedAt: ts(20) },
    { twitchId: 'early', payoutGuess: 900, submittedAt: ts(10) },
  ];
  expect(pickWinners(entries, round(1000))[0].twitchId).toBe('early');
});

test('entries without a numeric guess are excluded; short lists pad with null', () => {
  const entries = [
    { twitchId: 'x', payoutGuess: null, submittedAt: ts(1) },
    { twitchId: 'y', payoutGuess: 50, submittedAt: ts(2) },
  ];
  const result = pickWinners(entries, round(100, [1, 2, 3]));
  expect(result).toHaveLength(3);
  expect(result[0].twitchId).toBe('y');
  expect(result[1]).toBeNull();
  expect(result[2]).toBeNull();
});

test('no actual payout means no winners', () => {
  const entries = [{ twitchId: 'a', payoutGuess: 1, submittedAt: ts(1) }];
  expect(pickWinners(entries, { actual: {}, rewards: { tiers: [{ place: 1 }] } })).toEqual([null]);
});
