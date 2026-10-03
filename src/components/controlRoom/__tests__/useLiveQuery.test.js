import { renderHook, act } from '@testing-library/react';
import { onSnapshot } from 'firebase/firestore';
import { useLiveQuery } from '../useLiveQuery';

jest.mock('firebase/firestore', () => ({ onSnapshot: jest.fn() }));

const snap = (rows) => ({ docs: rows.map((r) => ({ id: r.id, data: () => r })) });

beforeEach(() => {
  jest.useFakeTimers();
  onSnapshot.mockReset();
});
afterEach(() => jest.useRealTimers());

test('delivers docs with their ids', () => {
  onSnapshot.mockImplementation((_q, next) => {
    next(snap([{ id: 'a', status: 'open' }]));
    return () => {};
  });
  const { result } = renderHook(() => useLiveQuery(() => 'q', true));
  expect(result.current.docs).toEqual([{ id: 'a', status: 'open' }]);
  expect(result.current.error).toBe(false);
});

test('does not subscribe while disabled', () => {
  renderHook(() => useLiveQuery(() => 'q', false));
  expect(onSnapshot).not.toHaveBeenCalled();
});

test('retries every 5s after an error, then gives up after five retries', () => {
  onSnapshot.mockImplementation((_q, _next, fail) => {
    fail(new Error('offline'));
    return () => {};
  });
  const { result } = renderHook(() => useLiveQuery(() => 'q', true));
  expect(result.current.error).toBe(true);
  for (let i = 0; i < 5; i += 1) {
    act(() => {
      jest.advanceTimersByTime(5000);
    });
  }
  expect(onSnapshot).toHaveBeenCalledTimes(6);
  expect(result.current.gaveUp).toBe(true);
  act(() => {
    jest.advanceTimersByTime(60000);
  });
  expect(onSnapshot).toHaveBeenCalledTimes(6);
});

test('a good snapshot after an error clears it', () => {
  let calls = 0;
  onSnapshot.mockImplementation((_q, next, fail) => {
    calls += 1;
    if (calls === 1) fail(new Error('blip'));
    else next(snap([{ id: 'b' }]));
    return () => {};
  });
  const { result } = renderHook(() => useLiveQuery(() => 'q', true));
  act(() => {
    jest.advanceTimersByTime(5000);
  });
  expect(result.current.error).toBe(false);
  expect(result.current.docs).toEqual([{ id: 'b' }]);
});

test('ready turns on with the first good snapshot', () => {
  let next;
  onSnapshot.mockImplementation((_q, n) => {
    next = n;
    return () => {};
  });
  const { result } = renderHook(() => useLiveQuery(() => 'q', true));
  expect(result.current.ready).toBe(false);
  act(() => next(snap([])));
  expect(result.current.ready).toBe(true);
});
