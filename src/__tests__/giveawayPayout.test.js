import { payoutRedemptionUpdate } from '../../api/_lib/giveawayPayout';

const NOW = { __op: 'serverTimestamp' };
const FIELDS = {
  itemName: '$100 bonus buy · Gates · paid $450',
  payout: 450,
  buyAmount: 100,
  slotName: 'Gates',
  actor: 'owner@test',
  now: NOW,
};
const PAYOUT_ONLY = {
  itemName: '$100 bonus buy · Gates · paid $450',
  payout: 450,
  buyAmount: 100,
  slotName: 'Gates',
};

test('a pending redemption is fulfilled by the payout', () => {
  expect(payoutRedemptionUpdate({ status: 'pending' }, FIELDS)).toEqual({
    ...PAYOUT_ONLY,
    status: 'fulfilled',
    fulfilledAt: NOW,
    fulfilledBy: 'owner@test',
  });
});

test('fulfilled and cancelled redemptions keep their status and take only the numbers', () => {
  expect(payoutRedemptionUpdate({ status: 'fulfilled' }, FIELDS)).toEqual(PAYOUT_ONLY);
  expect(payoutRedemptionUpdate({ status: 'cancelled' }, FIELDS)).toEqual(PAYOUT_ONLY);
});

test('a missing slot or buy amount is stored as null', () => {
  const update = payoutRedemptionUpdate({ status: 'fulfilled' }, { ...FIELDS, slotName: '', buyAmount: undefined });
  expect(update.slotName).toBeNull();
  expect(update.buyAmount).toBeNull();
});
