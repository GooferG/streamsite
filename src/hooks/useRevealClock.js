import { useEffect, useState } from 'react';
import { spoilerSafe } from '../utils/ball';

// Looks again at the next held-back reveal (draw or settle), so the page
// shows each one when its chat line is due and not before.
export default function useRevealClock(data) {
  const [now, setNow] = useState(() => Date.now());
  const { nextAt } = spoilerSafe({ round: data.round, balls: data.balls, past: data.past }, now);
  useEffect(() => {
    if (nextAt == null) return undefined;
    const id = setTimeout(() => setNow(Date.now()), Math.max(0, nextAt - Date.now()) + 25);
    return () => clearTimeout(id);
  }, [nextAt]);
  return now;
}
