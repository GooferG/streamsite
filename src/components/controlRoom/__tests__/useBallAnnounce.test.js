import { act, renderHook, waitFor } from '@testing-library/react';
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

test('one draw succeeding never clears another draw failure; retry re-posts only the failed one', async () => {
  ballAction.mockImplementation(async (body) =>
    body.drawNo === 1
      ? { ok: true, status: 200, data: { ok: true, announce: { posted: false, reason: 'CHAT_DROPPED:x' } } }
      : { ok: true, status: 200, data: { ok: true, announce: { posted: true } } }
  );
  const round = { id: 'r1', rack: [entry(1, 30_000), entry(2, 20_000)], announced: { draws: {} } };
  const { result } = renderHook(() => useBallDrawAnnounce(round, { armed: true }));
  await waitFor(() => expect(ballAction).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(result.current.error).toBe('CHAT_DROPPED:x'));
  ballAction.mockClear();
  await act(async () => {
    result.current.retry();
  });
  expect(ballAction).toHaveBeenCalledTimes(1);
  expect(ballAction).toHaveBeenCalledWith({ action: 'announce', id: 'r1', event: 'draw', drawNo: 1 });
});

test('a failure from another round never shows', async () => {
  ballAction.mockResolvedValue({ ok: true, status: 200, data: { ok: true, announce: { posted: false, reason: 'CHAT_DROPPED:x' } } });
  const r1 = { id: 'r1', rack: [entry(1, 30_000)], announced: { draws: {} } };
  const { result, rerender } = renderHook(({ round }) => useBallDrawAnnounce(round, { armed: true }), { initialProps: { round: r1 } });
  await waitFor(() => expect(result.current.error).toBe('CHAT_DROPPED:x'));
  rerender({ round: { id: 'r2', rack: [], announced: { draws: {} } } });
  expect(result.current.error).toBeNull();
});

describe('scratch lines', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('a scratch line is not posted before that draw\'s line time, then once', async () => {
    // Drawn 5s ago: the draw line would be due in 6s.
    const scratched = { ...entry(1, 5_000), scratched: true };
    const round = { id: 'r1', rack: [scratched], announced: { draws: {}, scratches: {} } };
    renderHook(() => useBallDrawAnnounce(round, { armed: true }));
    act(() => {
      jest.advanceTimersByTime(5_500);
    });
    expect(ballAction).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(1_000);
    });
    expect(ballAction).toHaveBeenCalledTimes(1);
    expect(ballAction).toHaveBeenCalledWith({ action: 'announce', id: 'r1', event: 'scratch', drawNo: 1 });
  });
});

test('a TOO_EARLY retry survives a new draw landing', async () => {
  jest.useFakeTimers();
  try {
    ballAction.mockResolvedValueOnce({ ok: false, status: 409, data: { error: 'TOO_EARLY' } });
    const r1 = { id: 'r1', rack: [entry(1, 30_000)], announced: { draws: {} } };
    const { rerender } = renderHook(({ round }) => useBallDrawAnnounce(round, { armed: true }), { initialProps: { round: r1 } });
    await act(async () => {
      jest.advanceTimersByTime(10);
    });
    expect(ballAction).toHaveBeenCalledTimes(1);
    rerender({ round: { ...r1, rack: [entry(1, 30_000), entry(2, 0)] } });
    await act(async () => {
      jest.advanceTimersByTime(1600);
    });
    expect(ballAction.mock.calls.filter(([b]) => b.drawNo === 1)).toHaveLength(2);
  } finally {
    jest.useRealTimers();
  }
});
