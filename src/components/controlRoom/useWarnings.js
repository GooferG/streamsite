import { useCallback, useEffect, useRef, useState } from 'react';

// A short queue of operator warnings. Sticky ones (timer failures) stay until
// dismissed, no matter how many other warnings follow; non-sticky ones clear
// after ttlMs and are capped at the newest 3. The same message never stacks.
export function useWarnings({ ttlMs = 8000 } = {}) {
  const [warnings, setWarnings] = useState([]);
  const seq = useRef(0);
  const timers = useRef(new Map());

  // Any entry we drop (via dedupe or the non-sticky cap) must have its
  // pending auto-dismiss timer cancelled too, or it fires later and tries to
  // dismiss an id that's already gone (harmless, but leaks a timer handle).
  const clearTimer = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  const dismissWarning = useCallback(
    (id) => {
      setWarnings((list) => list.filter((w) => w.id !== id));
      clearTimer(id);
    },
    [clearTimer]
  );

  const pushWarning = useCallback(
    (message, { sticky = false } = {}) => {
      seq.current += 1;
      const id = seq.current;
      setWarnings((list) => {
        // Dedupe: an earlier entry with the same message loses its timer.
        const deduped = list.filter((w) => {
          if (w.message !== message) return true;
          clearTimer(w.id);
          return false;
        });
        const next = [...deduped, { id, message, sticky }];
        // Sticky entries stay forever; only the newest 3 non-sticky survive.
        // Walk newest-to-oldest so "newest" means most recently pushed.
        let nonStickySeen = 0;
        const evictIds = new Set();
        for (let i = next.length - 1; i >= 0; i -= 1) {
          const w = next[i];
          if (w.sticky) continue;
          nonStickySeen += 1;
          if (nonStickySeen > 3) evictIds.add(w.id);
        }
        evictIds.forEach(clearTimer);
        return next.filter((w) => !evictIds.has(w.id));
      });
      if (!sticky) timers.current.set(id, setTimeout(() => dismissWarning(id), ttlMs));
      return id;
    },
    [clearTimer, dismissWarning, ttlMs]
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => clearTimeout(t));
  }, []);

  return { warnings, pushWarning, dismissWarning };
}
