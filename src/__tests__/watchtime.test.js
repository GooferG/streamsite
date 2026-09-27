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
  formatDuration,
  formatWatchNote,
  owedFor,
  planSettlement,
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

const RATES = { perWindow: 1, chatBonus: 1 };

describe('formatDuration / formatWatchNote', () => {
  test('minutes, hours, and both', () => {
    expect(formatDuration(0)).toBe('0m');
    expect(formatDuration(5)).toBe('5m');
    expect(formatDuration(60)).toBe('1h');
    expect(formatDuration(95)).toBe('1h 35m');
    expect(formatWatchNote(95)).toBe('Watched 1h 35m');
  });
});

describe('owedFor', () => {
  test('first payout owes everything earned', () => {
    expect(owedFor(viewer({ present: 6, chat: 2 }), RATES)).toEqual({ tickets: 8, windows: 6 });
  });

  test('later payouts owe only the unpaid part', () => {
    const v = viewer({ present: 6, chat: 2, paidTickets: 5, paidPresent: 3 });
    expect(owedFor(v, RATES)).toEqual({ tickets: 3, windows: 3 });
  });

  test('nothing new owes nothing', () => {
    const v = viewer({ present: 6, chat: 2, paidTickets: 8, paidPresent: 6 });
    expect(owedFor(v, RATES)).toEqual({ tickets: 0, windows: 0 });
  });

  test('a rate lowered mid-stream never owes negative tickets', () => {
    const v = viewer({ present: 6, chat: 2, paidTickets: 8, paidPresent: 6 });
    expect(owedFor(v, { perWindow: 0, chatBonus: 0 })).toEqual({ tickets: 0, windows: 0 });
  });

  test('custom rates', () => {
    expect(owedFor(viewer({ present: 4, chat: 1 }), { perWindow: 2, chatBonus: 3 })).toEqual({
      tickets: 11,
      windows: 4,
    });
  });
});

describe('planSettlement', () => {
  test('first payout to an account: tickets, minutes, and a new ledger line', () => {
    const viewers = { '1': viewer({ login: 'member', present: 6, chat: 2 }) };
    const plan = planSettlement(viewers, ['1'], new Set(['1']), RATES);
    expect(plan.accountCredits).toEqual([
      {
        id: '1',
        tickets: 8,
        minutes: 30,
        ledger: { delta: 8, minutes: 30, note: 'Watched 30m', first: true },
      },
    ]);
    expect(plan.bankCredits).toEqual([]);
    expect(plan.viewers['1']).toMatchObject({
      paidTickets: 8,
      paidPresent: 6,
      ledgerTickets: 8,
      ledgerMinutes: 30,
    });
  });

  test('second payout in the same stream grows the same ledger line', () => {
    const viewers = {
      '1': viewer({
        present: 12,
        chat: 2,
        paidTickets: 8,
        paidPresent: 6,
        ledgerTickets: 8,
        ledgerMinutes: 30,
      }),
    };
    const plan = planSettlement(viewers, ['1'], new Set(['1']), RATES);
    expect(plan.accountCredits).toEqual([
      {
        id: '1',
        tickets: 6,
        minutes: 30,
        ledger: { delta: 14, minutes: 60, note: 'Watched 1h', first: false },
      },
    ]);
  });

  test('no account: tickets go to the bank and no ledger fields change', () => {
    const viewers = { '2': viewer({ login: 'lurker', present: 3 }) };
    const plan = planSettlement(viewers, ['2'], new Set(), RATES);
    expect(plan.accountCredits).toEqual([]);
    expect(plan.bankCredits).toEqual([{ id: '2', login: 'lurker', tickets: 3, minutes: 15 }]);
    expect(plan.viewers['2']).toMatchObject({
      paidTickets: 3,
      paidPresent: 3,
      ledgerTickets: 0,
      ledgerMinutes: 0,
    });
  });

  test('banked earlier, then signed up mid-stream: ledger line starts fresh and excludes the banked part', () => {
    const viewers = {
      '3': viewer({ present: 12, chat: 2, paidTickets: 8, paidPresent: 6 }),
    };
    const plan = planSettlement(viewers, ['3'], new Set(['3']), RATES);
    expect(plan.accountCredits).toEqual([
      {
        id: '3',
        tickets: 6,
        minutes: 30,
        ledger: { delta: 6, minutes: 30, note: 'Watched 30m', first: true },
      },
    ]);
  });

  test('nothing owed produces no credits and leaves the viewer as is', () => {
    const viewers = {
      '4': viewer({ present: 2, paidTickets: 2, paidPresent: 2, ledgerTickets: 2, ledgerMinutes: 10 }),
    };
    const plan = planSettlement(viewers, ['4'], new Set(['4']), RATES);
    expect(plan.accountCredits).toEqual([]);
    expect(plan.bankCredits).toEqual([]);
    expect(plan.viewers['4']).toEqual(viewers['4']);
  });

  test('only the given ids are settled; unknown ids are ignored; input is not mutated', () => {
    const viewers = {
      '5': viewer({ present: 1 }),
      '6': viewer({ present: 1 }),
    };
    const snapshot = JSON.stringify(viewers);
    const plan = planSettlement(viewers, ['5', 'missing'], new Set(['5', '6']), RATES);
    expect(plan.accountCredits.map((c) => c.id)).toEqual(['5']);
    expect(plan.viewers['6']).toEqual(viewers['6']);
    expect(JSON.stringify(viewers)).toBe(snapshot);
  });
});
