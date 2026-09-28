import { renderHook, act } from '@testing-library/react';
import useWinnerAnnounce from '../useWinnerAnnounce';
import { postAction } from '../api';
import { CHAT_ANNOUNCE_DELAY_MS } from '../../../../utils/giveaway';

jest.mock('../api', () => ({
  postAction: jest.fn(),
  QUIET_ANNOUNCE: ['disabled', 'empty', 'already'],
}));

const NOW = 1_700_000_000_000;
const at = (ms) => ({ toMillis: () => ms });
const pick = (extra = {}) => ({
  id: 'g1',
  status: 'rolling',
  winnerTwitchId: 'tw1',
  rolledAt: at(NOW),
  announceWinner: true,
  winnerMessage: 'gg {winner}',
  announcedPick: null,
  ...extra,
});

async function advance(ms) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  postAction.mockReset();
  postAction.mockResolvedValue({ ok: true, status: 200, data: { announce: { posted: true } } });
});
afterEach(() => jest.useRealTimers());

test('posts once the reveal has played', async () => {
  renderHook(() => useWinnerAnnounce(pick()));
  await advance(CHAT_ANNOUNCE_DELAY_MS - 1);
  expect(postAction).not.toHaveBeenCalled();
  await advance(1);
  expect(postAction).toHaveBeenCalledWith('announce', { id: 'g1', winnerTwitchId: 'tw1', rolledAtMs: NOW });
});

test('an unarmed tab never posts but still reports posted from the doc', async () => {
  const { result } = renderHook(() => useWinnerAnnounce(pick({ announcedPick: `tw1:${NOW}` }), { armed: false }));
  await advance(CHAT_ANNOUNCE_DELAY_MS + 1_000);
  expect(postAction).not.toHaveBeenCalled();
  expect(result.current.posted).toBe(true);
});

test('an unarmed tab with nothing posted yet stays pending', async () => {
  const { result } = renderHook(() => useWinnerAnnounce(pick(), { armed: false }));
  await advance(CHAT_ANNOUNCE_DELAY_MS + 1_000);
  expect(postAction).not.toHaveBeenCalled();
  expect(result.current.posted).toBe(false);
  expect(result.current.dueAt).toBe(NOW + CHAT_ANNOUNCE_DELAY_MS);
});
