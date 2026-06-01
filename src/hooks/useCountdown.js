import { useEffect, useState } from 'react';

function compute(endsAt) {
  const diff = endsAt - Date.now();
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isOver: true };
  }
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds, isOver: false };
}

export function useCountdown(endsAt) {
  const [remaining, setRemaining] = useState(() => compute(endsAt));

  useEffect(() => {
    setRemaining(compute(endsAt));
    const id = setInterval(() => setRemaining(compute(endsAt)), 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  return remaining;
}
