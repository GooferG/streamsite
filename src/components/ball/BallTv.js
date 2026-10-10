import { useEffect, useState } from 'react';
import './ball.css';

// The draw and winner moments play in a TV in the middle of the stream, like
// the giveaway reveal: the stream dims behind it, and the full 16:9 WGOOF set
// renders at canvas width and is scaled down into the screen, so every
// vw-sized part of the set keeps its proportions.
const SHARE = 0.56; // of the canvas width
const MAX_HEIGHT = 0.9; // of the canvas height, for short, wide windows

export function tvBox(vw, vh) {
  const width = Math.min(vw * SHARE, vh * MAX_HEIGHT * (16 / 9));
  return { width, height: (width * 9) / 16, scale: width / vw, innerWidth: vw, innerHeight: (vw * 9) / 16 };
}

const viewport = () => [window.innerWidth, window.innerHeight];

function useViewport() {
  const [size, setSize] = useState(viewport);
  useEffect(() => {
    const onResize = () => setSize(viewport());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return size;
}

export default function BallTv({ out = false, children }) {
  const [vw, vh] = useViewport();
  const box = tvBox(vw, vh);
  return (
    <div className={`gb-tv-dim fixed inset-0 flex items-center justify-center ${out ? 'gb-cut-out' : ''}`} role="presentation">
      <div data-testid="ball-tv" className="gb-tv relative overflow-hidden" style={{ width: box.width, height: box.height }}>
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ width: box.innerWidth, height: box.innerHeight, transform: `scale(${box.scale})` }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
