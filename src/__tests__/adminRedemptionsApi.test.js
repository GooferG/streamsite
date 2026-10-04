/**
 * @jest-environment node
 */
import handler from '../../api/admin/redemptions';
import { __fake } from '../../api/_lib/firebaseAdmin.js';

jest.mock('../../api/_lib/firebaseAdmin.js', () => {
  const { createFakeFirestore } = require('../test/fakeFirestore');
  const fake = createFakeFirestore();
  return { adminDb: fake.db, FieldValue: fake.FieldValue, Timestamp: fake.Timestamp, __fake: fake };
});
jest.mock('../../api/_lib/verifyAuth.js', () => ({
  applyCors: () => {},
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

async function call(body) {
  const res = mockRes();
  await handler({ method: 'POST', headers: {}, body }, res);
  return res;
}

const STORE_ORDER = {
  userId: 'tw1',
  itemId: 'item1',
  itemName: 'Pick a Slot',
  cost: 1500,
  kind: 'stream',
  status: 'pending',
};
const PRIZE = {
  userId: 'tw9',
  itemId: 'g1',
  itemName: '$100 bonus buy',
  cost: 0,
  kind: 'giveaway',
  status: 'pending',
};

beforeEach(() => __fake.reset());

test('fulfil marks a pending redemption fulfilled', async () => {
  __fake.seed('redemptions/r1', STORE_ORDER);
  const res = await call({ id: 'r1', action: 'fulfill', note: 'played it' });
  expect(res.statusCode).toBe(200);
  expect(__fake.read('redemptions/r1')).toMatchObject({
    status: 'fulfilled',
    note: 'played it',
    fulfilledBy: 'owner@test',
  });
});

test('fulfil never overwrites a refund another mod already made', async () => {
  __fake.seed('redemptions/r1', { ...STORE_ORDER, status: 'cancelled', cancelledBy: 'mod:bean' });
  const res = await call({ id: 'r1', action: 'fulfill' });
  expect(res.statusCode).toBe(400);
  expect(res.body).toEqual({ error: 'NOT_PENDING' });
  const r = __fake.read('redemptions/r1');
  expect(r).toMatchObject({ status: 'cancelled', cancelledBy: 'mod:bean' });
  expect(r.fulfilledAt).toBeUndefined();
});

test('fulfil on a redemption that is gone answers NOT_FOUND', async () => {
  const res = await call({ id: 'nope', action: 'fulfill' });
  expect(res.statusCode).toBe(404);
  expect(res.body).toEqual({ error: 'NOT_FOUND' });
  expect(__fake.read('redemptions/nope')).toBeUndefined();
});

test('a fulfil and a refund at once: one wins, and the tickets match the outcome', async () => {
  __fake.seed('redemptions/r1', STORE_ORDER);
  __fake.seed('users/tw1', { tickets: 0, totalSpent: 1500 });
  const [a, b] = await Promise.all([
    call({ id: 'r1', action: 'fulfill' }),
    call({ id: 'r1', action: 'cancel' }),
  ]);
  expect([a.statusCode, b.statusCode].sort()).toEqual([200, 400]);
  const { status } = __fake.read('redemptions/r1');
  expect(__fake.read('users/tw1').tickets).toBe(status === 'cancelled' ? 1500 : 0);
});

test('cancelling a store order refunds the tickets and restores stock', async () => {
  __fake.seed('redemptions/r1', STORE_ORDER);
  __fake.seed('users/tw1', { tickets: 100, totalSpent: 1500 });
  __fake.seed('store_items/item1', { stock: 4 });
  const res = await call({ id: 'r1', action: 'cancel' });
  expect(res.statusCode).toBe(200);
  expect(__fake.read('redemptions/r1')).toMatchObject({ status: 'cancelled', cancelledBy: 'owner@test' });
  expect(__fake.read('users/tw1')).toMatchObject({ tickets: 1600, totalSpent: 0 });
  expect(__fake.read('store_items/item1').stock).toBe(5);
  const ledger = __fake.paths('ticket_ledger').map((p) => __fake.read(p));
  expect(ledger).toEqual([expect.objectContaining({ userId: 'tw1', delta: 1500, reason: 'refund', refId: 'r1' })]);
});

test('cancelling a zero-cost prize needs no user doc and writes no ledger row', async () => {
  __fake.seed('redemptions/r2', PRIZE);
  const res = await call({ id: 'r2', action: 'cancel' });
  expect(res.statusCode).toBe(200);
  expect(__fake.read('redemptions/r2')).toMatchObject({ status: 'cancelled', cancelledBy: 'owner@test' });
  expect(__fake.read('users/tw9')).toBeUndefined();
  expect(__fake.paths('ticket_ledger')).toEqual([]);
});
