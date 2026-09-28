import { pickWinners, buildWinners } from '../../api/_lib/predictions';

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

test('a tie goes to whoever settled on their final guess first', () => {
  const entries = [
    // Submitted first but edited last: loses the tie.
    { twitchId: 'editor', payoutGuess: 1100, submittedAt: ts(1), lastEditAt: ts(30) },
    { twitchId: 'steady', payoutGuess: 900, submittedAt: ts(10), lastEditAt: ts(10) },
  ];
  expect(pickWinners(entries, round(1000))[0].twitchId).toBe('steady');
});

test('without lastEditAt a tie falls back to submittedAt', () => {
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

test('buildWinners attaches each tier prize in place order', () => {
  const r = {
    rewards: {
      tiers: [
        { place: 2, tickets: 50, prize: null },
        { place: 1, tickets: 100, prize: { kind: 'cash', amount: 10 } },
      ],
    },
  };
  const entries = [
    { twitchId: 'a', displayName: 'A', payoutGuess: 990, submittedAt: ts(1) },
    { twitchId: 'b', displayName: 'B', payoutGuess: 1500, submittedAt: ts(2) },
  ];
  const [first, second] = buildWinners(entries, r, 1000);
  expect(first).toMatchObject({
    place: 1,
    twitchId: 'a',
    displayName: 'A',
    payoutGuess: 990,
    diff: 10,
    prize: { tickets: 100, kind: 'cash', amount: 10, label: '$10' },
    redemptionId: null,
  });
  expect(second).toMatchObject({
    place: 2,
    twitchId: 'b',
    prize: { tickets: 50, kind: null, amount: null, label: null },
  });
});

test('buildWinners keeps a legacy cashLabel prize and pads empty places', () => {
  const r = {
    rewards: {
      tiers: [
        { place: 1, tickets: 0, cashLabel: '$25 PayPal' },
        { place: 2, tickets: 5 },
      ],
    },
  };
  const out = buildWinners([{ twitchId: 'a', payoutGuess: 1, submittedAt: ts(1) }], r, 1);
  expect(out[0].prize).toEqual({ tickets: 0, kind: 'cash', amount: null, label: '$25 PayPal' });
  expect(out[1]).toBeNull();
});

// Review Focus F3: a legacy round (no `prize` key on its tiers) hid
// ticket/cash inputs behind rewards.type in the old form; the server must
// honor whichever type the admin actually picked instead of paying both.
test('a legacy "cash" round pays no hidden tickets', () => {
  const r = { rewards: { type: 'cash', tiers: [{ place: 1, tickets: 100, cashLabel: '$25' }] } };
  const [first] = buildWinners([{ twitchId: 'a', payoutGuess: 1, submittedAt: ts(1) }], r, 1);
  expect(first.prize).toMatchObject({ tickets: 0, label: '$25' });
});

test('a legacy "tickets" round files no cashLabel prize', () => {
  const r = { rewards: { type: 'tickets', tiers: [{ place: 1, tickets: 100, cashLabel: '$25' }] } };
  const [first] = buildWinners([{ twitchId: 'a', payoutGuess: 1, submittedAt: ts(1) }], r, 1);
  expect(first.prize).toMatchObject({ tickets: 100, label: null });
});

test('a legacy "both" round pays tickets and cash', () => {
  const r = { rewards: { type: 'both', tiers: [{ place: 1, tickets: 100, cashLabel: '$25' }] } };
  const [first] = buildWinners([{ twitchId: 'a', payoutGuess: 1, submittedAt: ts(1) }], r, 1);
  expect(first.prize).toMatchObject({ tickets: 100, label: '$25' });
});

test('a tier with a real prize key is unaffected by rewards.type', () => {
  const r = {
    rewards: { type: 'cash', tiers: [{ place: 1, tickets: 100, prize: { kind: 'cash', amount: 10 } }] },
  };
  const [first] = buildWinners([{ twitchId: 'a', payoutGuess: 1, submittedAt: ts(1) }], r, 1);
  expect(first.prize).toMatchObject({ tickets: 100, kind: 'cash', amount: 10, label: '$10' });
});
