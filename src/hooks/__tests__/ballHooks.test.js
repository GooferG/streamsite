import { act, renderHook, waitFor } from '@testing-library/react';
import { onSnapshot, setDoc } from 'firebase/firestore';
import useBallRound from '../useBallRound';
import useBallsFeed from '../useBallsFeed';
import useBallHunt from '../useBallHunt';
import useBroadcastSettings from '../useBroadcastSettings';
import usePageVisible from '../usePageVisible';
import useBallArrivals from '../useBallArrivals';
import { writeReveals } from '../../utils/broadcast';

jest.mock('../../config/firebase', () => ({ db: {}, auth: { currentUser: { email: 'owner@test', uid: 'u1' } } }));
jest.mock('firebase/firestore', () => ({
  collection: (_db, ...parts) => parts.join('/'),
  doc: (_db, ...parts) => parts.join('/'),
  orderBy: () => null,
  limit: () => null,
  query: (ref) => ref,
  onSnapshot: jest.fn(),
  setDoc: jest.fn(),
  serverTimestamp: () => 'ts',
}));

const listeners = {};
beforeEach(() => {
  Object.keys(listeners).forEach((k) => delete listeners[k]);
  onSnapshot.mockImplementation((path, next, fail) => {
    listeners[path] = { next, fail };
    return () => delete listeners[path];
  });
  setDoc.mockResolvedValue(undefined);
});

const docsSnap = (rows) => ({ empty: rows.length === 0, docs: rows.map((r) => ({ id: r.id, data: () => r })) });

test('useBallRound: undefined until the first snapshot, then the round or null', () => {
  const { result } = renderHook(() => useBallRound());
  expect(result.current.round).toBeUndefined();
  act(() => listeners.ball_rounds.next(docsSnap([{ id: 'r1', status: 'open' }])));
  expect(result.current.round).toEqual({ id: 'r1', status: 'open' });
  act(() => listeners.ball_rounds.next(docsSnap([])));
  expect(result.current.round).toBeNull();
  act(() => listeners.ball_rounds.fail(new Error('x')));
  expect(result.current).toEqual({ round: null, error: true });
});

test('useBallsFeed: follows the round id; disabled means no listener', () => {
  const { result, rerender } = renderHook(({ id, on }) => useBallsFeed(id, { enabled: on }), { initialProps: { id: 'r1', on: true } });
  act(() => listeners['ball_rounds/r1/balls'].next(docsSnap([{ id: 'a', status: 'drum' }])));
  expect(result.current).toEqual({ balls: [{ id: 'a', status: 'drum' }], ready: true, error: false });
  rerender({ id: 'r2', on: true });
  expect(listeners['ball_rounds/r1/balls']).toBeUndefined();
  expect(result.current.ready).toBe(false);
  rerender({ id: 'r2', on: false });
  expect(listeners['ball_rounds/r2/balls']).toBeUndefined();
  expect(result.current.balls).toEqual([]);
});

test('useBallArrivals: nothing for the first snapshot, then each new or swapped ball', () => {
  const onArrive = jest.fn();
  const first = [{ id: 'a', status: 'drum', slotId: 's1', displayName: 'A', slotName: 'One' }];
  const { rerender } = renderHook(({ balls, ready }) => useBallArrivals(balls, ready, onArrive), { initialProps: { balls: first, ready: true } });
  expect(onArrive).not.toHaveBeenCalled();
  rerender({ balls: [...first, { id: 'b', status: 'drum', slotId: 's2', displayName: 'B', slotName: 'Two' }], ready: true });
  expect(onArrive).toHaveBeenCalledWith({ id: 'b:s2', name: 'B', slotName: 'Two', kind: 'new' });
  rerender({ balls: [], ready: false });
  rerender({ balls: [{ id: 'z', status: 'drum', slotId: 's9' }], ready: true });
  expect(onArrive).toHaveBeenCalledTimes(1);
});

test('useBallHunt polls every 60s and keeps the last hunt when a poll fails', async () => {
  jest.useFakeTimers();
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ hunt: { id: 'h1', bonuses: [{ slot: 'A', multiplier: 2 }] } }) })
    .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'COMMUNITYHUNTS_UNAVAILABLE' }) });
  const { result } = renderHook(() => useBallHunt('h1'));
  await waitFor(() => expect(result.current.hunt).toEqual({ id: 'h1', bonuses: [{ slot: 'A', multiplier: 2 }] }));
  expect(global.fetch).toHaveBeenCalledWith('/api/communityhunts?view=hunt&id=h1');
  await act(async () => {
    jest.advanceTimersByTime(60_000);
  });
  await waitFor(() => expect(result.current.stale).toBe(true));
  expect(result.current.hunt.id).toBe('h1');
  jest.useRealTimers();
});

test('useBallHunt waits while hidden and loads when the tab becomes visible', async () => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ hunt: { id: 'h1' } }) });
  const { result } = renderHook(() => useBallHunt('h1'));
  expect(global.fetch).not.toHaveBeenCalled();
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(global.fetch).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(result.current.hunt).toEqual({ id: 'h1' }));
});

test('useBallHunt ignores a late older response', async () => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  const deferred = () => {
    let resolve;
    const promise = new Promise((r) => {
      resolve = r;
    });
    return { promise, resolve };
  };
  const first = deferred();
  const second = deferred();
  global.fetch = jest.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const { result } = renderHook(() => useBallHunt('h1'));
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(global.fetch).toHaveBeenCalledTimes(2);
  await act(async () => {
    second.resolve({ ok: true, json: async () => ({ hunt: { id: 'new' } }) });
  });
  await waitFor(() => expect(result.current.hunt).toEqual({ id: 'new' }));
  await act(async () => {
    first.resolve({ ok: true, json: async () => ({ hunt: { id: 'old' } }) });
  });
  expect(result.current.hunt).toEqual({ id: 'new' });
});

test('useBallHunt does nothing without a hunt id', () => {
  global.fetch = jest.fn();
  const { result } = renderHook(() => useBallHunt(null));
  expect(result.current).toEqual({ hunt: null, stale: false, loading: false });
  expect(global.fetch).not.toHaveBeenCalled();
});

test('useBroadcastSettings: stage only when the doc says so', () => {
  const { result } = renderHook(() => useBroadcastSettings());
  expect(result.current.reveals).toBe('overlay');
  act(() => listeners['settings/broadcast'].next({ exists: () => true, data: () => ({ reveals: 'stage' }) }));
  expect(result.current.reveals).toBe('stage');
  act(() => listeners['settings/broadcast'].next({ exists: () => false, data: () => undefined }));
  expect(result.current.reveals).toBe('overlay');
  act(() => listeners['settings/broadcast'].next({ docs: [] }));
  expect(result.current.reveals).toBe('overlay');
});

test('writeReveals', async () => {
  await writeReveals('stage');
  expect(setDoc).toHaveBeenCalledWith('settings/broadcast', { reveals: 'stage', updatedAt: 'ts', updatedBy: 'owner@test' }, { merge: true });
  await writeReveals('nonsense');
  expect(setDoc.mock.calls[1][1].reveals).toBe('overlay');
});

test('usePageVisible', () => {
  const { result } = renderHook(() => usePageVisible());
  expect(result.current).toBe(true);
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(result.current).toBe(false);
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(result.current).toBe(true);
});
