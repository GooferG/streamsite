import { act, render, waitFor } from '@testing-library/react';
import useRecentClips from '../useRecentClips';
import { getGameNames, getTwitchAccessToken, getTwitchClipsBetween, getTwitchUserId } from '../../../utils/twitchApi';

jest.mock('../../../utils/twitchApi', () => ({
  getTwitchAccessToken: jest.fn(),
  getTwitchUserId: jest.fn(),
  getTwitchClipsBetween: jest.fn(),
  getGameNames: jest.fn(),
}));

function Probe({ onValue }) {
  onValue(useRecentClips());
  return null;
}

beforeEach(() => {
  getTwitchAccessToken.mockResolvedValue('tok');
  getTwitchUserId.mockResolvedValue('42');
  getTwitchClipsBetween.mockResolvedValue([{ id: 'a', game_id: '498566' }]);
  getGameNames.mockResolvedValue({ 498566: 'Slots' });
});

test('fetches the last 60 days once and names the games', async () => {
  let value;
  render(<Probe onValue={(v) => { value = v; }} />);
  expect(value).toEqual([]);
  await waitFor(() => expect(value).toEqual([{ id: 'a', game_id: '498566', game_name: 'Slots' }]));
  expect(getTwitchClipsBetween).toHaveBeenCalledTimes(1);
  const [token, userId, startedAt, endedAt] = getTwitchClipsBetween.mock.calls[0];
  expect([token, userId]).toEqual(['tok', '42']);
  expect(Date.parse(endedAt) - Date.parse(startedAt)).toBe(60 * 86400000);
  expect(Math.abs(Date.parse(endedAt) - Date.now())).toBeLessThan(5000);
  expect(getGameNames).toHaveBeenCalledWith('tok', ['498566']);
});

test('a failed fetch leaves an empty list', async () => {
  getTwitchClipsBetween.mockRejectedValue(new Error('Helix clips 500'));
  let value;
  render(<Probe onValue={(v) => { value = v; }} />);
  await waitFor(() => expect(getTwitchClipsBetween).toHaveBeenCalled());
  await act(async () => {});
  expect(value).toEqual([]);
});

test('leaving the page before the clips land sets nothing', async () => {
  let resolve;
  getTwitchClipsBetween.mockImplementation(() => new Promise((r) => { resolve = r; }));
  let value;
  const { unmount } = render(<Probe onValue={(v) => { value = v; }} />);
  await waitFor(() => expect(getTwitchClipsBetween).toHaveBeenCalled());
  unmount();
  await act(async () => resolve([{ id: 'late', game_id: '1' }]));
  expect(value).toEqual([]);
});
