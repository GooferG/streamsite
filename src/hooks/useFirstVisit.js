import { useCallback, useState } from 'react';

// Returns [seen, markSeen] for a localStorage flag at `key`.
// If storage is unavailable (private mode, disabled, SSR), treat as "seen"
// so a first-visit gate never traps the user.
export function useFirstVisit(key) {
  const [seen, setSeen] = useState(() => {
    try {
      return window.localStorage.getItem(key) != null;
    } catch {
      return true;
    }
  });

  const markSeen = useCallback(() => {
    setSeen(true);
    try {
      window.localStorage.setItem(key, '1');
    } catch {
      // best-effort; the in-memory flag still flips
    }
  }, [key]);

  return [seen, markSeen];
}
