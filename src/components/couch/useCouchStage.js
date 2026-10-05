import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { coverBox, pctRect, viewRect, zoomTransform } from '../camera/cameraMath';

// The container fills the window under the bar, so the window is the first
// guess at its size: the first commit already has a box.
function windowSize(navH) {
  if (typeof window === 'undefined') return null;
  const width = (document.documentElement && document.documentElement.clientWidth) || window.innerWidth;
  return { width, height: Math.max(0, window.innerHeight - navH) };
}

// Measures the room's container, places the art over it like a cover image
// around the focal point, and turns a rect in percent of the art into the
// camera zoom that fills the view with it. Rects are computed from the box at
// rest, never measured off the (possibly transformed) stage. `navH` is the bar
// above the view (0 on the home page, which has none).
export default function useCouchStage(aspect, focal, navH) {
  const nodeRef = useRef(null);
  const stageRef = useRef(null);
  const [node, setNode] = useState(null);
  const [size, setSize] = useState(() => windowSize(navH));

  // A callback ref: the container can unmount and mount again (room <-> phone)
  // while this hook stays put, so the node lives in state and `.current` mirrors it.
  const containerRef = useCallback((el) => {
    nodeRef.current = el;
    setNode(el);
  }, []);
  containerRef.current = node;

  // The measure keeps the guess when it was right (no second render), and the
  // size goes when the container does.
  useLayoutEffect(() => {
    if (!node) return undefined;
    const read = () => {
      const width = node.clientWidth;
      const height = node.clientHeight;
      setSize((s) => (s && s.width === width && s.height === height ? s : { width, height }));
    };
    read();
    let stop;
    if (typeof ResizeObserver !== 'function') {
      window.addEventListener('resize', read);
      stop = () => window.removeEventListener('resize', read);
    } else {
      const ro = new ResizeObserver(read);
      ro.observe(node);
      stop = () => ro.disconnect();
    }
    return () => {
      stop();
      setSize(null);
    };
  }, [node]);

  const zoomFor = useCallback(
    (rect) => {
      const c = nodeRef.current.getBoundingClientRect();
      const b = coverBox({ width: c.width, height: c.height }, aspect, focal);
      const stage = { x: c.left + b.left, y: c.top + b.top, width: b.width, height: b.height };
      return zoomTransform(stage, pctRect(stage, rect), viewRect(window, navH));
    },
    [aspect, focal, navH]
  );

  return { containerRef, stageRef, box: size ? coverBox(size, aspect, focal) : null, zoomFor, navH };
}
