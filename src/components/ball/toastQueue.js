import { useCallback, useEffect, useState } from 'react';

export const TOAST_MS = 3000;
export const TOAST_QUEUE_MAX = 4;
export const EMPTY_TOASTS = { items: [], extra: 0, seq: 0 };

// New balls wait their turn; past the cap they fold into one "+N more".
export function enqueueToast(state, toast) {
  if (state.items.length < TOAST_QUEUE_MAX) return { ...state, items: [...state.items, toast] };
  return { ...state, extra: state.extra + 1 };
}

export function shiftToast(state) {
  const rest = state.items.slice(1);
  if (state.extra > 0 && rest.length < TOAST_QUEUE_MAX) {
    const seq = state.seq + 1;
    return { items: [...rest, { id: `more-${seq}`, more: state.extra }], extra: 0, seq };
  }
  return { ...state, items: rest };
}

export function useToasts() {
  const [state, setState] = useState(EMPTY_TOASTS);
  const push = useCallback((toast) => setState((s) => enqueueToast(s, toast)), []);
  const head = state.items[0] || null;
  useEffect(() => {
    if (!head) return undefined;
    const t = setTimeout(() => setState((s) => shiftToast(s)), TOAST_MS);
    return () => clearTimeout(t);
  }, [head]);
  return { toast: head, push };
}
