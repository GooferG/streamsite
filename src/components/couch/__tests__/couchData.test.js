import { act, render, screen, waitFor } from '@testing-library/react';
import { toCouchInput } from '../useCouchData';
import useLastVisit, { __resetLastVisitForTests } from '../useLastVisit';
import useLiveGiveaway from '../useLiveGiveaway';
import useSteamGames from '../useSteamGames';

const mockSnapshot = { docs: [] };
jest.mock('../../../config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: () => 'c',
  query: (ref) => ref,
  where: () => null,
  orderBy: () => null,
  limit: () => null,
  onSnapshot: (_q, next) => {
    next({ empty: mockSnapshot.docs.length === 0, docs: mockSnapshot.docs });
    return () => {};
  },
}));

function Show({ hook }) {
  const value = hook();
  return <p data-testid="v">{value === undefined ? 'undefined' : JSON.stringify(value)}</p>;
}
const v = () => screen.getByTestId('v').textContent;

beforeEach(() => {
  localStorage.clear();
  __resetLastVisitForTests();
});

test('useLastVisit: null on a first visit, then the stored time', async () => {
  render(<Show hook={useLastVisit} />);
  expect(v()).toBe('null');
  await waitFor(() => expect(localStorage.getItem('gg_last_visit')).not.toBeNull());
});

test('useLastVisit: the previous visit', () => {
  localStorage.setItem('gg_last_visit', '1700000000000');
  render(<Show hook={useLastVisit} />);
  expect(v()).toBe('1700000000000');
});

test('useLastVisit: undefined when storage throws', () => {
  const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  render(<Show hook={useLastVisit} />);
  expect(v()).toBe('undefined');
  spy.mockRestore();
});

test('useLastVisit: a remount keeps the first value', async () => {
  const { unmount } = render(<Show hook={useLastVisit} />);
  expect(v()).toBe('null');
  await waitFor(() => expect(localStorage.getItem('gg_last_visit')).not.toBeNull());
  unmount();
  render(<Show hook={useLastVisit} />);
  expect(v()).toBe('null');
});

test('useLiveGiveaway reads the newest active giveaway', () => {
  mockSnapshot.docs = [{ id: 'g1', data: () => ({ status: 'open', keyword: '!goof', prize: '$25.00 bonus buy' }) }];
  render(<Show hook={useLiveGiveaway} />);
  expect(JSON.parse(v())).toEqual({ id: 'g1', status: 'open', keyword: '!goof', prize: '$25.00 bonus buy' });
  mockSnapshot.docs = [];
});

test('useSteamGames: games on success, null on failure', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ games: [{ appid: 1, name: 'X', playtime_2weeks: 2 }] }) });
  const { unmount } = render(<Show hook={useSteamGames} />);
  await waitFor(() => expect(v()).toBe('[{"appid":1,"name":"X","playtime_2weeks":2}]'));
  unmount();
  global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
  render(<Show hook={useSteamGames} />);
  await act(async () => {});
  expect(v()).toBe('null');
});

test('toCouchInput maps App and hook data onto the model input', () => {
  const input = toCouchInput({
    now: 5,
    timeZone: 'UTC',
    isLive: true,
    statusReady: true,
    streamData: { title: 'T', viewer_count: 9, game_name: 'Slots', thumbnail_url: 'u' },
    videos: [],
    clips: [],
    channelData: { game_name: 'Slots' },
    schedule: { schedule: [], loading: true },
    hunts: { live: null, recent: [] },
    round: { round: null },
    lastHunt: { id: 'h', bonuses: [] },
    leaderboard: { endsAt: 99 },
    giveaway: { status: 'open', keyword: 'k', prize: 'p', id: 'g' },
    games: null,
    lastVisit: null,
    reel: [],
  });
  expect(input.stream).toEqual({ title: 'T', viewers: 9, game: 'Slots', thumbnailUrl: 'u' });
  expect(input.schedule).toBeNull();
  expect(input.category).toBe('Slots');
  expect(input.round).toBeNull();
  expect(input.leaderboardEndsAt).toBe(99);
  expect(input.giveaway).toEqual({ status: 'open', keyword: 'k', prize: 'p' });
  expect(input.lastHunt).toEqual({ id: 'h', bonuses: [] });
});
