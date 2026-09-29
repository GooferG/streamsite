import { useCallback, useEffect, useRef, useState } from 'react';

// A short queue of operator warnings. Sticky ones (timer failures) stay until
// dismissed; the rest clear after ttlMs. The same message never stacks.
export function useWarnings({ ttlMs = 8000 } = {}) {
  const [warnings, setWarnings] = useState([]);
  const seq = useRef(0);
  const timers = useRef(new Map());

  const dismissWarning = useCallback((id) => {
    setWarnings((list) => list.filter((w) => w.id !== id));
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  const pushWarning = useCallback(
    (message, { sticky = false } = {}) => {
      seq.current += 1;
      const id = seq.current;
      setWarnings((list) => [...list.filter((w) => w.message !== message), { id, message, sticky }].slice(-3));
      if (!sticky) timers.current.set(id, setTimeout(() => dismissWarning(id), ttlMs));
      return id;
    },
    [dismissWarning, ttlMs]
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => clearTimeout(t));
  }, []);

  return { warnings, pushWarning, dismissWarning };
}
