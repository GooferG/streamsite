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
  const [val, setVal] = useState(prefersReducedMotion() ? safeTarget : 0);
  // Mirrors the value currently on screen so a mid-ramp target change continues
  // from the displayed value instead of jumping back to the last settled one.
  const valRef = useRef(prefersReducedMotion() ? safeTarget : 0);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setVal(safeTarget);
      valRef.current = safeTarget;
      return undefined;
    }

    const from = valRef.current;
    const delta = safeTarget - from;
    let raf;
    let start;
    let delayTimer;

    const tick = (now) => {
      if (start == null) start = now;
      const p = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      const next = from + delta * eased;
      setVal(next);
      valRef.current = next;
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setVal(safeTarget);
        valRef.current = safeTarget;
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
