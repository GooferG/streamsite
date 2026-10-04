/**
 * @jest-environment node
 */
import redeem from '../../api/store/redeem';
import redemptions from '../../api/admin/redemptions';
import { __fake } from '../../api/_lib/firebaseAdmin.js';

jest.mock('../../api/_lib/firebaseAdmin.js', () => {
  const { createFakeFirestore } = require('../test/fakeFirestore');
  const fake = createFakeFirestore();
  return { adminDb: fake.db, FieldValue: fake.FieldValue, Timestamp: fake.Timestamp, __fake: fake };
});
jest.mock('../../api/_lib/verifyAuth.js', () => ({
  applyCors: () => {},
  requireAuth: async () => ({ uid: 'v1' }),
  requireAdmin: async () => ({ email: 'owner@test' }),
}));

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

async function call(handler, body) {
  const res = mockRes();
  await handler({ method: 'POST', headers: {}, body }, res);
  return res;
}

beforeEach(() => {
  __fake.reset();
  __fake.seed('users/v1', { tickets: 2000, displayName: 'GooferFan', twitchName: 'gooferfan' });
  __fake.seed('store_items/blunt', { name: 'Roll a blunt', cost: 420, kind: 'stream', stock: null, active: true });
  __fake.seed('store_items/bonus', { name: 'Bonus buy', cost: 10000, kind: 'stream', stock: 5, active: true });
});

test('an order lands on the public feed with name, item and time only', async () => {
  const res = await call(redeem, { itemId: 'blunt' });
  expect(res.statusCode).toBe(200);
  expect(res.body).toEqual({ ok: true, redemptionId: expect.any(String), kind: 'stream', status: 'pending' });
  const feed = __fake.read('store_public/feed');
  expect(feed.orders).toEqual([
    { id: res.body.redemptionId, name: 'GooferFan', itemName: 'Roll a blunt', at: expect.any(Number) },
  ]);
});

test('the newest order comes first', async () => {
  const first = await call(redeem, { itemId: 'blunt' });
  const second = await call(redeem, { itemId: 'blunt' });
  expect(__fake.read('store_public/feed').orders.map((o) => o.id)).toEqual([
    second.body.redemptionId,
    first.body.redemptionId,
  ]);
});

test('a failed order never reaches the feed', async () => {
  const res = await call(redeem, { itemId: 'bonus' });
  expect(res.statusCode).toBe(400);
  expect(res.body.error).toBe('INSUFFICIENT_TICKETS');
  expect(__fake.read('store_public/feed')).toBeUndefined();
});

test('cancelling a pending order refunds it and takes it off the feed', async () => {
  const res = await call(redeem, { itemId: 'blunt' });
  const cancel = await call(redemptions, { id: res.body.redemptionId, action: 'cancel' });
  expect(cancel.statusCode).toBe(200);
  expect(__fake.read('store_public/feed').orders).toEqual([]);
  expect(__fake.read('users/v1').tickets).toBe(2000);
});
