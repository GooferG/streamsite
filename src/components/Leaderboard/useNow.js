import { useEffect, useState } from 'react';

// Ticking wall-clock used by themes for countdowns. One interval, lifted to the
// Leaderboard wrapper so all themes share a single timer.
export default function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}
