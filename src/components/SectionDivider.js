import { useEffect, useRef, useState } from 'react';

// Channel-flip divider between home page sections. A thin strip of broken
// "static" that does a one-shot horizontal-hold flicker the first time it
// scrolls into view. Pure CSS background, no canvas, no images.
export default function SectionDivider() {
  const ref = useRef(null);
  const [tripped, setTripped] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setTripped(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTripped(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} aria-hidden="true" className="relative h-[3px] overflow-hidden">
      <style>{`
        .gg-divider {
          height: 100%;
          opacity: 0.4;
          background-image: repeating-linear-gradient(
            90deg,
            rgba(250, 250, 250, 0.35) 0px,
            rgba(250, 250, 250, 0.35) 1px,
            transparent 1px,
            transparent 4px,
            rgba(250, 250, 250, 0.12) 4px,
            rgba(250, 250, 250, 0.12) 7px,
            transparent 7px,
            transparent 13px,
            rgba(16, 185, 129, 0.3) 13px,
            rgba(16, 185, 129, 0.3) 14px,
            transparent 14px,
            transparent 22px
          );
        }
        .gg-divider-flick {
          animation: gg-divider-hold 0.45s steps(7, end) 1;
        }
        @keyframes gg-divider-hold {
          0%   { background-position: 0 0;      opacity: 0.9; }
          15%  { background-position: -34px 0;  opacity: 0.5; }
          30%  { background-position: 18px 0;   opacity: 1; }
          45%  { background-position: -9px 0;   opacity: 0.45; }
          60%  { background-position: 27px 0;   opacity: 0.85; }
          80%  { background-position: -16px 0;  opacity: 0.6; }
          100% { background-position: 0 0;      opacity: 0.4; }
        }
        @media (prefers-reduced-motion: reduce) {
          .gg-divider-flick { animation: none; }
        }
      `}</style>
      <div className={`gg-divider ${tripped ? 'gg-divider-flick' : ''}`} />
    </div>
  );
}
