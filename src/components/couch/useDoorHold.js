import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Whether a door is under the pointer or has focus. The TV and the laptop
// doors follow what their screens show, so a screen holds still while you are
// on its door (it never retargets under you): `onHold(id, on)` hears each
// change, and `false` if the door goes away while held. Returns the flag and
// the handlers for the door's <a> (see withHold).
export default function useDoorHold(id, onHold) {
  const [active, setActive] = useState(false);
  const on = useRef({ hover: false, focus: false });
  const set = useCallback((key, value) => {
    on.current[key] = value;
    setActive(on.current.hover || on.current.focus);
  }, []);

  const holdRef = useRef(onHold);
  holdRef.current = onHold;
  const reported = useRef(false);
  useEffect(() => {
    if (reported.current === active) return;
    reported.current = active;
    if (holdRef.current) holdRef.current(id, active);
  }, [id, active]);
  useEffect(
    () => () => {
      if (reported.current && holdRef.current) holdRef.current(id, false);
    },
    [id]
  );

  const handlers = useMemo(
    () => ({
      onPointerEnter: () => set('hover', true),
      onPointerLeave: () => set('hover', false),
      onFocus: () => set('focus', true),
      onBlur: () => set('focus', false),
    }),
    [set]
  );
  return [active, handlers];
}

// A door's own props with the hold's handlers added (both run).
export function withHold(props, handlers) {
  const out = { ...props };
  Object.entries(handlers).forEach(([name, fn]) => {
    const own = props[name];
    out[name] = own
      ? (e) => {
          own(e);
          fn(e);
        }
      : fn;
  });
  return out;
}
