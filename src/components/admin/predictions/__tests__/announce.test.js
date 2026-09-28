import { renderHook, act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import useResultsAnnounce, { AUTO_POST_WINDOW_MS } from '../useResultsAnnounce';
import ChatStatus from '../ChatStatus';
import { authedFetch } from '../../../../utils/authedFetch';
import { STREAM_DELAY_MS } from '../../../../utils/giveaway';

jest.mock('../../../../utils/authedFetch', () => ({ authedFetch: jest.fn() }));

const reply = (ok, body) => Promise.resolve({ ok, json: () => Promise.resolve(body) });
const at = (ms) => ({ toMillis: () => ms });
const settled = (settledMs, extra = {}) => ({
  id: 'r1',
  status: 'settled',
  announce: true,
  announced: { opened: at(1), locked: at(2), results: null },
  settledAt: at(settledMs),
  ...extra,
});

describe('useResultsAnnounce', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('posts results once the stream delay has passed', async () => {
    authedFetch.mockReturnValue(reply(true, { ok: true, announce: { posted: true } }));
    const now = Date.now();
    const { result } = renderHook(() => useResultsAnnounce(settled(now)));
    act(() => {
      jest.advanceTimersByTime(STREAM_DELAY_MS - 1);
    });
    expect(authedFetch).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(1);
    });
    // Wait for the post to fully settle (not just for the fetch call) so the
    // hook's trailing state update lands inside waitFor's act scope instead
    // of leaking into a later tick.
    await waitFor(() => expect(result.current.posting).toBe(false));
    expect(authedFetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(authedFetch.mock.calls[0][1].body)).toEqual({
      action: 'announce',
      id: 'r1',
      event: 'results',
    });
  });

  test('stale results never auto-post', () => {
    const old = Date.now() - AUTO_POST_WINDOW_MS - 1;
    renderHook(() => useResultsAnnounce(settled(old)));
    act(() => {
      jest.advanceTimersByTime(60000);
    });
    expect(authedFetch).not.toHaveBeenCalled();
  });

  test('nothing posts when the round has announcements off', () => {
    const now = Date.now();
    renderHook(() => useResultsAnnounce(settled(now, { announce: false })));
    act(() => {
      jest.advanceTimersByTime(60000);
    });
    expect(authedFetch).not.toHaveBeenCalled();
  });

  // Review Focus 3: a failed post releases the claim; the timer must not loop.
  test('a failed auto-post is not retried on its own', async () => {
    authedFetch.mockReturnValue(
      reply(true, { ok: true, announce: { posted: false, reason: 'CHAT_DROPPED:spam' } })
    );
    const start = Date.now();
    const { result, rerender } = renderHook(({ round }) => useResultsAnnounce(round), {
      initialProps: { round: settled(start) },
    });
    act(() => {
      jest.advanceTimersByTime(STREAM_DELAY_MS);
    });
    await waitFor(() => expect(result.current.error).toBe('CHAT_DROPPED:spam'));
    // The server claimed and then released the post.
    rerender({ round: settled(start, { announced: { opened: at(1), locked: at(2), results: at(start + 3000) } }) });
    rerender({ round: settled(start) });
    act(() => {
      jest.advanceTimersByTime(STREAM_DELAY_MS * 2);
    });
    expect(authedFetch).toHaveBeenCalledTimes(1);
  });
});

describe('ChatStatus', () => {
  test('reads off when the round does not announce', () => {
    render(<ChatStatus round={{ id: 'r1', status: 'open', announce: false }} results={null} />);
    expect(screen.getByText(/chat announce off/i)).toBeTruthy();
  });

  test('shows posted and not-yet states', () => {
    render(
      <ChatStatus
        round={{ id: 'r1', status: 'open', announce: true, announced: { opened: at(1), locked: null, results: null } }}
        results={null}
      />
    );
    expect(screen.getByText('posted')).toBeTruthy();
    expect(screen.getAllByText('not yet')).toHaveLength(2);
  });

  // Review Focus F4: a reached-but-unposted line whose moment has passed
  // (round moved on to locked/settled) must not offer a stale Retry — posting
  // "Predictions are open!" for a closed round would be wrong.
  test('a reached-but-unposted line that is no longer current shows skipped, not a button', () => {
    render(
      <ChatStatus
        round={{
          id: 'r1',
          status: 'settled',
          announce: true,
          announced: { opened: null, locked: at(1), results: at(2) },
        }}
        results={null}
      />
    );
    expect(screen.queryByRole('button', { name: /retry opened/i })).toBeNull();
    expect(screen.getByText('skipped')).toBeTruthy();
  });

  test('an unposted opened message offers Retry', async () => {
    authedFetch.mockReturnValue(reply(true, { ok: true, announce: { posted: true } }));
    render(
      <ChatStatus
        round={{ id: 'r1', status: 'open', announce: true, announced: { opened: null, locked: null, results: null } }}
        results={null}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /retry opened/i }));
    await waitFor(() => expect(authedFetch).toHaveBeenCalledTimes(1));
    expect(JSON.parse(authedFetch.mock.calls[0][1].body)).toEqual({
      action: 'announce',
      id: 'r1',
      event: 'opened',
    });
  });
});
