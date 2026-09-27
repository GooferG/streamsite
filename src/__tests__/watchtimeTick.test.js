/**
 * @jest-environment node
 */
jest.mock('../../api/_lib/twitchBroadcasterToken.js', () => ({
  getAppAccessToken: jest.fn(),
  getBroadcasterAccessToken: jest.fn(),
  helix: jest.fn(),
}));
jest.mock('../../api/_lib/watchtimeStore.js', () => ({
  takeChatMarkers: jest.fn(),
  deleteRefs: jest.fn(),
  openSessionIds: jest.fn(),
  creditSession: jest.fn(),
  settleSession: jest.fn(),
}));

import handler from '../../api/cron/watchtime-tick';
import * as twitch from '../../api/_lib/twitchBroadcasterToken';
import * as store from '../../api/_lib/watchtimeStore';
import { WINDOW_MS } from '../../api/_lib/watchtime';

const RATES = { perWindow: 1, chatBonus: 1 };
// Window numbers for the tick's *current* window. 6000000 % 6 === 0, so the
// window it completes (5999999) is a payout window; 6000001 completes 6000000,
// which is not.
const PAYOUT_TICK = 6000000;
const QUIET_TICK = 6000001;

const ENV = process.env;

function mockRes() {
  const res = { statusCode: 0, body: undefined };
  res.status = (c) => {
    res.statusCode = c;
    return res;
  };
  res.json = (b) => {
    res.body = b;
    return res;
  };
  return res;
}

const req = (authorization = 'Bearer s3cret') => ({ method: 'GET', headers: { authorization } });

function at(window) {
  jest.spyOn(Date, 'now').mockReturnValue(window * WINDOW_MS + 1500);
}

function twitchSays({ live, chatters = [] }) {
  twitch.helix.mockImplementation(async (method, path) => {
    if (path.startsWith('/streams')) return { data: live ? [{ id: live }] : [] };
    if (path.startsWith('/chat/chatters')) return { data: chatters, pagination: {} };
    throw new Error(`unexpected helix call ${path}`);
  });
}

beforeEach(() => {
  process.env = {
    ...ENV,
    CRON_SECRET: 's3cret',
    TWITCH_BROADCASTER_ID: '100',
    TWITCH_BOT_ID: '200',
  };
  twitch.getAppAccessToken.mockResolvedValue('app-token');
  twitch.getBroadcasterAccessToken.mockResolvedValue('user-token');
  store.takeChatMarkers.mockResolvedValue({ chatted: new Map(), refs: ['marker-ref'] });
  store.deleteRefs.mockResolvedValue(undefined);
  store.openSessionIds.mockResolvedValue([]);
  store.creditSession.mockResolvedValue(true);
  store.settleSession.mockResolvedValue({ accounts: 0, banked: 0 });
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(() => {
  process.env = ENV;
});

test('refuses to run without CRON_SECRET', async () => {
  delete process.env.CRON_SECRET;
  const res = mockRes();
  await handler(req(), res);
  expect(res.statusCode).toBe(500);
  expect(twitch.helix).not.toHaveBeenCalled();
});

test('rejects a wrong bearer token', async () => {
  const res = mockRes();
  await handler(req('Bearer nope'), res);
  expect(res.statusCode).toBe(401);
  expect(twitch.helix).not.toHaveBeenCalled();
});

test('offline: pays out and closes open sessions, credits nothing', async () => {
  at(QUIET_TICK);
  twitchSays({ live: null });
  store.openSessionIds.mockResolvedValue(['s1']);
  const res = mockRes();
  await handler(req(), res);
  expect(res.statusCode).toBe(200);
  expect(res.body).toMatchObject({ ok: true, live: false, closed: 1 });
  expect(store.settleSession).toHaveBeenCalledWith('s1', RATES, { close: true });
  expect(store.creditSession).not.toHaveBeenCalled();
  expect(store.deleteRefs).toHaveBeenCalledWith(['marker-ref']);
});

test('live: credits the completed window without bots, broadcaster or bot account', async () => {
  at(QUIET_TICK);
  twitchSays({
    live: 'stream-1',
    chatters: [
      { user_id: '100', user_login: 'gooferg' },
      { user_id: '200', user_login: 'goofbot' },
      { user_id: '5', user_login: 'Nightbot' },
      { user_id: '8', user_login: 'Viewer' },
    ],
  });
  store.takeChatMarkers.mockResolvedValue({
    chatted: new Map([
      ['9', 'chatty'],
      ['6', 'streamelements'],
    ]),
    refs: ['marker-ref'],
  });
  const res = mockRes();
  await handler(req(), res);
  expect(res.statusCode).toBe(200);
  expect(store.takeChatMarkers).toHaveBeenCalledWith(QUIET_TICK, QUIET_TICK - 1);
  expect(store.creditSession).toHaveBeenCalledWith('stream-1', {
    completed: QUIET_TICK - 1,
    present: new Map([['8', 'viewer']]),
    chatted: new Map([['9', 'chatty']]),
  });
  expect(store.settleSession).not.toHaveBeenCalled();
  expect(store.deleteRefs).toHaveBeenCalledWith(['marker-ref']);
});

test('live: pays out on a half-hour window', async () => {
  at(PAYOUT_TICK);
  twitchSays({ live: 'stream-1', chatters: [{ user_id: '8', user_login: 'viewer' }] });
  const res = mockRes();
  await handler(req(), res);
  expect(store.settleSession).toHaveBeenCalledTimes(1);
  expect(store.settleSession).toHaveBeenCalledWith('stream-1', RATES);
});

test('a duplicate fire for an already-credited window does not pay out again', async () => {
  at(PAYOUT_TICK);
  twitchSays({ live: 'stream-1', chatters: [{ user_id: '8', user_login: 'viewer' }] });
  store.creditSession.mockResolvedValue(false);
  const res = mockRes();
  await handler(req(), res);
  expect(res.statusCode).toBe(200);
  expect(store.settleSession).not.toHaveBeenCalled();
});

test('a restarted stream closes the old session and keeps the current one open', async () => {
  at(QUIET_TICK);
  twitchSays({ live: 'stream-2', chatters: [] });
  store.openSessionIds.mockResolvedValue(['stream-1', 'stream-2']);
  const res = mockRes();
  await handler(req(), res);
  expect(store.settleSession).toHaveBeenCalledTimes(1);
  expect(store.settleSession).toHaveBeenCalledWith('stream-1', RATES, { close: true });
  expect(store.creditSession).toHaveBeenCalledWith('stream-2', expect.any(Object));
});

test('a stale session whose payout keeps failing does not stop live crediting', async () => {
  at(QUIET_TICK);
  twitchSays({ live: 'stream-2', chatters: [{ user_id: '8', user_login: 'viewer' }] });
  store.openSessionIds.mockResolvedValue(['stream-1']);
  store.settleSession.mockRejectedValue(new Error('poison session'));
  jest.spyOn(console, 'error').mockImplementation(() => {});
  const res = mockRes();
  await handler(req(), res);
  expect(res.statusCode).toBe(200);
  expect(store.creditSession).toHaveBeenCalledWith('stream-2', expect.any(Object));
  expect(res.body).toMatchObject({ closed: 0 });
});

test('follows chatter pagination', async () => {
  at(QUIET_TICK);
  twitch.helix.mockImplementation(async (method, path) => {
    if (path.startsWith('/streams')) return { data: [{ id: 'stream-1' }] };
    if (path.includes('after=page2')) {
      return { data: [{ user_id: '11', user_login: 'second' }], pagination: {} };
    }
    return { data: [{ user_id: '10', user_login: 'first' }], pagination: { cursor: 'page2' } };
  });
  const res = mockRes();
  await handler(req(), res);
  expect(store.creditSession.mock.calls[0][1].present).toEqual(
    new Map([
      ['10', 'first'],
      ['11', 'second'],
    ])
  );
});

test('a Twitch failure writes nothing', async () => {
  at(QUIET_TICK);
  twitch.helix.mockRejectedValue(new Error('HELIX_503:/streams'));
  const res = mockRes();
  await handler(req(), res);
  expect(res.statusCode).toBe(500);
  expect(store.creditSession).not.toHaveBeenCalled();
  expect(store.settleSession).not.toHaveBeenCalled();
  expect(store.deleteRefs).not.toHaveBeenCalled();
});
