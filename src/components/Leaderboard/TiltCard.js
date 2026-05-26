import { useRef, useState } from 'react';

const ZERO_TILT = { rx: 0, ry: 0, gx: 50, gy: 50, active: false };

export default function TiltCard({
  children,
  maxTiltDeg = 10,
  scale = 1.02,
  glareOpacity = 0.35,
  className = '',
}) {
  const ref = useRef(null);
  const [tilt, setTilt] = useState(ZERO_TILT);

  const handleMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    setTilt({
      rx: (py - 0.5) * -2 * maxTiltDeg,
      ry: (px - 0.5) * 2 * maxTiltDeg,
      gx: px * 100,
      gy: py * 100,
      active: true,
    });
  };

  const handleLeave = () => setTilt(ZERO_TILT);

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={`relative will-change-transform transition-transform duration-200 motion-reduce:transform-none motion-reduce:transition-none ${className}`}
      style={{
        transform: `perspective(1000px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale(${tilt.active ? scale : 1})`,
        transformStyle: 'preserve-3d',
      }}
    >
      {children}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-200 motion-reduce:hidden"
        style={{
          opacity: tilt.active ? glareOpacity : 0,
          backgroundImage:
            'repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(255,255,255,0.5) 2px, rgba(255,255,255,0.5) 3px)',
          maskImage: `radial-gradient(circle at ${tilt.gx}% ${tilt.gy}%, black 0%, transparent 55%)`,
          WebkitMaskImage: `radial-gradient(circle at ${tilt.gx}% ${tilt.gy}%, black 0%, transparent 55%)`,
          mixBlendMode: 'screen',
        }}
      />
    </div>
  );
}
