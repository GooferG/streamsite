/**
 * @jest-environment node
 */
import handler from '../../api/admin/hunts';
import { __fake } from '../../api/_lib/firebaseAdmin.js';
import { sendChannelMessage } from '../../api/_lib/twitchChat.js';

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
jest.mock('../../api/_lib/communityHunts.js', () => ({
  ...jest.requireActual('../../api/_lib/communityHunts.js'),
  getCurrentHunt: jest.fn(),
  getHunt: jest.fn(),
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

const ts = (ms) => __fake.Timestamp.fromMillis(ms);

function seedRound(id, data = {}) {
  __fake.seed(`hunts/${id}`, {
    title: 'Friday',
    source: 'manual',
    manualTotalCost: 500,
    bonusHuntSnapshot: null,
    acceptPredictions: true,
    acceptSuggestions: false,
    rewards: {
      tiers: [
        { place: 1, tickets: 100, prize: { kind: 'cash', amount: 10 } },
        { place: 2, tickets: 50, prize: null },
      ],
    },
    announce: false,
    announced: { opened: null, locked: null, results: null },
    status: 'locked',
    entryCount: 0,
    winners: [],
    ...data,
  });
}

function seedEntry(roundId, twitchId, payoutGuess, ms) {
  __fake.seed(`hunts/${roundId}/entries/${twitchId}`, {
    twitchId,
    twitchName: twitchId,
    displayName: twitchId.toUpperCase(),
    profileImageUrl: null,
    payoutGuess,
    submittedAt: ts(ms),
    lastEditAt: ts(ms),
    editCount: 1,
  });
}

beforeEach(() => {
  __fake.reset();
  sendChannelMessage.mockResolvedValue({ ok: true });
});

test('create refuses while a prediction round is open', async () => {
  seedRound('r1', { status: 'open' });
  const res = await call({ action: 'create', title: 'Next', source: 'manual', rewards: {} });
  expect(res.statusCode).toBe(400);
  expect(res.body).toEqual({ error: 'ROUND_ACTIVE' });
  expect(__fake.paths('hunts')).toEqual(['hunts/r1']);
});

test('a suggestion-only round does not block create; rewards are sanitized', async () => {
  seedRound('s1', { status: 'open', acceptPredictions: false, acceptSuggestions: true });
  const res = await call({
    action: 'create',
    title: 'Next',
    source: 'manual',
    manualTotalCost: 500,
    rewards: { type: 'cash', tiers: [{ place: 1, tickets: 0, prize: { kind: 'cash', amount: 10 } }] },
  });
  expect(res.statusCode).toBe(200);
  const round = __fake.read(`hunts/${res.body.id}`);
  expect(round.status).toBe('open');
  expect(round.announce).toBe(true);
  expect(round.rewards).toEqual({
    tiers: [
      { place: 1, tickets: 0, prize: { kind: 'cash', amount: 10 } },
      { place: 2, tickets: 0, prize: null },
    ],
  });
});

test('preview_settle needs a locked round and writes nothing', async () => {
  seedRound('r1', { status: 'open' });
  const open = await call({ action: 'preview_settle', id: 'r1', actualPayout: 1000 });
  expect(open.statusCode).toBe(400);
  expect(open.body).toEqual({ error: 'NOT_LOCKED' });

  seedRound('r1', { status: 'locked' });
  seedEntry('r1', 'tw1', 990, 1);
  seedEntry('r1', 'tw2', 1500, 2);
  const before = __fake.snapshot();
  const res = await call({ action: 'preview_settle', id: 'r1', actualPayout: 1000 });
  expect(res.statusCode).toBe(200);
  expect(res.body.entryCount).toBe(2);
  expect(res.body.placements[0]).toMatchObject({
    place: 1,
    twitchId: 'tw1',
    diff: 10,
    prize: { tickets: 100, label: '$10' },
  });
  expect(res.body.placements[1]).toMatchObject({ place: 2, twitchId: 'tw2', prize: { tickets: 50, label: null } });
  expect(__fake.snapshot()).toEqual(before);
});

test('settle refuses an open round', async () => {
  seedRound('r1', { status: 'open' });
  const res = await call({ action: 'settle', id: 'r1', actualPayout: 1000 });
  expect(res.statusCode).toBe(400);
  expect(res.body).toEqual({ error: 'NOT_LOCKED' });
});

test('settle rejects an empty payout', async () => {
  seedRound('r1');
  const res = await call({ action: 'settle', id: 'r1', actualPayout: '' });
  expect(res.statusCode).toBe(400);
  expect(__fake.read('hunts/r1').status).toBe('locked');
});

// Review Focus 5: a winner without a users doc still gets paid.
test('settle pays tickets, files the prize and settles; a second settle pays nothing', async () => {
  seedRound('r1');
  seedEntry('r1', 'tw1', 990, 1);
  seedEntry('r1', 'tw2', 1500, 2);
  __fake.seed('users/tw2', { tickets: 5, totalEarned: 5 });

  const res = await call({ action: 'settle', id: 'r1', actualPayout: 1000 });
  expect(res.statusCode).toBe(200);
  expect(__fake.read('users/tw1')).toMatchObject({ tickets: 100, totalEarned: 100 });
  expect(__fake.read('users/tw2')).toMatchObject({ tickets: 55, totalEarned: 55 });
  expect(__fake.paths('ticket_ledger')).toHaveLength(2);
  const [redemptionPath] = __fake.paths('redemptions');
  expect(__fake.read(redemptionPath)).toMatchObject({
    userId: 'tw1',
    kind: 'prediction',
    status: 'pending',
    note: '$10',
    prizeKind: 'cash',
    prizeAmount: 10,
    itemName: 'Friday · 1st place',
    cost: 0,
    predictionRoundId: 'r1',
  });
  const round = __fake.read('hunts/r1');
  expect(round.status).toBe('settled');
  expect(round.actual).toEqual({ payout: 1000 });
  expect(round.winners.map((w) => w.twitchId)).toEqual(['tw1', 'tw2']);
  expect(round.winners[0].redemptionId).toBe(redemptionPath.split('/')[1]);
  expect(round.winners[1].redemptionId).toBeNull();

  const again = await call({ action: 'settle', id: 'r1', actualPayout: 1000 });
  expect(again.statusCode).toBe(400);
  expect(again.body).toEqual({ error: 'ALREADY_SETTLED' });
  expect(__fake.paths('ticket_ledger')).toHaveLength(2);
  expect(__fake.read('users/tw1').tickets).toBe(100);
});

// Review Focus 1: rounds opened before this change keep their cash label.
test('settle keeps a legacy cashLabel prize', async () => {
  seedRound('r1', {
    rewards: {
      type: 'both',
      tiers: [
        { place: 1, tickets: 100, cashLabel: '$25 PayPal' },
        { place: 2, tickets: 50, cashLabel: null },
      ],
    },
  });
  seedEntry('r1', 'tw1', 1000, 1);
  const res = await call({ action: 'settle', id: 'r1', actualPayout: 1000 });
  expect(res.statusCode).toBe(200);
  const [redemptionPath] = __fake.paths('redemptions');
  expect(__fake.read(redemptionPath).note).toBe('$25 PayPal');
  expect(__fake.read('users/tw1').tickets).toBe(100);
});

// Review Focus 5: a dead hunt can pay out 0.
test('a payout of 0 settles', async () => {
  seedRound('r1');
  seedEntry('r1', 'tw1', 0, 1);
  const res = await call({ action: 'settle', id: 'r1', actualPayout: 0 });
  expect(res.statusCode).toBe(200);
  expect(__fake.read('hunts/r1').winners[0]).toMatchObject({ twitchId: 'tw1', diff: 0 });
});
