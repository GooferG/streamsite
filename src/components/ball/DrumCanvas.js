import { useEffect, useRef } from 'react';
import { BALL_R, createDrum, resizeDrum, stepDrum } from './drumPhysics';
import { CANVAS, DECALS } from './canvasPalette';

export const MAX_BALLS = 60;

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// The balls inside the glass. One canvas, a requestAnimationFrame loop that
// pauses with the tab, at most MAX_BALLS drawn ("+N more" past that). Each
// ball wears its slot art as a round decal once the image loads.
export default function DrumCanvas({ balls = [], count, blowing = false, still = false, maxBalls = MAX_BALLS, className = '' }) {
  const canvasRef = useRef(null);
  const total = count ?? balls.length;
  const shown = Math.min(total, maxBalls);
  const drumRef = useRef(null);
  if (!drumRef.current) drumRef.current = createDrum(shown);
  const live = useRef({ balls, blowing });
  live.current = { balls, blowing };

  useEffect(() => {
    resizeDrum(drumRef.current, shown);
  }, [shown]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas && typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
    if (!ctx) return undefined;
    const images = new Map();
    const imageFor = (url) => {
      if (!url) return null;
      if (!images.has(url)) {
        const img = new Image();
        img.src = url;
        images.set(url, img);
      }
      const img = images.get(url);
      return img.complete && img.naturalWidth > 0 ? img : null;
    };

    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const R = Math.min(w, h) / 2;
      const cx = w / 2;
      const cy = h / 2;
      const br = BALL_R * R;
      const data = live.current.balls;
      drumRef.current.balls.forEach((b, i) => {
        const x = cx + b.x * R;
        const y = cy + b.y * R;
        const grad = ctx.createRadialGradient(x - br * 0.32, y - br * 0.4, br * 0.1, x, y, br);
        grad.addColorStop(0, CANVAS.white);
        grad.addColorStop(0.45, CANVAS.paper);
        grad.addColorStop(1, CANVAS.shade);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, br, 0, Math.PI * 2);
        ctx.fill();
        const ball = data[i];
        const decal = br * 0.52;
        const art = imageFor(ball && ball.thumb);
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, decal, 0, Math.PI * 2);
        ctx.clip();
        if (art) ctx.drawImage(art, x - decal, y - decal, decal * 2, decal * 2);
        else {
          ctx.fillStyle = DECALS[hash(String((ball && (ball.slotId || ball.id)) || i)) % DECALS.length];
          ctx.fill();
        }
        ctx.restore();
      });
    };

    if (still) {
      draw();
      return undefined;
    }
    let raf = 0;
    let last = 0;
    const loop = (t) => {
      const dt = last ? Math.min(0.033, (t - last) / 1000) : 1 / 60;
      last = t;
      if (!document.hidden) {
        stepDrum(drumRef.current, dt, live.current.blowing ? 1 : 0.22);
        draw();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [still]);

  const more = total - shown;
  return (
    <div className={`relative ${className}`}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
      {more > 0 && (
        <span className="absolute bottom-[10%] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/60 px-2 py-0.5 font-onair-mono text-[0.625rem] font-bold uppercase tracking-[0.15em] text-white">
          +{more} more
        </span>
      )}
    </div>
  );
}
