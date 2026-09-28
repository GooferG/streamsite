import {
  sanitizeRewards,
  prizeLabel,
  placeLabel,
  tierPrize,
} from '../../api/_lib/predictionRewards';

test('a cash-only round carries no hidden tickets and ignores type', () => {
  const out = sanitizeRewards({
    type: 'cash',
    tiers: [
      { place: 1, tickets: 0, prize: { kind: 'cash', amount: 10 } },
      { place: 2, tickets: 0, prize: { kind: 'cash', amount: 5 } },
    ],
  });
  expect(out).toEqual({
    tiers: [
      { place: 1, tickets: 0, prize: { kind: 'cash', amount: 10 } },
      { place: 2, tickets: 0, prize: { kind: 'cash', amount: 5 } },
    ],
  });
});

test('tickets clamp to whole numbers in range', () => {
  const { tiers } = sanitizeRewards({
    tiers: [
      { place: 1, tickets: 99.9 },
      { place: 2, tickets: -5 },
      { place: 3, tickets: 5e9 },
    ],
  });
  expect(tiers.map((t) => t.tickets)).toEqual([99, 0, 1000000]);
});

test('invalid prize kinds and amounts become null; amounts round to cents', () => {
  const { tiers } = sanitizeRewards({
    tiers: [
      { place: 1, tickets: 1, prize: { kind: 'car', amount: 10 } },
      { place: 2, tickets: 1, prize: { kind: 'cash', amount: 0 } },
      { place: 3, tickets: 1, prize: { kind: 'bonus', amount: '20.456' } },
    ],
  });
  expect(tiers[0].prize).toBeNull();
  expect(tiers[1].prize).toBeNull();
  expect(tiers[2].prize).toEqual({ kind: 'bonus', amount: 20.46 });
});

test('prize amounts over the cap are dropped', () => {
  const { tiers } = sanitizeRewards({
    tiers: [{ place: 1, tickets: 0, prize: { kind: 'cash', amount: 100001 } }],
  });
  expect(tiers[0].prize).toBeNull();
});

test('1st and 2nd are always present; duplicates and bad places are dropped', () => {
  const { tiers } = sanitizeRewards({
    tiers: [
      { place: 2, tickets: 50 },
      { place: 2, tickets: 999 },
      { place: 4, tickets: 1 },
      { place: 'x' },
    ],
  });
  expect(tiers).toEqual([
    { place: 1, tickets: 0, prize: null },
    { place: 2, tickets: 50, prize: null },
  ]);
});

test('missing input still yields 1st and 2nd', () => {
  expect(sanitizeRewards(undefined).tiers.map((t) => t.place)).toEqual([1, 2]);
});

test('prize labels', () => {
  expect(prizeLabel({ kind: 'cash', amount: 10 })).toBe('$10');
  expect(prizeLabel({ kind: 'cash', amount: 12.5 })).toBe('$12.50');
  expect(prizeLabel({ kind: 'bonus', amount: 1500 })).toBe('Bonus buy $1,500');
  expect(prizeLabel(null)).toBeNull();
});

test('place labels', () => {
  expect([1, 2, 3, 4].map(placeLabel)).toEqual(['1st', '2nd', '3rd', '4th']);
});

test('tierPrize reads new and legacy tiers', () => {
  expect(tierPrize({ place: 1, tickets: 0, prize: { kind: 'bonus', amount: 20 } })).toEqual({
    kind: 'bonus',
    amount: 20,
    label: 'Bonus buy $20',
  });
  expect(tierPrize({ place: 1, tickets: 0, cashLabel: '$25 PayPal' })).toEqual({
    kind: 'cash',
    amount: null,
    label: '$25 PayPal',
  });
  expect(tierPrize({ place: 2, tickets: 50, prize: null })).toBeNull();
});
