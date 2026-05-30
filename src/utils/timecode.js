import { useEffect, useState } from 'react';

// Ticking "now" clock, updated once per second. Used by the CRT/broadcast
// timecode rails across several pages.
export function useNowTimestamp() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

// Format a Date as a broadcast timecode. Default HH:MM:SS; pass { frames: true }
// for the HH:MM:SS:FF variant (FF = centiseconds) used on the About rail.
export function formatTimecode(d, { frames = false } = {}) {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  if (!frames) return `${hh}:${mm}:${ss}`;
  const ff = String(d.getMilliseconds()).slice(0, 2).padStart(2, '0');
  return `${hh}:${mm}:${ss}:${ff}`;
}
