import {
  FILTERS,
  ageLabel,
  filterCounts,
  filterQueue,
  kindGroup,
  kindLabel,
  newestAt,
  queueOrder,
  redemptionErrorText,
  showsCost,
  unseenCount,
  whoRedeemed,
} from '../redemptions';

const at = (ms) => ({ toMillis: () => ms });
// Newest first, as the provider's feed delivers it.
const FEED = [
  { id: 'c', kind: 'giveaway', createdAt: at(3000) },
  { id: 'b', kind: 'stream', createdAt: at(2000) },
  { id: 'a', kind: 'prediction', createdAt: at(1000) },
];

test('kinds group into stream and payouts; anything else only shows under All', () => {
  expect(['stream', 'giveaway', 'prediction', 'virtual', undefined].map(kindGroup)).toEqual([
    'stream',
    'payouts',
    'payouts',
    'other',
    'other',
  ]);
  expect(kindLabel('prediction')).toBe('PREDICTION');
  expect(kindLabel(undefined)).toBe('ITEM');
});

test('filters and their counts', () => {
  const list = [...FEED, { id: 'x', kind: 'virtual', createdAt: at(500) }];
  expect(FILTERS).toEqual(['all', 'stream', 'payouts']);
  expect(filterQueue(list, 'all')).toHaveLength(4);
  expect(filterQueue(list, 'stream').map((r) => r.id)).toEqual(['b']);
  expect(filterQueue(list, 'payouts').map((r) => r.id)).toEqual(['c', 'a']);
  expect(filterCounts(list)).toEqual({ all: 4, stream: 1, payouts: 2 });
  expect(filterCounts(undefined)).toEqual({ all: 0, stream: 0, payouts: 0 });
});

test('the queue reads oldest first and leaves the feed alone', () => {
  expect(queueOrder(FEED).map((r) => r.id)).toEqual(['a', 'b', 'c']);
  expect(FEED.map((r) => r.id)).toEqual(['c', 'b', 'a']);
});

test('newest and unseen go by createdAt', () => {
  const withMissing = [...FEED, { id: 'z', kind: 'stream' }];
  expect(newestAt(withMissing)).toBe(3000);
  expect(newestAt([])).toBeNull();
  expect(unseenCount(withMissing, 1500)).toBe(2);
  expect(unseenCount(withMissing, 3000)).toBe(0);
  expect(unseenCount(withMissing, null)).toBe(0);
});

test('age labels at each boundary', () => {
  const NOW = 10 * 86_400_000;
  const ago = (ms) => ageLabel(at(NOW - ms), NOW);
  expect(ago(59_000)).toBe('just now');
  expect(ago(60_000)).toBe('1m ago');
  expect(ago(59 * 60_000)).toBe('59m ago');
  expect(ago(60 * 60_000)).toBe('1h ago');
  expect(ago(23 * 3_600_000)).toBe('23h ago');
  expect(ago(24 * 3_600_000)).toBe('1d ago');
  expect(ago(-5_000)).toBe('just now');
  expect(ageLabel(null, NOW)).toBe('');
});

// Review Focus 5: old docs miss fields the panel reads.
test('price, name and error fallbacks', () => {
  expect(showsCost({ cost: 420 })).toBe(true);
  expect(showsCost({ cost: 0 })).toBe(false);
  expect(showsCost({})).toBe(false);
  expect(whoRedeemed({ displayName: 'Cee', twitchName: 'cee' })).toBe('Cee');
  expect(whoRedeemed({ twitchName: 'cee' })).toBe('cee');
  expect(whoRedeemed({ userId: 'u1' })).toBe('u1');
  expect(whoRedeemed({})).toBe('someone');
  expect(redemptionErrorText('NOT_PENDING')).toBe('Already handled by someone else.');
  expect(redemptionErrorText('NOT_FOUND')).toBe("This one's gone.");
  expect(redemptionErrorText('INTERNAL')).toBe("Didn't go through. Try again.");
});
