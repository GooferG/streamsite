import { useEffect, useState } from 'react';

// A clock that ticks every intervalMs while enabled (the monitor's live clock
// and the lineup's "5m ago").
export default function useNow(intervalMs, enabled = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return undefined;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs, enabled]);
  return now;
}
