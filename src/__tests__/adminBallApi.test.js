/**
 * @jest-environment node
 */
import handler from '../../api/admin/ball';
import { __fake } from '../../api/_lib/firebaseAdmin.js';
import { sendChannelMessage } from '../../api/_lib/twitchChat.js';
import { CommunityHuntsError, getHunt } from '../../api/_lib/communityHunts.js';

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
  getHunt: jest.fn(),
}));

const NOW = 5_000_000;

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
const round = (id = 'r1') => __fake.read(`ball_rounds/${id}`);

function seedRound(id, data = {}) {
  __fake.seed(`ball_rounds/${id}`, {
    status: 'open',
    prize: { tickets: 200, prize: { kind: 'cash', amount: 5 } },
    requireFollow: true,
    rack: [],
    lastDrawAt: null,
    huntId: null,
    results: null,
    winner: null,
    announced: { opened: null, draws: {}, scratches: {}, results: null },
    ...data,
  });
}
function seedBall(roundId, twitchId, data = {}) {
  __fake.seed(`ball_rounds/${roundId}/balls/${twitchId}`, {
    twitchId,
    twitchName: twitchId,
    displayName: twitchId.toUpperCase(),
    slotId: `slot-${twitchId}`,
    slotName: `Slot ${twitchId}`,
    thumb: null,
    status: 'drum',
    drawNo: null,
    ...data,
  });
}
const entry = (drawNo, twitchId, extra = {}) => ({
  drawNo,
  twitchId,
  twitchName: twitchId,
  displayName: twitchId.toUpperCase(),
  slotId: `slot-${twitchId}`,
  slotName: `Slot ${twitchId}`,
  thumb: null,
  drawnAt: ts(NOW - 60_000),
  scratched: false,
  ...extra,
});

beforeEach(() => {
  __fake.reset();
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
  sendChannelMessage.mockResolvedValue({ ok: true });
  getHunt.mockResolvedValue({ id: 'h1', bonuses: [] });
});
afterEach(() => {
  Date.now.mockRestore();
});

describe('open', () => {
  test('refuses while a round is open or closed; a settled one does not block', async () => {
    seedRound('r0', { status: 'closed' });
    expect((await call({ action: 'open', prize: { tickets: 100 } })).body).toEqual({ error: 'ROUND_ACTIVE' });
    __fake.reset();
    seedRound('r0', { status: 'settled' });
    expect((await call({ action: 'open', prize: { tickets: 100 } })).statusCode).toBe(200);
  });

  test('needs a prize', async () => {
    const res = await call({ action: 'open', prize: { tickets: 0, prize: null } });
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'INVALID_PRIZE' });
  });

  test('writes the round and posts the opening line once', async () => {
    const res = await call({ action: 'open', prize: { tickets: 200, prize: { kind: 'cash', amount: 5 } }, requireFollow: false });
    expect(res.body).toMatchObject({ ok: true, announce: { posted: true } });
    const r = round(res.body.id);
    expect(r).toMatchObject({
      status: 'open',
      prize: { tickets: 200, prize: { kind: 'cash', amount: 5 } },
      requireFollow: false,
      rack: [],
      huntId: null,
      openedBy: 'owner@test',
    });
    expect(r.announced.opened).toBeTruthy();
    expect(sendChannelMessage).toHaveBeenCalledWith(
      '🎱 Goofer Ball is open! Type !slot <slot name> to call one in. Top multi wins 200 tickets + $5. Exact names: goofer.tv/gamba/ball'
    );
    await call({ action: 'announce', id: res.body.id, event: 'opened' });
    expect(sendChannelMessage).toHaveBeenCalledTimes(1);
  });

  test('a chat failure still opens the round and frees the claim for a retry', async () => {
    sendChannelMessage.mockRejectedValue(new Error('CHAT_DROPPED:x'));
    const res = await call({ action: 'open', prize: { tickets: 50 } });
    expect(res.statusCode).toBe(200);
    expect(res.body.announce).toEqual({ posted: false, reason: 'CHAT_DROPPED:x' });
    expect(round(res.body.id).announced.opened).toBeNull();
  });
});

describe('draw', () => {
  test('needs an open round and someone in the drum', async () => {
    seedRound('r1', { status: 'closed' });
    expect((await call({ action: 'draw', id: 'r1' })).body).toEqual({ error: 'NOT_OPEN' });
    seedRound('r1');
    seedBall('r1', 'a', { status: 'drawn', drawNo: 1 });
    expect((await call({ action: 'draw', id: 'r1' })).body).toEqual({ error: 'EMPTY_DRUM' });
  });

  test('draws a drum ball onto the rack', async () => {
    seedRound('r1', { rack: [entry(1, 'a')] });
    seedBall('r1', 'a', { status: 'drawn', drawNo: 1 });
    seedBall('r1', 'b', { status: 'scratched', drawNo: null });
    seedBall('r1', 'c', { slotName: 'Gates of Olympus', thumb: 'https://img/goo.png' });
    const res = await call({ action: 'draw', id: 'r1' });
    expect(res.body).toMatchObject({ ok: true, entry: { drawNo: 2, twitchId: 'c', slotName: 'Gates of Olympus', drawnAt: NOW } });
    const r = round();
    expect(r.rack).toHaveLength(2);
    expect(r.rack[1]).toMatchObject({ drawNo: 2, twitchId: 'c', displayName: 'C', slotId: 'slot-c', thumb: 'https://img/goo.png', scratched: false });
    expect(r.rack[1].drawnAt.toMillis()).toBe(NOW);
    expect(r.lastDrawAt.toMillis()).toBe(NOW);
    expect(__fake.read('ball_rounds/r1/balls/c')).toMatchObject({ status: 'drawn', drawNo: 2 });
    expect(sendChannelMessage).not.toHaveBeenCalled();
  });

  test('refuses while the last reveal is still playing', async () => {
    seedRound('r1', { lastDrawAt: ts(NOW - 1000) });
    seedBall('r1', 'a');
    const busy = await call({ action: 'draw', id: 'r1' });
    expect(busy.statusCode).toBe(409);
    expect(busy.body).toEqual({ error: 'DRAW_BUSY' });
    seedRound('r1', { lastDrawAt: ts(NOW - 8000) });
    expect((await call({ action: 'draw', id: 'r1' })).statusCode).toBe(200);
  });
});

describe('scratch', () => {
  test('marks the rack, the ball and the claim, and posts the scratch line', async () => {
    seedRound('r1', { rack: [entry(1, 'a', { slotName: 'Gates of Olympus' })] });
    seedBall('r1', 'a', { status: 'drawn', drawNo: 1 });
    __fake.seed('ball_rounds/r1/claims/slot-a', { twitchId: 'a', scratched: false });
    const res = await call({ action: 'scratch', id: 'r1', drawNo: 1 });
    expect(res.body).toMatchObject({ ok: true, entry: { drawNo: 1, scratched: true }, announce: { posted: true } });
    expect(round().rack[0].scratched).toBe(true);
    expect(__fake.read('ball_rounds/r1/balls/a').status).toBe('scratched');
    expect(__fake.read('ball_rounds/r1/claims/slot-a')).toMatchObject({ twitchId: 'a', scratched: true });
    expect(sendChannelMessage).toHaveBeenCalledWith("🎱 Ball 1 scratched (Gates of Olympus isn't available tonight). @A, call another slot.");
    expect((await call({ action: 'scratch', id: 'r1', drawNo: 1 })).body).toEqual({ error: 'ALREADY_SCRATCHED' });
    expect((await call({ action: 'scratch', id: 'r1', drawNo: 9 })).body).toEqual({ error: 'NOT_DRAWN' });
  });

  test('refuses while that draw is still revealing, allows after', async () => {
    seedRound('r1', { rack: [entry(1, 'a', { drawnAt: ts(NOW - 7999) })] });
    seedBall('r1', 'a', { status: 'drawn', drawNo: 1 });
    const early = await call({ action: 'scratch', id: 'r1', drawNo: 1 });
    expect(early.statusCode).toBe(409);
    expect(early.body).toEqual({ error: 'REVEAL_PLAYING' });
    expect(round().rack[0].scratched).toBe(false);
    Date.now.mockReturnValue(NOW + 1);
    expect((await call({ action: 'scratch', id: 'r1', drawNo: 1 })).statusCode).toBe(200);
  });

  test('nothing changes on a settled round', async () => {
    seedRound('r1', { status: 'settled', rack: [entry(1, 'a')] });
    expect((await call({ action: 'scratch', id: 'r1', drawNo: 1 })).body).toEqual({ error: 'FINAL' });
  });
});

test('close, reopen and cancel', async () => {
  seedRound('r1');
  expect((await call({ action: 'reopen', id: 'r1' })).body).toEqual({ error: 'NOT_CLOSED' });
  await call({ action: 'close', id: 'r1' });
  expect(round().status).toBe('closed');
  expect(round().closedAt).toBeTruthy();
  expect((await call({ action: 'close', id: 'r1' })).body).toEqual({ error: 'NOT_OPEN' });
  await call({ action: 'reopen', id: 'r1' });
  expect(round()).toMatchObject({ status: 'open', closedAt: null });
  await call({ action: 'cancel', id: 'r1' });
  expect(round().status).toBe('cancelled');
  expect((await call({ action: 'cancel', id: 'r1' })).body).toEqual({ error: 'FINAL' });
  expect((await call({ action: 'close', id: 'nope' })).statusCode).toBe(404);
});

test('update_prize', async () => {
  seedRound('r1', { status: 'closed' });
  const res = await call({ action: 'update_prize', id: 'r1', prize: { tickets: '300', prize: { kind: 'bonus', amount: 20 } } });
  expect(res.body).toEqual({ ok: true, prize: { tickets: 300, prize: { kind: 'bonus', amount: 20 } } });
  expect(round().prize).toEqual({ tickets: 300, prize: { kind: 'bonus', amount: 20 } });
  expect((await call({ action: 'update_prize', id: 'r1', prize: {} })).body).toEqual({ error: 'INVALID_PRIZE' });
  seedRound('r1', { status: 'settled' });
  expect((await call({ action: 'update_prize', id: 'r1', prize: { tickets: 5 } })).body).toEqual({ error: 'FINAL' });
});

test('link_hunt checks the hunt exists; null unlinks', async () => {
  seedRound('r1');
  expect((await call({ action: 'link_hunt', id: 'r1', huntId: 'h1' })).body).toEqual({ ok: true, huntId: 'h1' });
  expect(getHunt).toHaveBeenCalledWith('h1');
  expect(round().huntId).toBe('h1');
  getHunt.mockRejectedValue(new CommunityHuntsError('NOT_FOUND', 404));
  const missing = await call({ action: 'link_hunt', id: 'r1', huntId: 'zz' });
  expect(missing.statusCode).toBe(404);
  expect(missing.body.error).toBe('HUNT_NOT_FOUND');
  getHunt.mockClear();
  expect((await call({ action: 'link_hunt', id: 'r1', huntId: null })).body).toEqual({ ok: true, huntId: null });
  expect(getHunt).not.toHaveBeenCalled();
  expect(round().huntId).toBeNull();
});

describe('announce draw', () => {
  test('never before the reveal has played; then once', async () => {
    seedRound('r1', { rack: [entry(1, 'a', { drawnAt: ts(NOW - 2000), slotName: 'Sugar Rush' })] });
    const early = await call({ action: 'announce', id: 'r1', event: 'draw', drawNo: 1 });
    expect(early.statusCode).toBe(409);
    expect(early.body).toEqual({ error: 'TOO_EARLY' });
    Date.now.mockReturnValue(NOW + 7000);
    expect((await call({ action: 'announce', id: 'r1', event: 'draw', drawNo: 1 })).body.announce).toEqual({ posted: true });
    expect(sendChannelMessage).toHaveBeenCalledWith('🎱 Ball 1: Sugar Rush, called in by @A');
    expect(round().announced.draws.d1).toBeTruthy();
    expect((await call({ action: 'announce', id: 'r1', event: 'draw', drawNo: 1 })).body.announce).toEqual({ posted: false, reason: 'already' });
    expect(sendChannelMessage).toHaveBeenCalledTimes(1);
  });

  test('a scratched draw is skipped; a failed post frees the claim', async () => {
    seedRound('r1', { rack: [entry(1, 'a', { scratched: true }), entry(2, 'b')] });
    expect((await call({ action: 'announce', id: 'r1', event: 'draw', drawNo: 1 })).body.announce).toEqual({ posted: false, reason: 'scratched' });
    sendChannelMessage.mockRejectedValue(new Error('boom'));
    expect((await call({ action: 'announce', id: 'r1', event: 'draw', drawNo: 2 })).body.announce).toEqual({ posted: false, reason: 'boom' });
    expect(round().announced.draws.d2).toBeNull();
  });

  test('unknown events and results before settle are refused', async () => {
    seedRound('r1');
    expect((await call({ action: 'announce', id: 'r1', event: 'nope' })).body).toEqual({ error: 'INVALID_EVENT' });
    expect((await call({ action: 'announce', id: 'r1', event: 'results' })).body).toEqual({ error: 'NOT_SETTLED' });
  });
});

test('unknown actions', async () => {
  seedRound('r1');
  expect((await call({ action: 'explode', id: 'r1' })).body).toEqual({ error: 'UNKNOWN_ACTION' });
});

describe('payout', () => {
  const RACK = [
    entry(1, 'a', { slotName: 'Gates of Olympus' }),
    entry(2, 'b', { slotName: 'Wanted Dead or a Wild' }),
    entry(3, 'c', { slotName: 'The Dog House', scratched: true }),
    entry(4, 'd', { slotName: 'Sugar Rush 1000' }),
  ];
  const BONUSES = [
    { slot: 'Gates of Olympus', bet: 1, win: 412, multiplier: 412 },
    { slot: 'Wanted Dead or a Wild', bet: 2, win: 176, multiplier: 88 },
    { slot: 'The Dog House', bet: 1, win: 9000, multiplier: 9000 },
    { slot: 'Sugar Rush 1000', bet: 1, win: null, multiplier: null },
  ];

  beforeEach(() => {
    getHunt.mockResolvedValue({ id: 'h1', bonuses: BONUSES });
  });

  test('preview needs a closed round and writes nothing', async () => {
    seedRound('r1', { rack: RACK, huntId: 'h1' });
    expect((await call({ action: 'preview_settle', id: 'r1' })).body).toEqual({ error: 'NOT_CLOSED' });
    seedRound('r1', { status: 'closed', rack: RACK, huntId: 'h1' });
    const before = __fake.snapshot();
    const res = await call({ action: 'preview_settle', id: 'r1', overrides: { 4: { multiplier: '41', win: '41' } } });
    expect(res.body).toMatchObject({ ok: true, huntError: null, winner: { drawNo: 1, multiplier: 412 } });
    expect(res.body.rows.map((r) => [r.drawNo, r.multiplier, r.source])).toEqual([
      [1, 412, 'hunt'],
      [2, 88, 'hunt'],
      [4, 41, 'manual'],
    ]);
    expect(__fake.snapshot()).toEqual(before);
  });

  test('a communityhunts outage still previews from manual numbers', async () => {
    seedRound('r1', { status: 'closed', rack: RACK, huntId: 'h1' });
    getHunt.mockRejectedValue(new CommunityHuntsError('UPSTREAM', 502));
    const res = await call({ action: 'preview_settle', id: 'r1', overrides: { 2: { multiplier: 7 } } });
    expect(res.body).toMatchObject({ huntError: 'COMMUNITYHUNTS_UNAVAILABLE', winner: { drawNo: 2, multiplier: 7 } });
  });

  test('settle pays the top multiplier: tickets, ledger, redemption, results; only once', async () => {
    seedRound('r1', { status: 'closed', rack: RACK, huntId: 'h1' });
    const res = await call({ action: 'settle', id: 'r1' });
    expect(res.body.ok).toBe(true);
    const r = round();
    expect(r.status).toBe('settled');
    expect(r.settledBy).toBe('owner@test');
    expect(r.results).toEqual({
      1: { multiplier: 412, win: 412, bet: 1, source: 'hunt' },
      2: { multiplier: 88, win: 176, bet: 2, source: 'hunt' },
    });
    expect(r.winner).toMatchObject({ drawNo: 1, twitchId: 'a', displayName: 'A', slotName: 'Gates of Olympus', multiplier: 412, win: 412 });
    expect(__fake.read('users/a')).toMatchObject({ tickets: 200, totalEarned: 200 });
    const [ledger] = __fake.paths('ticket_ledger').map((p) => __fake.read(p));
    expect(ledger).toMatchObject({ userId: 'a', delta: 200, reason: 'goofer_ball', refId: 'r1', note: 'Goofer Ball winner — Gates of Olympus 412x' });
    const [redemption] = __fake.paths('redemptions').map((p) => __fake.read(p));
    expect(redemption).toMatchObject({
      userId: 'a',
      kind: 'goofer_ball',
      status: 'pending',
      cost: 0,
      note: '$5',
      prizeKind: 'cash',
      prizeAmount: 5,
      ballRoundId: 'r1',
      itemName: 'Goofer Ball · Gates of Olympus 412x',
    });
    expect(r.winner.redemptionId).toBe(__fake.paths('redemptions')[0].split('/').pop());
    expect((await call({ action: 'settle', id: 'r1' })).body).toEqual({ error: 'ALREADY_SETTLED' });
    expect(__fake.read('users/a').tickets).toBe(200);
  });

  test('tickets only: no redemption; nothing to rank: NO_RESULTS', async () => {
    seedRound('r1', { status: 'closed', rack: RACK, huntId: 'h1', prize: { tickets: 50, prize: null } });
    await call({ action: 'settle', id: 'r1' });
    expect(__fake.paths('redemptions')).toEqual([]);
    expect(round().winner.redemptionId).toBeNull();
    seedRound('r2', { status: 'closed', rack: [entry(1, 'd', { slotName: 'Sugar Rush 1000' })], huntId: 'h1' });
    expect((await call({ action: 'settle', id: 'r2' })).body).toEqual({ error: 'NO_RESULTS' });
  });

  test('the results line posts only after settle', async () => {
    seedRound('r1', { status: 'closed', rack: RACK, huntId: 'h1' });
    expect((await call({ action: 'announce', id: 'r1', event: 'results' })).body).toEqual({ error: 'NOT_SETTLED' });
    await call({ action: 'settle', id: 'r1' });
    expect((await call({ action: 'announce', id: 'r1', event: 'results' })).body.announce).toEqual({ posted: true });
    expect(sendChannelMessage).toHaveBeenCalledWith("🎱 Tonight's winning ball: Gates of Olympus at 412x. @A wins 200 tickets + $5.");
  });

  const noPayout = () => {
    expect(__fake.read('users/a')).toBeUndefined();
    expect(__fake.paths('ticket_ledger')).toEqual([]);
    expect(__fake.paths('redemptions')).toEqual([]);
  };
  const closedFields = { status: 'closed', rack: RACK, huntId: 'h1' };

  test('a communityhunts outage blocks a partly manual settle, but a fully manual table settles', async () => {
    seedRound('r1', closedFields);
    getHunt.mockRejectedValue(new CommunityHuntsError('UPSTREAM', 502));
    const res = await call({ action: 'settle', id: 'r1', overrides: { 4: { multiplier: 41 } } });
    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({ error: 'COMMUNITYHUNTS_UNAVAILABLE' });
    expect(round().status).toBe('closed');
    noPayout();
    const ok = await call({
      action: 'settle',
      id: 'r1',
      overrides: { 1: { multiplier: 5 }, 2: { multiplier: 9 }, 4: { multiplier: 3 } },
    });
    expect(ok.body.ok).toBe(true);
    expect(round().winner).toMatchObject({ drawNo: 2, multiplier: 9 });
  });

  test('expectDrawNo guards against a changed winner', async () => {
    seedRound('r1', closedFields);
    const bad = await call({ action: 'settle', id: 'r1', expectDrawNo: 2 });
    expect(bad.statusCode).toBe(409);
    expect(bad.body).toEqual({ error: 'WINNER_CHANGED' });
    expect(round().status).toBe('closed');
    noPayout();
    expect((await call({ action: 'settle', id: 'r1', expectDrawNo: 1 })).body.ok).toBe(true);
  });

  test('a hunt relinked mid-settle is refused', async () => {
    seedRound('r1', closedFields);
    getHunt.mockImplementation(async () => {
      seedRound('r1', { ...closedFields, huntId: 'h2' });
      return { id: 'h1', bonuses: BONUSES };
    });
    const res = await call({ action: 'settle', id: 'r1' });
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ error: 'HUNT_CHANGED' });
    noPayout();
  });

  test('a round settled mid-settle is refused inside the transaction', async () => {
    seedRound('r1', closedFields);
    getHunt.mockImplementation(async () => {
      seedRound('r1', { ...closedFields, status: 'settled', settledAt: ts(NOW) });
      return { id: 'h1', bonuses: BONUSES };
    });
    expect((await call({ action: 'settle', id: 'r1' })).body).toEqual({ error: 'ALREADY_SETTLED' });
    noPayout();
  });
});
