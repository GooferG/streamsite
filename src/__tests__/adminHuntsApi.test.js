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

// Review Focus F1: a settle transaction can land between reopen/lock's read
// and write. The round already shows a settle (settledAt/actual set) even
// though status still says 'locked' — settle must refuse and pay nothing.
test('settle refuses a round already settled behind a stale lock', async () => {
  seedRound('r1', { status: 'locked', settledAt: ts(1), actual: { payout: 5 } });
  const res = await call({ action: 'settle', id: 'r1', actualPayout: 1000 });
  expect(res.statusCode).toBe(400);
  expect(res.body).toEqual({ error: 'ALREADY_SETTLED' });
  expect(__fake.paths('ticket_ledger')).toHaveLength(0);
});

test('reopen refuses a round that has already been settled', async () => {
  seedRound('r1', { status: 'settled', settledAt: ts(1), actual: { payout: 5 } });
  const res = await call({ action: 'reopen', id: 'r1' });
  expect(res.statusCode).toBe(400);
  expect(res.body).toEqual({ error: 'NOT_LOCKED' });
  expect(__fake.read('hunts/r1').status).toBe('settled');
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

test('create posts the opened message once and records it', async () => {
  const res = await call({ action: 'create', title: 'Friday', source: 'manual', manualTotalCost: 500 });
  expect(res.body.announce).toEqual({ posted: true });
  expect(sendChannelMessage).toHaveBeenCalledTimes(1);
  expect(sendChannelMessage.mock.calls[0][0]).toMatch(/^Predictions are open! .*\(\$500 in\)/);
  expect(__fake.read(`hunts/${res.body.id}`).announced.opened).toBeTruthy();
});

test('announce off posts nothing on create or lock', async () => {
  const res = await call({ action: 'create', title: 'Friday', source: 'manual', announce: false });
  expect(res.body.announce).toEqual({ posted: false, reason: 'disabled' });
  const lock = await call({ action: 'lock', id: res.body.id });
  expect(lock.body.announce).toEqual({ posted: false, reason: 'disabled' });
  expect(sendChannelMessage).not.toHaveBeenCalled();
});

test('a suggestion-only round never announces', async () => {
  const res = await call({
    action: 'create',
    title: 'Slots',
    source: 'manual',
    acceptPredictions: false,
    acceptSuggestions: true,
  });
  expect(__fake.read(`hunts/${res.body.id}`).announce).toBe(false);
  expect(sendChannelMessage).not.toHaveBeenCalled();
});

test('rounds from before announcements never post', async () => {
  seedRound('old', { status: 'settled', announce: undefined, announced: undefined });
  const res = await call({ action: 'announce', id: 'old', event: 'results' });
  expect(res.body.announce).toEqual({ posted: false, reason: 'disabled' });
  expect(sendChannelMessage).not.toHaveBeenCalled();
});

test('lock posts the locked message with the guess count, once', async () => {
  seedRound('r1', { status: 'open', announce: true, entryCount: 37 });
  const lock = await call({ action: 'lock', id: 'r1' });
  expect(lock.body.announce).toEqual({ posted: true });
  expect(sendChannelMessage).toHaveBeenCalledWith(
    'Predictions locked. 37 guesses in. Revealed at goofer.tv/gamba/hunts'
  );
  const again = await call({ action: 'announce', id: 'r1', event: 'locked' });
  expect(again.body.announce).toEqual({ posted: false, reason: 'already' });
  expect(sendChannelMessage).toHaveBeenCalledTimes(1);
});

test('reopen clears the locked claim so the next lock posts again', async () => {
  seedRound('r1', { status: 'open', announce: true, entryCount: 3 });
  await call({ action: 'lock', id: 'r1' });
  await call({ action: 'reopen', id: 'r1' });
  expect(__fake.read('hunts/r1').announced.locked).toBeNull();
  await call({ action: 'lock', id: 'r1' });
  expect(sendChannelMessage).toHaveBeenCalledTimes(2);
});

test('a failed post releases the claim so a retry posts', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  seedRound('r1', { status: 'settled', announce: true, actual: { payout: 1843 }, winners: [] });
  sendChannelMessage.mockRejectedValueOnce(new Error('CHAT_DROPPED:spam'));
  const first = await call({ action: 'announce', id: 'r1', event: 'results' });
  expect(first.body.announce).toEqual({ posted: false, reason: 'CHAT_DROPPED:spam' });
  expect(__fake.read('hunts/r1').announced.results).toBeNull();
  const retry = await call({ action: 'announce', id: 'r1', event: 'results' });
  expect(retry.body.announce).toEqual({ posted: true });
  expect(sendChannelMessage).toHaveBeenLastCalledWith('Final payout $1,843. No guesses this round.');
});

// Review Focus F2: a chat problem must never turn an already-written round
// into a 500 for create/lock.
test('lock succeeds and reports posted:false when the chat post fails', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  seedRound('r1', { status: 'open', announce: true, entryCount: 5 });
  sendChannelMessage.mockRejectedValueOnce(new Error('CHAT_DROPPED:spam'));
  const res = await call({ action: 'lock', id: 'r1' });
  expect(res.statusCode).toBe(200);
  expect(__fake.read('hunts/r1').status).toBe('locked');
  expect(res.body.announce.posted).toBe(false);
  expect(__fake.read('hunts/r1').announced.locked).toBeNull();
});

// The claim-release write (after a failed chat post) can itself fail — e.g.
// the round disappears in between. That must be swallowed too, not bubble up
// into a 500 for an already-successful lock.
test('lock survives when the claim-release write also fails', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  seedRound('r1', { status: 'open', announce: true, entryCount: 5 });
  sendChannelMessage.mockImplementationOnce(async () => {
    await __fake.db.collection('hunts').doc('r1').delete();
    throw new Error('CHAT_DROPPED:spam');
  });
  const res = await call({ action: 'lock', id: 'r1' });
  expect(res.statusCode).toBe(200);
  expect(res.body.announce.posted).toBe(false);
});

test('announce checks the event and the round status', async () => {
  seedRound('r1', { status: 'locked', announce: true });
  const early = await call({ action: 'announce', id: 'r1', event: 'results' });
  expect(early.statusCode).toBe(400);
  expect(early.body).toEqual({ error: 'WRONG_STATUS' });
  const bad = await call({ action: 'announce', id: 'r1', event: 'hype' });
  expect(bad.statusCode).toBe(400);
  expect(bad.body).toEqual({ error: 'INVALID_EVENT' });
  expect(sendChannelMessage).not.toHaveBeenCalled();
});
