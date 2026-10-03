import { useEffect, useRef, useState } from 'react';

export const SWITCH_MS = 420;

export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

// Channel-change state for the Monitor. Each time `key` moves from one real
// value to another, the CH knob turns a notch and (motion allowing) the static
// burst shows for SWITCH_MS. A null key means "still loading": the first real
// key after it never counts, so first paint and first data load stay quiet.
// Comparing against the previous key (not a "mounted" flag) keeps React's
// StrictMode double-run of mount effects from faking a switch.
export default function useChannelSwitch(key) {
  const prev = useRef(key);
  const [state, setState] = useState({ switching: false, turns: 0 });

  useEffect(() => {
    if (prev.current === key) return undefined;
    const from = prev.current;
    prev.current = key;
    if (from == null || key == null) return undefined;
    const reduce = prefersReducedMotion();
    setState((s) => ({ switching: !reduce, turns: s.turns + 1 }));
    if (reduce) return undefined;
    const t = setTimeout(() => setState((s) => ({ ...s, switching: false })), SWITCH_MS);
    return () => clearTimeout(t);
  }, [key]);

  return state;
}
