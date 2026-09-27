/**
 * @jest-environment node
 */
// Fake Firestore: reads come from mockDocs (path -> data), every write is
// recorded in mockWrites as [op, path, data?, options?]. Writes do not update
// mockDocs; tests seed mockDocs with the state they need.
const mockDocs = new Map();
const mockWrites = [];

jest.mock('../../api/_lib/firebaseAdmin.js', () => {
  let auto = 0;
  const snap = (path) => {
    const data = mockDocs.get(path);
    return { id: path.split('/').pop(), exists: data !== undefined, data: () => data };
  };
  const ref = (path) => ({
    path,
    get: async () => snap(path),
    set: async (data, opts) => {
      mockWrites.push(['set', path, data, opts]);
    },
    update: async (data) => {
      mockWrites.push(['update', path, data]);
    },
  });
  const collection = (col) => ({
    doc: (id) => ref(`${col}/${id === undefined ? `auto${++auto}` : id}`),
    where: (field, op, value) => ({
      get: async () => {
        const docs = [...mockDocs.entries()]
          .filter(([path]) => path.startsWith(`${col}/`) && !path.slice(col.length + 1).includes('/'))
          .filter(([, data]) => {
            if (op === '<') return data[field] < value;
            if (op === '==') return data[field] === value;
            throw new Error(`fake where: unsupported op ${op}`);
          })
          .map(([path, data]) => ({ id: path.split('/').pop(), ref: ref(path), data: () => data }));
        return { docs, empty: docs.length === 0, size: docs.length };
      },
    }),
  });
  const adminDb = {
    collection,
    batch: () => ({
      delete: (r) => mockWrites.push(['delete', r.path]),
      commit: async () => {},
    }),
    runTransaction: async (fn) =>
      fn({
        get: async (r) => snap(r.path),
        getAll: async (...refs) => refs.map((r) => snap(r.path)),
        set: (r, data, opts) => mockWrites.push(['set', r.path, data, opts]),
        update: (r, data) => mockWrites.push(['update', r.path, data]),
        delete: (r) => mockWrites.push(['delete', r.path]),
      }),
  };
  const FieldValue = {
    increment: (n) => ({ increment: n }),
    serverTimestamp: () => 'SERVER_TS',
  };
  return { adminDb, FieldValue };
});

import {
  markChatted,
  takeChatMarkers,
  deleteRefs,
  openSessionIds,
  creditSession,
  settleSession,
} from '../../api/_lib/watchtimeStore';
import { WINDOW_MS, windowId } from '../../api/_lib/watchtime';

const NOW = 1000 * WINDOW_MS + 4200;
const W = windowId(NOW);

beforeEach(() => {
  mockDocs.clear();
  mockWrites.length = 0;
});

describe('markChatted', () => {
  test('first message in a window writes one marker with the login', async () => {
    expect(await markChatted('7', 'viewer', NOW)).toBe(true);
    expect(mockWrites).toEqual([
      ['set', `watch_chat/${W}`, { window: W, chatters: { 7: 'viewer' } }, { merge: true }],
    ]);
  });

  test('more messages from the same viewer in that window cost no writes', async () => {
    mockDocs.set(`watch_chat/${W}`, { window: W, chatters: { 7: 'viewer' } });
    expect(await markChatted('7', 'viewer', NOW)).toBe(false);
    expect(mockWrites).toEqual([]);
  });

  test('another viewer in the same window writes their own marker', async () => {
    mockDocs.set(`watch_chat/${W}`, { window: W, chatters: { 7: 'viewer' } });
    expect(await markChatted('8', 'other', NOW)).toBe(true);
    expect(mockWrites).toEqual([
      ['set', `watch_chat/${W}`, { window: W, chatters: { 8: 'other' } }, { merge: true }],
    ]);
  });

  test('the next window starts fresh', async () => {
    mockDocs.set(`watch_chat/${W}`, { window: W, chatters: { 7: 'viewer' } });
    expect(await markChatted('7', 'viewer', NOW + WINDOW_MS)).toBe(true);
    expect(mockWrites[0][1]).toBe(`watch_chat/${W + 1}`);
  });
});

const fresh = (overrides = {}) => ({
  login: 'someone',
  present: 0,
  chat: 0,
  paidTickets: 0,
  paidPresent: 0,
  ledgerTickets: 0,
  ledgerMinutes: 0,
  ...overrides,
});

describe('takeChatMarkers / deleteRefs', () => {
  test('returns the completed window chatters and every stale marker to delete', async () => {
    mockDocs.set('watch_chat/8', { window: 8, chatters: { 1: 'old' } });
    mockDocs.set('watch_chat/9', { window: 9, chatters: { 2: 'a', 3: 'b' } });
    mockDocs.set('watch_chat/10', { window: 10, chatters: { 4: 'current' } });
    const { chatted, refs } = await takeChatMarkers(10, 9);
    expect([...chatted]).toEqual([
      ['2', 'a'],
      ['3', 'b'],
    ]);
    expect(refs.map((r) => r.path).sort()).toEqual(['watch_chat/8', 'watch_chat/9']);
    await deleteRefs(refs);
    expect(mockWrites.map((w) => w.join(' ')).sort()).toEqual([
      'delete watch_chat/8',
      'delete watch_chat/9',
    ]);
  });
});

describe('openSessionIds', () => {
  test('lists only open sessions', async () => {
    mockDocs.set('watch_sessions/a', { status: 'open' });
    mockDocs.set('watch_sessions/b', { status: 'closed' });
    expect(await openSessionIds()).toEqual(['a']);
  });
});

describe('creditSession', () => {
  const present = new Map([['1', 'a']]);
  const chatted = new Map();

  test('creates the session on the first credited window', async () => {
    expect(await creditSession('s1', { completed: 10, present, chatted })).toBe(true);
    expect(mockWrites).toHaveLength(1);
    const [op, path, data] = mockWrites[0];
    expect(op).toBe('set');
    expect(path).toBe('watch_sessions/s1');
    expect(data).toMatchObject({
      streamId: 's1',
      status: 'open',
      startedAt: 'SERVER_TS',
      lastWindow: 10,
      lastSettledAt: null,
      closedAt: null,
    });
    expect(data.viewers['1']).toMatchObject({ login: 'a', present: 1 });
  });

  test('a duplicate fire for an already-credited window writes nothing', async () => {
    mockDocs.set('watch_sessions/s1', { status: 'open', lastWindow: 10, viewers: {} });
    expect(await creditSession('s1', { completed: 10, present, chatted })).toBe(false);
    expect(mockWrites).toEqual([]);
  });

  test('reopens a session closed by an offline blip when the same stream comes back', async () => {
    mockDocs.set('watch_sessions/s1', {
      status: 'closed',
      lastWindow: 9,
      viewers: { '1': fresh({ login: 'a', present: 4, paidTickets: 4, paidPresent: 4 }) },
    });
    expect(await creditSession('s1', { completed: 10, present, chatted })).toBe(true);
    const [op, path, data] = mockWrites[0];
    expect([op, path]).toEqual(['update', 'watch_sessions/s1']);
    expect(data).toMatchObject({ status: 'open', closedAt: null, lastWindow: 10 });
    expect(data.viewers['1']).toMatchObject({ present: 5, paidTickets: 4, paidPresent: 4 });
  });
});

describe('settleSession', () => {
  const RATES = { perWindow: 1, chatBonus: 1 };

  test('pays account holders, banks the rest, records what was paid, and closes', async () => {
    mockDocs.set('watch_sessions/s1', {
      status: 'open',
      viewers: {
        '1': fresh({ login: 'member', present: 6, chat: 2 }),
        '2': fresh({ login: 'lurker', present: 3 }),
      },
    });
    mockDocs.set('users/1', { tickets: 5 });

    expect(await settleSession('s1', RATES, { close: true })).toEqual({ accounts: 1, banked: 1 });

    expect(mockWrites).toContainEqual([
      'update',
      'users/1',
      {
        tickets: { increment: 8 },
        totalEarned: { increment: 8 },
        watchMinutes: { increment: 30 },
        updatedAt: 'SERVER_TS',
      },
    ]);
    expect(mockWrites).toContainEqual([
      'set',
      'ticket_ledger/watch_s1_1',
      {
        userId: '1',
        reason: 'watchtime',
        refId: 's1',
        delta: 8,
        minutes: 30,
        note: 'Watched 30m',
        updatedAt: 'SERVER_TS',
        createdAt: 'SERVER_TS',
      },
      { merge: true },
    ]);
    expect(mockWrites).toContainEqual([
      'set',
      'watch_bank/2',
      {
        login: 'lurker',
        tickets: { increment: 3 },
        minutes: { increment: 15 },
        updatedAt: 'SERVER_TS',
      },
      { merge: true },
    ]);
    const viewersWrite = mockWrites.find(
      (w) => w[0] === 'update' && w[1] === 'watch_sessions/s1' && w[2].viewers
    );
    expect(viewersWrite[2].viewers['1']).toMatchObject({
      paidTickets: 8,
      paidPresent: 6,
      ledgerTickets: 8,
      ledgerMinutes: 30,
    });
    expect(viewersWrite[2].viewers['2']).toMatchObject({
      paidTickets: 3,
      paidPresent: 3,
      ledgerTickets: 0,
      ledgerMinutes: 0,
    });
    expect(mockWrites).toContainEqual([
      'update',
      'watch_sessions/s1',
      { lastSettledAt: 'SERVER_TS', status: 'closed', closedAt: 'SERVER_TS' },
    ]);
  });

  test('a later payout does not rewrite the ledger createdAt', async () => {
    mockDocs.set('watch_sessions/s1', {
      status: 'open',
      viewers: {
        '1': fresh({
          present: 12,
          chat: 2,
          paidTickets: 8,
          paidPresent: 6,
          ledgerTickets: 8,
          ledgerMinutes: 30,
        }),
      },
    });
    mockDocs.set('users/1', { tickets: 13 });
    await settleSession('s1', RATES);
    const ledger = mockWrites.find((w) => w[1] === 'ticket_ledger/watch_s1_1');
    expect(ledger[2]).toMatchObject({ delta: 14, minutes: 60, note: 'Watched 1h' });
    expect(ledger[2]).not.toHaveProperty('createdAt');
  });

  test('nothing owed: no payouts, but a final payout still closes the session', async () => {
    mockDocs.set('watch_sessions/s1', {
      status: 'open',
      viewers: { '1': fresh({ present: 2, paidTickets: 2, paidPresent: 2 }) },
    });
    expect(await settleSession('s1', RATES, { close: true })).toEqual({ accounts: 0, banked: 0 });
    expect(mockWrites).toEqual([
      [
        'update',
        'watch_sessions/s1',
        { lastSettledAt: 'SERVER_TS', status: 'closed', closedAt: 'SERVER_TS' },
      ],
    ]);
  });

  test('a missing session is a no-op', async () => {
    expect(await settleSession('nope', RATES, { close: true })).toEqual({ accounts: 0, banked: 0 });
    expect(mockWrites).toEqual([]);
  });
});
