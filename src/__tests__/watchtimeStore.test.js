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

import { markChatted } from '../../api/_lib/watchtimeStore';
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
