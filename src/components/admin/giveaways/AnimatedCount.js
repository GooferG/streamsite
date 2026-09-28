import { useEffect, useRef, useState } from 'react';

export default function AnimatedCount({ value }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  useEffect(() => {
    if (value === prevRef.current) return;
    // Roll up briefly when entries increment
    const start = prevRef.current;
    const end = value;
    if (end <= start) {
      setDisplay(end);
      prevRef.current = end;
      return;
    }
    const duration = 300;
    const startTs = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - startTs) / duration);
      const v = Math.round(start + (end - start) * t);
      setDisplay(v);
      if (t < 1) raf = requestAnimationFrame(tick);
      else prevRef.current = end;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <span className="tabular-nums">
      {String(display).padStart(4, '0')}
    </span>
  );
}
