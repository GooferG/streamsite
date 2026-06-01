import { useEffect, useRef, useState } from 'react';

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Ramps a number toward `target` with easeOutCubic. First mount ramps 0 →
// target; subsequent target changes ramp the previous settled value → target,
// so the periodic data re-poll reads as a tick-up rather than a re-sweep from 0.
// Under prefers-reduced-motion, jumps straight to target (no animation).
export default function useCountUp(target, { durationMs = 1500, delayMs = 200 } = {}) {
  const safeTarget = Number.isFinite(target) ? target : 0;
  const [val, setVal] = useState(safeTarget && prefersReducedMotion() ? safeTarget : 0);
  const prevRef = useRef(prefersReducedMotion() ? safeTarget : 0);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setVal(safeTarget);
      prevRef.current = safeTarget;
      return undefined;
    }

    const from = prevRef.current;
    const delta = safeTarget - from;
    let raf;
    let start;
    let delayTimer;

    const tick = (now) => {
      if (start == null) start = now;
      const p = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setVal(from + delta * eased);
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setVal(safeTarget);
        prevRef.current = safeTarget;
      }
    };

    delayTimer = setTimeout(() => {
      raf = requestAnimationFrame(tick);
    }, delayMs);

    return () => {
      clearTimeout(delayTimer);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [safeTarget, durationMs, delayMs]);

  return val;
}
