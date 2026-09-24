import { useEffect, useState } from 'react';

/**
 * Current time in ms, re-rendering the caller as it ticks.
 *
 * `fast` switches to requestAnimationFrame for animation-accurate frames
 * (the giveaway reveal); otherwise it ticks every `intervalMs`. Pass
 * `active: false` to stop ticking entirely.
 */
export function useClock({ fast = false, intervalMs = 500, active = true } = {}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return undefined;
    setNow(Date.now());
    if (fast) {
      let raf;
      const loop = () => {
        setNow(Date.now());
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(raf);
    }
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [fast, intervalMs, active]);

  return now;
}

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e) => setReduced(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return reduced;
}
