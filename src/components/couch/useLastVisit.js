import { useEffect, useState } from 'react';

const KEY = 'gg_last_visit';

// The viewer's previous visit (ms), read once per page load; the visit is then
// recorded after mount (not during render, so StrictMode's double render can't
// read its own write). null on a first visit; undefined when storage can't be
// read, which means "no New sticker".
export default function useLastVisit() {
  const [last] = useState(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      return raw == null ? null : Number(raw) || null;
    } catch {
      return undefined;
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, String(Date.now()));
    } catch {
      // best-effort
    }
  }, []);
  return last;
}
