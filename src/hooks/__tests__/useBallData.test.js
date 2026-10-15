import { act, renderHook, waitFor } from '@testing-library/react';
import { getDocs, startAfter } from 'firebase/firestore';
import useBallData from '../useBallData';
import useBallRound from '../useBallRound';
import useBallsFeed from '../useBallsFeed';
import useBallHunt from '../useBallHunt';
import usePageVisible from '../usePageVisible';

jest.mock('../../config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: () => 'col',
  getDocs: jest.fn(),
  limit: () => null,
  orderBy: () => null,
  query: () => 'q',
  startAfter: jest.fn(),
  where: () => null,
}));
jest.mock('../../contexts/TwitchAuthContext', () => ({ useTwitchAuth: () => ({ twitchUser: { twitchId: 'me1' } }) }));
jest.mock('../useBallRound', () => jest.fn());
jest.mock('../useBallsFeed', () => jest.fn());
jest.mock('../useBallHunt', () => jest.fn());
jest.mock('../usePageVisible', () => jest.fn());

const page = (prefix, n) => ({ docs: Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, data: () => ({ status: 'settled' }) })) });
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

beforeEach(() => {
  useBallRound.mockReturnValue({ round: { id: 'r1', status: 'open', huntId: 'h' }, error: false });
  useBallsFeed.mockReturnValue({ balls: [], ready: true });
  useBallHunt.mockReturnValue({ hunt: null, stale: false });
  usePageVisible.mockReturnValue(true);
  getDocs.mockResolvedValue(page('a', 3));
  startAfter.mockImplementation((c) => c);
});

test('the balls listener runs only while a round is active and the tab is visible', async () => {
  const { rerender } = renderHook(() => useBallData());
  expect(useBallsFeed).toHaveBeenLastCalledWith('r1', { enabled: true });
  usePageVisible.mockReturnValue(false);
  rerender();
  expect(useBallsFeed).toHaveBeenLastCalledWith('r1', { enabled: false });
  usePageVisible.mockReturnValue(true);
  useBallRound.mockReturnValue({ round: { id: 'r1', status: 'settled' }, error: false });
  rerender();
  expect(useBallsFeed).toHaveBeenLastCalledWith('r1', { enabled: false });
  await waitFor(() => expect(getDocs).toHaveBeenCalled());
});

test('the archive waits for the first round snapshot', async () => {
  useBallRound.mockReturnValue({ round: undefined, error: false });
  const { rerender, result } = renderHook(() => useBallData());
  expect(getDocs).not.toHaveBeenCalled();
  useBallRound.mockReturnValue({ round: null, error: false });
  rerender();
  await waitFor(() => expect(result.current.past).toHaveLength(3));
  expect(getDocs).toHaveBeenCalledTimes(1);
});

test('load more appends page two after the cursor', async () => {
  const first = page('a', 20);
  getDocs.mockResolvedValueOnce(first).mockResolvedValueOnce(page('b', 5));
  const { result } = renderHook(() => useBallData());
  await waitFor(() => expect(result.current.past).toHaveLength(20));
  expect(result.current.hasMore).toBe(true);
  await act(async () => result.current.loadMore());
  await waitFor(() => expect(result.current.past).toHaveLength(25));
  expect(result.current.hasMore).toBe(false);
  expect(result.current.past[20].id).toBe('b0');
  expect(startAfter).toHaveBeenCalledWith(first.docs[19]);
});

test('a double tap on load more fetches one page', async () => {
  getDocs.mockResolvedValueOnce(page('a', 20));
  const { result } = renderHook(() => useBallData());
  await waitFor(() => expect(result.current.past).toHaveLength(20));
  const d = deferred();
  getDocs.mockReturnValueOnce(d.promise);
  act(() => {
    result.current.loadMore();
    result.current.loadMore();
  });
  expect(getDocs).toHaveBeenCalledTimes(2);
  await act(async () => d.resolve(page('b', 4)));
  await waitFor(() => expect(result.current.past).toHaveLength(24));
});

test('a stale response is dropped when a newer request has started', async () => {
  getDocs.mockResolvedValueOnce(page('a', 20));
  const { result, rerender } = renderHook(() => useBallData());
  await waitFor(() => expect(result.current.past).toHaveLength(20));
  const slow = deferred();
  getDocs.mockReturnValueOnce(slow.promise).mockResolvedValueOnce(page('n', 2));
  act(() => result.current.loadMore());
  useBallRound.mockReturnValue({ round: { id: 'r2', status: 'settled' }, error: false });
  rerender();
  await waitFor(() => expect(result.current.past.map((r) => r.id)).toEqual(['n0', 'n1']));
  await act(async () => slow.resolve(page('old', 20)));
  expect(result.current.past.map((r) => r.id)).toEqual(['n0', 'n1']);
});

test('a settle reloads page one once, not on every render', async () => {
  const { rerender } = renderHook(() => useBallData());
  await waitFor(() => expect(getDocs).toHaveBeenCalledTimes(1));
  rerender();
  expect(getDocs).toHaveBeenCalledTimes(1);
  useBallRound.mockReturnValue({ round: { id: 'r1', status: 'settled' }, error: false });
  rerender();
  await waitFor(() => expect(getDocs).toHaveBeenCalledTimes(2));
  useBallRound.mockReturnValue({ round: { id: 'r1', status: 'settled', winner: {} }, error: false });
  rerender();
  expect(getDocs).toHaveBeenCalledTimes(2);
});

test('a failed load more keeps the list and flags the error', async () => {
  getDocs.mockResolvedValueOnce(page('a', 20)).mockRejectedValueOnce(new Error('x'));
  const { result } = renderHook(() => useBallData());
  await waitFor(() => expect(result.current.past).toHaveLength(20));
  await act(async () => result.current.loadMore());
  await waitFor(() => expect(result.current.pastError).toBe(true));
  expect(result.current.past).toHaveLength(20);
});

test('a just-settled round keeps the balls and hunt live through the hold; an old one does not', async () => {
  useBallRound.mockReturnValue({ round: { id: 'r1', status: 'settled', huntId: 'h', settledAt: { toMillis: () => Date.now() } }, error: false });
  const { rerender } = renderHook(() => useBallData());
  expect(useBallsFeed).toHaveBeenLastCalledWith('r1', { enabled: true });
  expect(useBallHunt).toHaveBeenLastCalledWith('h', { enabled: true });
  useBallRound.mockReturnValue({ round: { id: 'r1', status: 'settled', huntId: 'h', settledAt: { toMillis: () => Date.now() - 10_000 } }, error: false });
  rerender();
  expect(useBallsFeed).toHaveBeenLastCalledWith('r1', { enabled: false });
  expect(useBallHunt).toHaveBeenLastCalledWith('h', { enabled: false });
  await waitFor(() => expect(getDocs).toHaveBeenCalled());
});
