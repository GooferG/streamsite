import { useEffect, useRef, useState } from 'react';
import {
  DOCK_MAX,
  DOCK_MIN,
  RESIZE_STEP,
  RESIZE_STEP_BIG,
  clampDockW,
  resizeFrom,
} from './geometry';

const CURSORS = {
  l: 'ew-resize',
  r: 'ew-resize',
  b: 'ns-resize',
  bl: 'nesw-resize',
  br: 'nwse-resize',
  dock: 'ew-resize',
};

// Resize handles for the floating panel (left, right, bottom, both bottom
// corners) and the dock (its left edge). A pointer drag previews through
// onPreview and commits once on release; a lost pointer commits nothing. The
// grip (the corner facing the screen centre) and the dock edge also take
// arrow keys, which commit each step.
export default function ResizeHandles({ mode, view, side, dockW, getStart, onPreview, onCommit, onEnd }) {
  const gesture = useRef(null);
  // The grip keeps its corner while a gesture runs or it has keyboard focus,
  // even if the preview carries the panel past the screen centre.
  const [lockedSide, setLockedSide] = useState(null);
  const gripAt = lockedSide || side;

  useEffect(() => () => document.body.classList.remove('cr-resizing'), []);

  const measure = (g, e) => {
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    return g.edge === 'dock'
      ? { dockW: clampDockW(g.start.w - dx, view.vw) }
      : resizeFrom(g.edge, g.start, dx, dy, view);
  };

  const finish = () => {
    gesture.current = null;
    setLockedSide(null);
    document.body.classList.remove('cr-resizing');
    onEnd();
  };

  const pointer = (edge) => ({
    onPointerDown: (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      setLockedSide(gripAt);
      e.currentTarget.setPointerCapture?.(e.pointerId);
      gesture.current = { edge, x0: e.clientX, y0: e.clientY, start: getStart() };
      document.body.style.setProperty('--cr-resize-cursor', CURSORS[edge]);
      document.body.classList.add('cr-resizing');
    },
    onPointerMove: (e) => {
      if (!gesture.current) return;
      // The button came up somewhere we never heard about.
      if (e.buttons === 0) {
        finish();
        return;
      }
      onPreview(measure(gesture.current, e));
    },
    onPointerUp: (e) => {
      const g = gesture.current;
      if (!g) return;
      const moved = e.clientX !== g.x0 || e.clientY !== g.y0;
      const next = measure(g, e);
      finish();
      if (moved) onCommit(next);
    },
    onPointerCancel: () => {
      if (gesture.current) finish();
    },
    onLostPointerCapture: () => {
      if (gesture.current) finish();
    },
  });

  const step = (e) => (e.shiftKey ? RESIZE_STEP_BIG : RESIZE_STEP);

  // The arrow pointing away from the panel grows it.
  const onGripKey = (e) => {
    const s = step(e);
    const across = gripAt === 'bl' ? 'l' : 'r';
    const moves = {
      ArrowLeft: [across, -s, 0],
      ArrowRight: [across, s, 0],
      ArrowUp: ['b', 0, -s],
      ArrowDown: ['b', 0, s],
    };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    onCommit(resizeFrom(m[0], getStart(), m[1], m[2], view));
  };

  const onDockKey = (e) => {
    const d = { ArrowLeft: step(e), ArrowRight: -step(e) }[e.key];
    if (d === undefined) return;
    e.preventDefault();
    onCommit({ dockW: clampDockW(dockW + d, view.vw) });
  };

  if (mode === 'dock') {
    return (
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize dock"
        aria-valuenow={Math.round(dockW)}
        aria-valuemin={DOCK_MIN}
        aria-valuemax={clampDockW(DOCK_MAX, view.vw)}
        tabIndex={0}
        data-cr-resize="dock"
        className="cr-rz cr-rz-dock"
        onKeyDown={onDockKey}
        {...pointer('dock')}
      />
    );
  }

  const grip = {
    'aria-label': 'Resize panel',
    title: 'Drag, or use the arrow keys, to resize',
    onKeyDown: onGripKey,
    onFocus: () => setLockedSide(gripAt),
    onBlur: () => {
      if (!gesture.current) setLockedSide(null);
    },
  };

  return (
    <>
      {['l', 'r', 'b'].map((edge) => (
        <div key={edge} aria-hidden="true" data-cr-resize={edge} className={`cr-rz cr-rz-${edge}`} {...pointer(edge)} />
      ))}
      {['bl', 'br'].map((edge) => {
        const isGrip = edge === gripAt;
        return (
          <button
            key={edge}
            type="button"
            data-cr-resize={edge}
            className={`cr-rz cr-rz-${edge}${isGrip ? ' cr-rz-grip' : ''}`}
            {...(isGrip ? grip : { tabIndex: -1, 'aria-hidden': 'true' })}
            {...pointer(edge)}
          />
        );
      })}
    </>
  );
}
