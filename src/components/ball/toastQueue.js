import { useCallback, useEffect, useState } from 'react';

export const TOAST_MS = 3000;
export const TOAST_QUEUE_MAX = 4;
export const EMPTY_TOASTS = { items: [], extra: 0, seq: 0, shifts: 0 };

// The toast on screen plus up to TOAST_QUEUE_MAX waiting. Past that, arrivals
// fold into one "+N more": it grows while it waits, and until a slot frees
// the overflow is held in `extra`.
export function enqueueToast(state, toast) {
  if (state.items.length < TOAST_QUEUE_MAX + 1) return { ...state, items: [...state.items, toast] };
  const at = state.items.findIndex((x, i) => i > 0 && x.more);
  if (at > 0) {
    const items = state.items.slice();
    items[at] = { ...items[at], more: items[at].more + 1 };
    return { ...state, items };
  }
  return { ...state, extra: state.extra + 1 };
}

export function shiftToast(state) {
  const rest = state.items.slice(1);
  const shifts = (state.shifts || 0) + 1;
  if (state.extra > 0 && rest.length < TOAST_QUEUE_MAX + 1) {
    const seq = state.seq + 1;
    return { items: [...rest, { id: `more-${seq}`, more: state.extra }], extra: 0, seq, shifts };
  }
  return { ...state, items: rest, shifts };
}

export function useToasts() {
  const [state, setState] = useState(EMPTY_TOASTS);
  const push = useCallback((toast) => setState((s) => enqueueToast(s, toast)), []);
  const head = state.items[0] || null;
  // Keyed by the shift count, not the toast object, so the same toast pushed
  // twice still re-arms the timer.
  const key = head ? state.shifts : -1;
  useEffect(() => {
    if (key < 0) return undefined;
    const t = setTimeout(() => setState((s) => shiftToast(s)), TOAST_MS);
    return () => clearTimeout(t);
  }, [key]);
  return { toast: head, push };
}
