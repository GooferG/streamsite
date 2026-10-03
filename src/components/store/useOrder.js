import { useEffect, useRef, useState } from 'react';
import { authedFetch } from '../../utils/authedFetch';
import { prefersReducedMotion } from '../onAir/useChannelSwitch';

// The calling screen stays up at least this long so the bit lands even when
// the API answers fast; the received bumper holds for RECEIVED_MS.
export const CALLING_MIN_MS = 900;
export const RECEIVED_MS = 2600;

// Known refusals: the redeem transaction threw before committing, so nothing
// was spent. Anything else (a 500, a non-JSON reply, a dropped connection)
// may have committed, so the outcome is uncertain.
export const NETWORK_ERROR = 'The line dropped before we heard back.';
export const ORDER_ERRORS = {
  INSUFFICIENT_TICKETS: 'Not enough tickets.',
  OUT_OF_STOCK: 'Sold out while you were holding.',
  ITEM_INACTIVE: 'This one just went off the air.',
  ITEM_NOT_FOUND: 'This one just went off the air.',
  ITEM_INVALID_COST: 'This one just went off the air.',
  USER_NOT_FOUND: "Your wallet isn't set up yet. Sign out and back in.",
  NOT_AUTHENTICATED: 'Sign in with Twitch to order.',
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const refusal = (item, code) =>
  ORDER_ERRORS[code]
    ? { phase: 'busy', item, message: ORDER_ERRORS[code], certain: true }
    : { phase: 'busy', item, message: NETWORK_ERROR, certain: false };

// idle → calling → received | busy → idle. One order in flight at a time.
// A busy result says whether nothing was spent (certain) or the order may
// have gone through (not certain).
export default function useOrder() {
  const [state, setState] = useState({ phase: 'idle' });
  const inFlight = useRef(false);
  const mounted = useRef(true);

  // Set on every mount: StrictMode's dev double mount runs the cleanup once.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

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
        : refusal(item, data.error);
    } catch (err) {
      next = refusal(item, err && err.message);
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
