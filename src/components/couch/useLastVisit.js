import { useEffect, useState } from 'react';

const KEY = 'gg_last_visit';

// Read once per page load and kept in the module: App remounts routes on every
// pathname change, so a per-mount read would pick up the timestamp the first
// mount just wrote and the New sticker would vanish mid-session.
let cached; // number | null | undefined
let loaded = false;

export function __resetLastVisitForTests() {
  cached = undefined;
  loaded = false;
}

function readOnce() {
  if (!loaded) {
    try {
      const raw = window.localStorage.getItem(KEY);
      cached = raw == null ? null : Number(raw) || null;
    } catch {
      cached = undefined;
    }
    loaded = true;
  }
  return cached;
}

// The viewer's previous visit (ms), read once per page load; the visit is then
// recorded after mount (not during render, so StrictMode's double render can't
// read its own write). null on a first visit; undefined when storage can't be
// read, which means "no New sticker".
export default function useLastVisit() {
  const [last] = useState(readOnce);
  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, String(Date.now()));
    } catch {
      // best-effort
    }
  }, []);
  return last;
}
