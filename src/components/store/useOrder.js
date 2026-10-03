import { useEffect, useRef, useState } from 'react';
import { authedFetch } from '../../utils/authedFetch';
import { prefersReducedMotion } from '../onAir/useChannelSwitch';

// The calling screen stays up at least this long so the bit lands even when
// the API answers fast; the received bumper holds for RECEIVED_MS.
export const CALLING_MIN_MS = 900;
export const RECEIVED_MS = 2600;

export const NETWORK_ERROR = 'Lines are busy. Try again in a sec.';
export const ORDER_ERRORS = {
  INSUFFICIENT_TICKETS: 'Not enough tickets.',
  OUT_OF_STOCK: 'Sold out while you were holding.',
  ITEM_INACTIVE: 'This one just went off the air.',
  ITEM_NOT_FOUND: 'This one just went off the air.',
  USER_NOT_FOUND: "Your wallet isn't set up yet. Sign out and back in.",
  NOT_AUTHENTICATED: 'Sign in with Twitch to order.',
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// idle → calling → received | busy → idle. One order in flight at a time; the
// redeem transaction guarantees a busy result spent nothing.
export default function useOrder() {
  const [state, setState] = useState({ phase: 'idle' });
  const inFlight = useRef(false);
  const mounted = useRef(true);

  useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );

  useEffect(() => {
    if (state.phase !== 'received') return undefined;
    const t = setTimeout(() => setState({ phase: 'idle' }), RECEIVED_MS);
    return () => clearTimeout(t);
  }, [state]);

  async function order(item) {
    if (inFlight.current) return;
    inFlight.current = true;
    setState({ phase: 'calling', item });
    const started = Date.now();
    let next;
    try {
      const res = await authedFetch('/api/store/redeem', { method: 'POST', body: JSON.stringify({ itemId: item.id }) });
      const data = await res.json().catch(() => ({}));
      next = res.ok
        ? { phase: 'received', item, orderId: data.redemptionId, status: data.status }
        : { phase: 'busy', item, message: ORDER_ERRORS[data.error] || NETWORK_ERROR };
    } catch (err) {
      next = { phase: 'busy', item, message: ORDER_ERRORS[err && err.message] || NETWORK_ERROR };
    }
    const left = prefersReducedMotion() ? 0 : CALLING_MIN_MS - (Date.now() - started);
    if (left > 0) await wait(left);
    inFlight.current = false;
    if (mounted.current) setState(next);
  }

  function reset() {
    if (!inFlight.current) setState({ phase: 'idle' });
  }

  return { ...state, order, reset };
}
