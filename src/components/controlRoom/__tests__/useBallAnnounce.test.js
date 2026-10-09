import { renderHook, waitFor } from '@testing-library/react';
import { useBallDrawAnnounce, useBallResultsAnnounce } from '../useBallAnnounce';
import { ballAction } from '../ballApi';

jest.mock('../ballApi', () => ({
  ballAction: jest.fn(),
  announceProblem: jest.requireActual('../ballApi').announceProblem,
}));
jest.mock('../../../utils/authedFetch', () => ({ authedFetch: jest.fn() }));

const at = (ms) => ({ toMillis: () => ms });
const entry = (drawNo, agoMs) => ({ drawNo, slotName: 'X', displayName: 'Y', drawnAt: at(Date.now() - agoMs), scratched: false });

beforeEach(() => {
  ballAction.mockResolvedValue({ ok: true, status: 200, data: { ok: true, announce: { posted: true } } });
});

test('posts every due draw line once, only in the driving tab', async () => {
  const round = { id: 'r1', rack: [entry(1, 30_000), entry(2, 20_000)], announced: { draws: {} } };
  const { rerender } = renderHook(({ armed }) => useBallDrawAnnounce(round, { armed }), { initialProps: { armed: false } });
  expect(ballAction).not.toHaveBeenCalled();
  rerender({ armed: true });
  await waitFor(() => expect(ballAction).toHaveBeenCalledTimes(2));
  expect(ballAction).toHaveBeenCalledWith({ action: 'announce', id: 'r1', event: 'draw', drawNo: 1 });
  expect(ballAction).toHaveBeenCalledWith({ action: 'announce', id: 'r1', event: 'draw', drawNo: 2 });
  rerender({ armed: true });
  expect(ballAction).toHaveBeenCalledTimes(2);
});

test('a refused line surfaces an error', async () => {
  ballAction.mockResolvedValue({ ok: true, status: 200, data: { ok: true, announce: { posted: false, reason: 'CHAT_DROPPED:x' } } });
  const round = { id: 'r1', rack: [entry(1, 30_000)], announced: { draws: {} } };
  const { result } = renderHook(() => useBallDrawAnnounce(round, { armed: true }));
  await waitFor(() => expect(result.current.error).toBe('CHAT_DROPPED:x'));
});

test('results post after the stream delay, once', async () => {
  const round = { id: 'r1', status: 'settled', settledAt: at(Date.now() - 4000), winner: { drawNo: 1 }, announced: {} };
  renderHook(() => useBallResultsAnnounce(round, { armed: true }));
  await waitFor(() => expect(ballAction).toHaveBeenCalledWith({ action: 'announce', id: 'r1', event: 'results' }));
});
