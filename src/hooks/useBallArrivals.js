import { useEffect, useRef } from 'react';
import { arrivals, ballSignature } from '../utils/ball';

// Calls onArrive for each ball that lands in the drum after the first ready
// snapshot (new callers and swaps), never for the backlog already there.
export default function useBallArrivals(balls, ready, onArrive) {
  const signature = useRef(null);
  const callback = useRef(onArrive);
  callback.current = onArrive;
  useEffect(() => {
    if (!ready) {
      signature.current = null;
      return;
    }
    if (signature.current) arrivals(signature.current, balls).forEach((a) => callback.current(a));
    signature.current = ballSignature(balls);
  }, [balls, ready]);
}
