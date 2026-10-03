import { StrictMode } from 'react';
import { act, render } from '@testing-library/react';
import useOrder, { CALLING_MIN_MS, NETWORK_ERROR, RECEIVED_MS } from '../useOrder';
import { authedFetch } from '../../../utils/authedFetch';

jest.mock('../../../utils/authedFetch', () => ({ authedFetch: jest.fn() }));

let api;
function Probe() {
  api = useOrder();
  return null;
}
const ITEM = { id: 'blunt', name: 'Roll a blunt', cost: 420 };
const reply = (ok, body) => Promise.resolve({ ok, json: () => Promise.resolve(body) });

function setReducedMotion(on) {
  window.matchMedia = jest.fn((q) => ({ matches: on && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }));
}

beforeEach(() => setReducedMotion(true));
afterEach(() => {
  delete window.matchMedia;
  jest.useRealTimers();
});

test('a successful order is received, then the channel returns to idle', async () => {
  jest.useFakeTimers();
  authedFetch.mockReturnValue(reply(true, { ok: true, redemptionId: 'abcdR7Q2', status: 'pending' }));
  render(<Probe />);
  await act(async () => {
    await api.order(ITEM);
  });
  expect(api.phase).toBe('received');
  expect(api.orderId).toBe('abcdR7Q2');
  expect(api.item).toBe(ITEM);
  expect(authedFetch).toHaveBeenCalledWith('/api/store/redeem', { method: 'POST', body: JSON.stringify({ itemId: 'blunt' }) });
  act(() => {
    jest.advanceTimersByTime(RECEIVED_MS);
  });
  expect(api.phase).toBe('idle');
});

// Final review: only a known refusal guarantees nothing was spent. Anything
// else (a 500, a dropped connection) may have committed, so it is uncertain.
test.each([
  ['INSUFFICIENT_TICKETS', 'Not enough tickets.', true],
  ['OUT_OF_STOCK', 'Sold out while you were holding.', true],
  ['ITEM_INACTIVE', 'This one just went off the air.', true],
  ['USER_NOT_FOUND', "Your wallet isn't set up yet. Sign out and back in.", true],
  ['ITEM_INVALID_COST', 'This one just went off the air.', true],
  ['INTERNAL', NETWORK_ERROR, false],
])('%s lands on the busy line with a plain message', async (code, message, certain) => {
  authedFetch.mockReturnValue(reply(false, { error: code }));
  render(<Probe />);
  await act(async () => {
    await api.order(ITEM);
  });
  expect(api.phase).toBe('busy');
  expect(api.message).toBe(message);
  expect(api.certain).toBe(certain);
});

test('a dropped connection is uncertain; a missing session is a sure refusal', async () => {
  authedFetch.mockRejectedValue(new Error('Failed to fetch'));
  render(<Probe />);
  await act(async () => {
    await api.order(ITEM);
  });
  expect(api.message).toBe(NETWORK_ERROR);
  expect(api.certain).toBe(false);
  authedFetch.mockRejectedValue(new Error('NOT_AUTHENTICATED'));
  await act(async () => {
    await api.order(ITEM);
  });
  expect(api.message).toBe('Sign in with Twitch to order.');
  expect(api.certain).toBe(true);
});

test('a reply that is not JSON is uncertain', async () => {
  authedFetch.mockReturnValue(Promise.resolve({ ok: false, json: () => Promise.reject(new SyntaxError('Unexpected token <')) }));
  render(<Probe />);
  await act(async () => {
    await api.order(ITEM);
  });
  expect(api.message).toBe(NETWORK_ERROR);
  expect(api.certain).toBe(false);
});

// Final review: the dev-only StrictMode double mount left the hook stuck on "calling".
test('orders still land under StrictMode', async () => {
  authedFetch.mockReturnValue(reply(true, { redemptionId: 'x', status: 'pending' }));
  render(
    <StrictMode>
      <Probe />
    </StrictMode>
  );
  await act(async () => {
    await api.order(ITEM);
  });
  expect(api.phase).toBe('received');
});

test('only one order is ever in flight', async () => {
  let resolve;
  authedFetch.mockReturnValue(new Promise((r) => { resolve = r; }));
  render(<Probe />);
  let first;
  act(() => {
    first = api.order(ITEM);
    api.order(ITEM);
  });
  expect(authedFetch).toHaveBeenCalledTimes(1);
  expect(api.phase).toBe('calling');
  await act(async () => {
    resolve({ ok: true, json: () => Promise.resolve({ redemptionId: 'x', status: 'pending' }) });
    await first;
  });
  expect(api.phase).toBe('received');
});

test('reset is ignored while calling and clears a result after', async () => {
  let resolve;
  authedFetch.mockReturnValue(new Promise((r) => { resolve = r; }));
  render(<Probe />);
  let pending;
  act(() => {
    pending = api.order(ITEM);
  });
  act(() => api.reset());
  expect(api.phase).toBe('calling');
  await act(async () => {
    resolve({ ok: false, json: () => Promise.resolve({ error: 'OUT_OF_STOCK' }) });
    await pending;
  });
  expect(api.phase).toBe('busy');
  act(() => api.reset());
  expect(api.phase).toBe('idle');
});

test('the calling screen holds for the minimum time when motion is allowed', async () => {
  setReducedMotion(false);
  jest.useFakeTimers();
  authedFetch.mockReturnValue(reply(true, { redemptionId: 'x', status: 'pending' }));
  render(<Probe />);
  let done;
  act(() => {
    done = api.order(ITEM);
  });
  await act(async () => {
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
  });
  expect(api.phase).toBe('calling');
  await act(async () => {
    jest.advanceTimersByTime(CALLING_MIN_MS);
    await done;
  });
  expect(api.phase).toBe('received');
});
