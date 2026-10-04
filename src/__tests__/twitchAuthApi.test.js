/**
 * @jest-environment node
 */
import handler from '../../api/twitch-auth';
import { __fake } from '../../api/_lib/firebaseAdmin.js';

jest.mock('../../api/_lib/firebaseAdmin.js', () => {
  const { createFakeFirestore } = require('../test/fakeFirestore');
  const fake = createFakeFirestore();
  return {
    adminDb: fake.db,
    FieldValue: fake.FieldValue,
    adminAuth: { createCustomToken: async () => 'firebase-token' },
    __fake: fake,
  };
});
jest.mock('../../api/_lib/watchtimeStore.js', () => ({ claimWatchBank: async () => null }));

const TWITCH_USER = { id: 'tw1', login: 'viewer', display_name: 'Viewer', profile_image_url: 'https://img/v.png' };

function mockRes() {
  const res = { headers: {}, statusCode: 200, body: undefined };
  res.setHeader = (k, v) => {
    res.headers[k] = v;
  };
  res.status = (c) => {
    res.statusCode = c;
    return res;
  };
  res.json = (b) => {
    res.body = b;
    return res;
  };
  res.end = () => res;
  return res;
}

async function login() {
  const res = mockRes();
  await handler({ method: 'POST', body: { code: 'c', redirect_uri: 'http://localhost/twitch-callback' } }, res);
  return res;
}

beforeEach(() => {
  __fake.reset();
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [TWITCH_USER] }) });
});

test('first login creates the full starter doc', async () => {
  const res = await login();
  expect(res.statusCode).toBe(200);
  const user = __fake.read('users/tw1');
  expect(user).toMatchObject({
    twitchId: 'tw1',
    twitchName: 'viewer',
    displayName: 'Viewer',
    profileImageUrl: 'https://img/v.png',
    tickets: 0,
    totalEarned: 0,
    totalSpent: 0,
    lastDailyClaimAt: null,
    watchMinutes: 0,
  });
  expect(user.createdAt.toMillis()).toBe(1000000);
});

test('a doc a prediction settle made first gets its missing fields and keeps its tickets', async () => {
  __fake.seed('users/tw1', { tickets: 150, totalEarned: 150, updatedAt: 'then' });
  await login();
  const user = __fake.read('users/tw1');
  expect(user).toMatchObject({
    twitchId: 'tw1',
    twitchName: 'viewer',
    tickets: 150,
    totalEarned: 150,
    totalSpent: 0,
    lastDailyClaimAt: null,
    watchMinutes: 0,
  });
  expect(user.createdAt.toMillis()).toBe(1000000);
});

test('a returning user keeps every field and gets a fresh profile', async () => {
  __fake.seed('users/tw1', {
    twitchId: 'tw1',
    twitchName: 'old',
    displayName: 'Old',
    tickets: 9,
    totalEarned: 20,
    totalSpent: 11,
    lastDailyClaimAt: 'yesterday',
    watchMinutes: 300,
    createdAt: 'long ago',
  });
  await login();
  expect(__fake.read('users/tw1')).toMatchObject({
    twitchName: 'viewer',
    displayName: 'Viewer',
    tickets: 9,
    totalSpent: 11,
    lastDailyClaimAt: 'yesterday',
    watchMinutes: 300,
    createdAt: 'long ago',
  });
});
