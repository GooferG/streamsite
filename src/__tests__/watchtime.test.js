import {
  WINDOW_MS,
  windowId,
  completedWindow,
  shouldSettle,
  readRates,
  exclusionFromEnv,
  isExcludedViewer,
  withoutExcluded,
  creditWindow,
  applyWindow,
} from '../../api/_lib/watchtime';

const viewer = (overrides = {}) => ({
  login: 'someone',
  present: 0,
  chat: 0,
  paidTickets: 0,
  paidPresent: 0,
  ledgerTickets: 0,
  ledgerMinutes: 0,
  ...overrides,
});

describe('windows', () => {
  test('windowId cuts time into 5-minute buckets', () => {
    expect(windowId(0)).toBe(0);
    expect(windowId(WINDOW_MS - 1)).toBe(0);
    expect(windowId(WINDOW_MS)).toBe(1);
  });

  test('a tick credits the window that just ended, even when cron fires late', () => {
    const boundary = 1000 * WINDOW_MS;
    expect(completedWindow(boundary + 200)).toBe(999);
    expect(completedWindow(boundary + 59000)).toBe(999);
  });

  test('pays out at every :00 and :30 boundary', () => {
    expect(shouldSettle(5)).toBe(true);
    expect(shouldSettle(11)).toBe(true);
    expect(shouldSettle(0)).toBe(false);
    expect(shouldSettle(6)).toBe(false);
  });
});

describe('readRates', () => {
  test('defaults when unset', () => {
    expect(readRates({})).toEqual({ perWindow: 1, chatBonus: 1 });
  });

  test('reads non-negative integers, including 0', () => {
    expect(
      readRates({ WATCHTIME_TICKETS_PER_WINDOW: '2', WATCHTIME_CHAT_BONUS: '0' })
    ).toEqual({ perWindow: 2, chatBonus: 0 });
  });

  test('falls back on blank, negative, fractional or non-numeric values', () => {
    expect(
      readRates({ WATCHTIME_TICKETS_PER_WINDOW: '  ', WATCHTIME_CHAT_BONUS: '-3' })
    ).toEqual({ perWindow: 1, chatBonus: 1 });
    expect(
      readRates({ WATCHTIME_TICKETS_PER_WINDOW: 'abc', WATCHTIME_CHAT_BONUS: '1.5' })
    ).toEqual({ perWindow: 1, chatBonus: 1 });
  });
});

describe('exclusion', () => {
  const ex = exclusionFromEnv({
    TWITCH_BROADCASTER_ID: '100',
    TWITCH_BOT_ID: '200',
    WATCHTIME_EXCLUDE_LOGINS: ' MyModBot , other ',
  });

  test('broadcaster and bot account ids', () => {
    expect(isExcludedViewer({ id: '100', login: 'gooferg' }, ex)).toBe(true);
    expect(isExcludedViewer({ id: '200', login: 'goofbot' }, ex)).toBe(true);
  });

  test('built-in bot logins, case-insensitive', () => {
    expect(isExcludedViewer({ id: '5', login: 'Nightbot' }, ex)).toBe(true);
    expect(isExcludedViewer({ id: '6', login: 'streamelements' }, ex)).toBe(true);
  });

  test('env logins are trimmed and case-insensitive', () => {
    expect(isExcludedViewer({ id: '7', login: 'mymodbot' }, ex)).toBe(true);
    expect(isExcludedViewer({ id: '8', login: 'OTHER' }, ex)).toBe(true);
  });

  test('regular viewers pass', () => {
    expect(isExcludedViewer({ id: '9', login: 'viewer' }, ex)).toBe(false);
  });

  test('no env ids means nobody is excluded by id', () => {
    const bare = exclusionFromEnv({});
    expect(bare.ids.size).toBe(0);
    expect(isExcludedViewer({ id: '100', login: 'gooferg' }, bare)).toBe(false);
  });

  test('withoutExcluded filters an id -> login map', () => {
    const all = new Map([
      ['100', 'gooferg'],
      ['5', 'streamelements'],
      ['9', 'viewer'],
    ]);
    expect([...withoutExcluded(all, ex)]).toEqual([['9', 'viewer']]);
  });
});

describe('creditWindow', () => {
  test('a viewer in the chatter list gets a present window and no chat window', () => {
    const next = creditWindow({}, { present: new Map([['1', 'lurker']]), chatted: new Map() });
    expect(next['1']).toEqual(viewer({ login: 'lurker', present: 1 }));
  });

  test('a viewer who chatted but is not in the lagging chatter list still counts as present', () => {
    const next = creditWindow({}, { present: new Map(), chatted: new Map([['2', 'chatty']]) });
    expect(next['2']).toEqual(viewer({ login: 'chatty', present: 1, chat: 1 }));
  });

  test('present and chatted earns both', () => {
    const next = creditWindow(
      {},
      { present: new Map([['3', 'both']]), chatted: new Map([['3', 'both']]) }
    );
    expect(next['3']).toMatchObject({ present: 1, chat: 1 });
  });

  test('keeps existing counters and paid fields', () => {
    const before = { '4': viewer({ login: 'old', present: 5, chat: 2, paidTickets: 7, paidPresent: 5 }) };
    const next = creditWindow(before, { present: new Map([['4', 'renamed']]), chatted: new Map() });
    expect(next['4']).toEqual(
      viewer({ login: 'renamed', present: 6, chat: 2, paidTickets: 7, paidPresent: 5 })
    );
  });

  test('viewers who left are untouched, and the input is not mutated', () => {
    const before = { '5': viewer({ present: 3 }) };
    const snapshot = JSON.stringify(before);
    const next = creditWindow(before, { present: new Map([['6', 'new']]), chatted: new Map() });
    expect(next['5']).toEqual(before['5']);
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe('applyWindow', () => {
  const present = new Map([['1', 'a']]);
  const chatted = new Map();

  test('starts a new session', () => {
    const r = applyWindow(null, { completed: 10, present, chatted });
    expect(r.isNew).toBe(true);
    expect(r.lastWindow).toBe(10);
    expect(r.viewers['1']).toMatchObject({ present: 1 });
  });

  test('credits the next window on top of an existing session', () => {
    const session = { lastWindow: 10, viewers: { '1': viewer({ login: 'a', present: 1 }) } };
    const r = applyWindow(session, { completed: 11, present, chatted });
    expect(r.isNew).toBe(false);
    expect(r.lastWindow).toBe(11);
    expect(r.viewers['1'].present).toBe(2);
  });

  test('a duplicate or late fire for an already-credited window is a no-op', () => {
    const session = { lastWindow: 10, viewers: {} };
    expect(applyWindow(session, { completed: 10, present, chatted })).toBeNull();
    expect(applyWindow(session, { completed: 9, present, chatted })).toBeNull();
  });
});
