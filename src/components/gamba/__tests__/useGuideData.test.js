import { renderHook, act } from '@testing-library/react';
import useGuideData from '../useGuideData';
import { useLeaderboardData } from '../../../hooks/useLeaderboardData';
import { useCountdown } from '../../../hooks/useCountdown';
import useCommunityHunts from '../../../hooks/useCommunityHunts';
import usePredictionRound from '../../hunts/usePredictionRound';
import useBallRound from '../../../hooks/useBallRound';
import useBallDrumCount from '../../../hooks/useBallDrumCount';
import { STREAM_DELAY_MS } from '../../../utils/giveaway';

jest.mock('../../../hooks/useLeaderboardData', () => ({ useLeaderboardData: jest.fn() }));
jest.mock('../../../hooks/useCountdown', () => ({ useCountdown: jest.fn() }));
jest.mock('../../../hooks/useCommunityHunts', () => jest.fn());
jest.mock('../../hunts/usePredictionRound', () => jest.fn());
jest.mock('../../../hooks/useBallRound', () => jest.fn());
jest.mock('../../../hooks/useBallDrumCount', () => jest.fn());

const NOW = 1_800_000_000_000;

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  useLeaderboardData.mockReturnValue({ endsAt: 1 });
  useCountdown.mockReturnValue({});
  useCommunityHunts.mockReturnValue({ live: null, recent: [], loading: false, error: null });
  usePredictionRound.mockReturnValue({ round: null, error: null });
  useBallDrumCount.mockReturnValue(null);
});
afterEach(() => jest.useRealTimers());

test('a just-settled ball round reads closed until its reveal is due, then settled', () => {
  const winner = { displayName: 'CoolGuy', multiplier: 412 };
  const round = { id: 'b1', status: 'settled', rack: [], winner, settledAt: { toMillis: () => NOW - 1000 } };
  useBallRound.mockReturnValue({ round, error: null });
  const { result } = renderHook(() => useGuideData());
  expect(result.current.ball.round.status).toBe('closed');
  expect(result.current.ball.round.winner).toBeUndefined();
  act(() => {
    jest.advanceTimersByTime(STREAM_DELAY_MS + 1000);
  });
  expect(result.current.ball.round.status).toBe('settled');
  expect(result.current.ball.round.winner).toEqual(winner);
});

test('the drum count is requested only while the visible round is open', () => {
  useBallRound.mockReturnValue({ round: { id: 'b2', status: 'open', rack: [] }, error: null });
  renderHook(() => useGuideData());
  expect(useBallDrumCount).toHaveBeenLastCalledWith('b2');

  useBallRound.mockReturnValue({ round: { id: 'b3', status: 'closed', rack: [] }, error: null });
  renderHook(() => useGuideData());
  expect(useBallDrumCount).toHaveBeenLastCalledWith(null);

  useBallRound.mockReturnValue({ round: undefined, error: null });
  renderHook(() => useGuideData());
  expect(useBallDrumCount).toHaveBeenLastCalledWith(null);
});
