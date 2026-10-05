import { useEffect, useState } from 'react';

const MANIFEST = '/tv/reel/manifest.json';

// The curated reel from scripts/tv-reel, fetched once after the page is idle.
// null until then; [] when there is no reel (a missing file, or the dev
// server's HTML fallback, fails to parse).
export default function useTvReel() {
  const [reel, setReel] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1200));
    const cancelIdle = window.cancelIdleCallback || clearTimeout;
    const handle = idle(() => {
      fetch(MANIFEST)
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          if (!cancelled) setReel(Array.isArray(data) ? data : []);
        })
        .catch(() => {
          if (!cancelled) setReel([]);
        });
    });
    return () => {
      cancelled = true;
      cancelIdle(handle);
    };
  }, []);
  return reel;
}
