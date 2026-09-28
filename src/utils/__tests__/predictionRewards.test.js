import {
  prizeLabel,
  winnerPrizeLabel,
  rewardSummary,
  defaultRewardsForm,
  rewardsFormFrom,
  lastRewardsRound,
  validateRewardsForm,
  rewardsPayload,
} from '../predictionRewards';

const ROUND = {
  acceptPredictions: true,
  rewards: {
    tiers: [
      { place: 1, tickets: 200, prize: { kind: 'cash', amount: 10 } },
      { place: 2, tickets: 75, prize: null },
      { place: 3, tickets: 0, prize: { kind: 'bonus', amount: 20 } },
    ],
  },
};

test('labels', () => {
  expect(prizeLabel({ kind: 'cash', amount: 12.5 })).toBe('$12.50');
  expect(prizeLabel({ kind: 'bonus', amount: 20 })).toBe('Bonus buy $20');
  expect(winnerPrizeLabel({ tickets: 1, label: 'Bonus buy $20' })).toBe('Bonus buy $20');
  expect(winnerPrizeLabel({ tickets: 1, cashLabel: '$25 PayPal' })).toBe('$25 PayPal');
  expect(winnerPrizeLabel(null)).toBeNull();
});

test('reward summaries', () => {
  expect(rewardSummary({ tickets: 100, prize: { kind: 'cash', amount: 10 } })).toBe('100t + $10 cash');
  expect(rewardSummary({ tickets: 50, prize: null })).toBe('50t');
  expect(rewardSummary({ tickets: 0, prize: { kind: 'bonus', amount: 20 } })).toBe('Bonus buy $20');
  expect(rewardSummary({ tickets: 0, cashLabel: '$25 PayPal' })).toBe('$25 PayPal');
  expect(rewardSummary({ tickets: 0, prize: null })).toBe('No reward');
});

// Review Focus F3: a legacy tier (no `prize` key) honors the round's type.
test('rewardSummary honors a legacy round type for tiers without a prize key', () => {
  expect(rewardSummary({ tickets: 100, cashLabel: '$25' }, 'cash')).toBe('$25');
});

test('the form defaults to 100/50 tickets with 3rd place off', () => {
  const form = defaultRewardsForm();
  expect(form.thirdEnabled).toBe(false);
  expect(form.rows.map((r) => [r.place, r.tickets, r.prizeKind])).toEqual([
    [1, '100', 'none'],
    [2, '50', 'none'],
    [3, '25', 'none'],
  ]);
});

test('the form copies the last round rewards', () => {
  const form = rewardsFormFrom(ROUND);
  expect(form.thirdEnabled).toBe(true);
  expect(form.rows[0]).toEqual({ place: 1, tickets: '200', prizeKind: 'cash', prizeAmount: '10' });
  expect(form.rows[1]).toEqual({ place: 2, tickets: '75', prizeKind: 'none', prizeAmount: '' });
  expect(form.rows[2]).toEqual({ place: 3, tickets: '0', prizeKind: 'bonus', prizeAmount: '20' });
});

test('legacy rounds do not seed the form', () => {
  const legacy = { acceptPredictions: true, rewards: { type: 'tickets', tiers: [{ place: 1, tickets: 5, cashLabel: null }] } };
  expect(rewardsFormFrom(legacy)).toEqual(defaultRewardsForm());
  expect(lastRewardsRound([{ acceptPredictions: false }, legacy, ROUND])).toBe(ROUND);
  expect(lastRewardsRound([])).toBeNull();
});

test('a prize needs an amount', () => {
  const form = defaultRewardsForm();
  form.rows[1].prizeKind = 'cash';
  expect(validateRewardsForm(form)).toMatch(/2nd place/);
  form.rows[1].prizeAmount = '5';
  expect(validateRewardsForm(form)).toBeNull();
  form.rows[2].prizeKind = 'bonus'; // 3rd is off, so it is not checked
  expect(validateRewardsForm(form)).toBeNull();
  form.rows[1].prizeAmount = '100001';
  expect(validateRewardsForm(form)).toMatch(/2nd place/);
});

test('the payload sends tiers without a type', () => {
  const form = rewardsFormFrom(ROUND);
  expect(rewardsPayload(form)).toEqual({
    tiers: [
      { place: 1, tickets: 200, prize: { kind: 'cash', amount: 10 } },
      { place: 2, tickets: 75, prize: null },
      { place: 3, tickets: 0, prize: { kind: 'bonus', amount: 20 } },
    ],
  });
  form.thirdEnabled = false;
  expect(rewardsPayload(form).tiers.map((t) => t.place)).toEqual([1, 2]);
});
