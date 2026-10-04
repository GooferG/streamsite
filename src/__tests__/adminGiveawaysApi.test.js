/**
 * @jest-environment node
 */
import handler from '../../api/admin/giveaways';
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
jest.mock('../../api/_lib/twitchChat.js', () => ({ sendChannelMessage: jest.fn() }));

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

function seedGiveaway(id, data = {}) {
  __fake.seed(`giveaways/${id}`, {
    status: 'open',
    winners: [],
    skippedIds: [],
    winner: null,
    winnerTwitchId: null,
    rolledAt: null,
    announcedPick: null,
    playing: null,
    entryCount: 2,
    ...data,
  });
}

function seedEntry(gid, twitchId) {
  __fake.seed(`giveaways/${gid}/entries/${twitchId}`, {
    twitchId,
    twitchName: twitchId,
    displayName: twitchId.toUpperCase(),
    weight: 1,
    source: 'chat',
    registered: false,
  });
}

beforeEach(() => __fake.reset());

test('two closes at once: one closes, the other sees NOT_OPEN', async () => {
  seedGiveaway('g1');
  const [a, b] = await Promise.all([call({ action: 'close', id: 'g1' }), call({ action: 'close', id: 'g1' })]);
  expect([a.statusCode, b.statusCode].sort()).toEqual([200, 400]);
  expect([a.body, b.body]).toContainEqual({ error: 'NOT_OPEN' });
  expect(__fake.read('giveaways/g1').status).toBe('closed');
});

test('closing a giveaway that is not open answers NOT_OPEN', async () => {
  seedGiveaway('g1', { status: 'closed' });
  const res = await call({ action: 'close', id: 'g1' });
  expect(res.statusCode).toBe(400);
  expect(res.body).toEqual({ error: 'NOT_OPEN' });
});

test('roll picks a winner, flips to rolling and clears the old winner chat', async () => {
  seedGiveaway('g1', { status: 'closed' });
  seedEntry('g1', 'tw1');
  __fake.seed('giveaways/g1/winner_messages/m1', { text: 'old pick chatter' });
  const res = await call({ action: 'roll', id: 'g1' });
  expect(res.statusCode).toBe(200);
  expect(res.body.winner.twitchId).toBe('tw1');
  const g = __fake.read('giveaways/g1');
  expect(g.status).toBe('rolling');
  expect(g.winnerTwitchId).toBe('tw1');
  expect(__fake.paths('giveaways/g1/winner_messages')).toEqual([]);
});

// Final review T4: the pick already committed, so a failed chat cleanup must
// not turn it into an error for the caller ("Auto-roll failed: INTERNAL").
test('roll still answers with the winner when clearing the old winner chat fails', async () => {
  seedGiveaway('g1', { status: 'closed' });
  seedEntry('g1', 'tw1');
  __fake.seed('giveaways/g1/winner_messages/m1', { text: 'old pick chatter' });
  const batch = jest.spyOn(__fake.db, 'batch').mockImplementation(() => ({
    delete: () => {},
    commit: () => Promise.reject(new Error('quota')),
  }));
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const res = await call({ action: 'roll', id: 'g1' });
    expect(res.statusCode).toBe(200);
    expect(res.body.winner.twitchId).toBe('tw1');
    expect(__fake.read('giveaways/g1').status).toBe('rolling');
    expect(error).toHaveBeenCalledWith('clear winner stream failed', expect.any(Error));
  } finally {
    batch.mockRestore();
    error.mockRestore();
  }
});

test('two rolls at once: exactly one pick lands, the other gets ROLL_RACE', async () => {
  seedGiveaway('g1', { status: 'closed' });
  seedEntry('g1', 'tw1');
  seedEntry('g1', 'tw2');
  const [a, b] = await Promise.all([call({ action: 'roll', id: 'g1' }), call({ action: 'roll', id: 'g1' })]);
  expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
  expect([a.body, b.body]).toContainEqual({ error: 'ROLL_RACE' });
  const winner = [a, b].find((r) => r.statusCode === 200).body.winner.twitchId;
  expect(__fake.read('giveaways/g1').winnerTwitchId).toBe(winner);
});

function seedPlaying(redemption) {
  seedGiveaway('g1', {
    status: 'playing',
    kind: 'bonus',
    prize: '$100 bonus buy',
    title: 'Sunday',
    buyAmount: 100,
    announcePayout: false,
    winners: [{ twitchId: 'tw1', displayName: 'TW1', redemptionId: 'red1', buyAmount: 100, slotName: 'Gates' }],
    playing: { twitchId: 'tw1' },
  });
  if (redemption) {
    __fake.seed('redemptions/red1', { kind: 'giveaway', cost: 0, itemName: '$100 bonus buy', ...redemption });
  }
}

test('logging a payout fulfils the pending redemption with the real win', async () => {
  seedPlaying({ status: 'pending' });
  const res = await call({ action: 'payout', id: 'g1', amount: 450 });
  expect(res.statusCode).toBe(200);
  const r = __fake.read('redemptions/red1');
  expect(r).toMatchObject({
    status: 'fulfilled',
    fulfilledBy: 'owner@test',
    payout: 450,
    itemName: '$100 bonus buy · Gates · paid $450',
  });
  expect(r.fulfilledAt.toMillis()).toBe(1000000);
});

test('a payout correction updates the amount without re-fulfilling', async () => {
  seedPlaying({ status: 'fulfilled', fulfilledBy: 'mod:bean', fulfilledAt: 'earlier' });
  await call({ action: 'payout', id: 'g1', amount: 500 });
  expect(__fake.read('redemptions/red1')).toMatchObject({
    status: 'fulfilled',
    fulfilledBy: 'mod:bean',
    fulfilledAt: 'earlier',
    payout: 500,
  });
});

test('a cancelled redemption stays cancelled when a payout is logged', async () => {
  seedPlaying({ status: 'cancelled' });
  await call({ action: 'payout', id: 'g1', amount: 450 });
  const r = __fake.read('redemptions/red1');
  expect(r.status).toBe('cancelled');
  expect(r.payout).toBe(450);
  expect(r.fulfilledAt).toBeUndefined();
});

test('a missing redemption is left alone', async () => {
  seedPlaying(null);
  const res = await call({ action: 'payout', id: 'g1', amount: 450 });
  expect(res.statusCode).toBe(200);
  expect(__fake.read('redemptions/red1')).toBeUndefined();
});

test('a failed redemption write never fails the payout', async () => {
  seedPlaying({ status: 'pending' });
  const real = __fake.db.runTransaction;
  const tx = jest
    .spyOn(__fake.db, 'runTransaction')
    .mockImplementationOnce(real)
    .mockImplementationOnce(() => Promise.reject(new Error('quota')));
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const res = await call({ action: 'payout', id: 'g1', amount: 450 });
    expect(res.statusCode).toBe(200);
    expect(__fake.read('giveaways/g1').winners[0].payout).toBe(450);
    expect(__fake.read('redemptions/red1').status).toBe('pending');
    expect(error).toHaveBeenCalledWith('redemption payout update failed', expect.any(Error));
  } finally {
    tx.mockRestore();
    error.mockRestore();
  }
});
