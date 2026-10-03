import { useEffect, useRef, useState } from 'react';

// A press held at least this long and released early is an explicit "let go
// to cancel", so the click the browser fires afterwards must not arm.
export const LONG_PRESS_MS = 250;

// Press-and-hold confirmation with a two-step fallback. Holding a pointer or
// Space for `duration` confirms; any other activation (a quick tap, Enter, a
// screen reader's click) arms a confirm state for `confirmWindow`, and a second
// activation confirms. One stray click can never confirm on its own.
export default function useHoldToConfirm({ duration = 900, confirmWindow = 4000, disabled = false, onConfirm, onHoldStart }) {
  const [holding, setHolding] = useState(false);
  const [armed, setArmed] = useState(false);
  const holdTimer = useRef(null);
  const armTimer = useRef(null);
  const startedAt = useRef(0);
  const swallowClick = useRef(false);
  const confirmRef = useRef(onConfirm);
  confirmRef.current = onConfirm;

  function disarm() {
    clearTimeout(armTimer.current);
    armTimer.current = null;
    setArmed(false);
  }

  function confirm() {
    disarm();
    if (confirmRef.current) confirmRef.current();
  }

  function start() {
    if (disabled || holdTimer.current) return;
    swallowClick.current = false;
    startedAt.current = Date.now();
    setHolding(true);
    if (onHoldStart) onHoldStart();
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      setHolding(false);
      swallowClick.current = true;
      confirm();
    }, duration);
  }

  function release() {
    if (!holdTimer.current) return;
    clearTimeout(holdTimer.current);
    holdTimer.current = null;
    setHolding(false);
    if (Date.now() - startedAt.current >= LONG_PRESS_MS) swallowClick.current = true;
  }

  function onClick() {
    if (disabled) return;
    if (swallowClick.current) {
      swallowClick.current = false;
      return;
    }
    if (armed) {
      confirm();
      return;
    }
    setArmed(true);
    clearTimeout(armTimer.current);
    armTimer.current = setTimeout(() => setArmed(false), confirmWindow);
  }

  useEffect(() => {
    if (!disabled) return;
    clearTimeout(holdTimer.current);
    holdTimer.current = null;
    clearTimeout(armTimer.current);
    armTimer.current = null;
    setHolding(false);
    setArmed(false);
  }, [disabled]);

  useEffect(
    () => () => {
      clearTimeout(holdTimer.current);
      clearTimeout(armTimer.current);
    },
    []
  );

  const bind = {
    onPointerDown: (e) => {
      if (e.button === 0 || e.button === undefined) start();
    },
    onPointerUp: release,
    onPointerLeave: release,
    onPointerCancel: release,
    onKeyDown: (e) => {
      if (e.key === 'Enter') swallowClick.current = false;
      if (e.key === ' ' && !e.repeat) start();
    },
    onKeyUp: (e) => {
      if (e.key === ' ') release();
    },
    onClick,
    onContextMenu: (e) => {
      if (holdTimer.current) e.preventDefault();
    },
  };

  return { holding, armed, bind };
}
