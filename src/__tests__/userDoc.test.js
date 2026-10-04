import { missingStarterFields } from '../../api/_lib/userDoc';

const NOW = { __op: 'serverTimestamp' };

test('a new user gets every starter field', () => {
  expect(missingStarterFields({}, 'tw1', NOW)).toEqual({
    twitchId: 'tw1',
    tickets: 0,
    totalEarned: 0,
    totalSpent: 0,
    lastDailyClaimAt: null,
    watchMinutes: 0,
    createdAt: NOW,
  });
  expect(missingStarterFields(undefined, 'tw1', NOW)).toEqual(missingStarterFields({}, 'tw1', NOW));
});

test('a doc a prediction settle made keeps its tickets and gets the rest', () => {
  const settleMade = { tickets: 150, totalEarned: 150, updatedAt: 'then' };
  expect(missingStarterFields(settleMade, 'tw1', NOW)).toEqual({
    twitchId: 'tw1',
    totalSpent: 0,
    lastDailyClaimAt: null,
    watchMinutes: 0,
    createdAt: NOW,
  });
});

test('a full doc gets nothing, and a null field counts as present', () => {
  const full = {
    twitchId: 'tw1',
    tickets: 5,
    totalEarned: 9,
    totalSpent: 4,
    lastDailyClaimAt: null,
    watchMinutes: 30,
    createdAt: 'then',
  };
  expect(missingStarterFields(full, 'tw1', NOW)).toEqual({});
});
