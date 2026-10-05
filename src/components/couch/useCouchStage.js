import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { coverBox, pctRect, viewRect, zoomTransform } from '../camera/cameraMath';
import { NAV_H } from '../nav/navMetrics';

// Measures the room's container, places the art over it like a cover image
// around the focal point, and turns a rect in percent of the art into the
// camera zoom that fills the view with it. Rects are computed from the box at
// rest, never measured off the (possibly transformed) stage.
export default function useCouchStage(aspect, focal) {
  const nodeRef = useRef(null);
  const stageRef = useRef(null);
  const [node, setNode] = useState(null);
  const [size, setSize] = useState(null);

  // A callback ref: the container can unmount and mount again (room <-> phone)
  // while this hook stays put, so the node lives in state and `.current` mirrors it.
  const containerRef = useCallback((el) => {
    nodeRef.current = el;
    setNode(el);
  }, []);
  containerRef.current = node;

  useLayoutEffect(() => {
    if (!node) {
      setSize(null);
      return undefined;
    }
    const read = () => setSize({ width: node.clientWidth, height: node.clientHeight });
    read();
    if (typeof ResizeObserver !== 'function') {
      window.addEventListener('resize', read);
      return () => window.removeEventListener('resize', read);
    }
    const ro = new ResizeObserver(read);
    ro.observe(node);
    return () => ro.disconnect();
  }, [node]);

  const zoomFor = useCallback(
    (rect) => {
      const c = nodeRef.current.getBoundingClientRect();
      const b = coverBox({ width: c.width, height: c.height }, aspect, focal);
      const stage = { x: c.left + b.left, y: c.top + b.top, width: b.width, height: b.height };
      return zoomTransform(stage, pctRect(stage, rect), viewRect(window, NAV_H));
    },
    [aspect, focal]
  );

  return { containerRef, stageRef, box: size ? coverBox(size, aspect, focal) : null, zoomFor };
}
