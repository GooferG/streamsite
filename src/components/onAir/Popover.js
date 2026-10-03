import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { FOCUS } from './classes';

// Disclosure popover for On Air menus (the nav's Gamba, account and operator
// menus): a button with aria-expanded over a panel of links. Not
// role="menu", which is for app menus, not site navigation. Closes on a press
// outside, on Escape (focus returns to the trigger when it was inside) and
// when focus leaves. An Escape another handler already took is left alone.
export function usePopover() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  const panelId = useId();

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((o) => !o), []);

  useEffect(() => {
    if (!open) return undefined;
    const onPress = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const focusInside = !!wrapRef.current?.contains(document.activeElement);
      setOpen(false);
      if (focusInside) triggerRef.current?.focus();
    };
    document.addEventListener('mousedown', onPress);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPress);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Tab past the last row: focus lands outside the wrapper, so close.
  const onBlur = (e) => {
    const next = e.relatedTarget;
    if (next && wrapRef.current && !wrapRef.current.contains(next)) setOpen(false);
  };

  return {
    open,
    setOpen,
    close,
    toggle,
    panelId,
    wrapProps: { ref: wrapRef, onBlur },
    triggerProps: { ref: triggerRef, 'aria-expanded': open, 'aria-controls': panelId, onClick: toggle },
  };
}

const ALIGN = { left: 'left-0', right: 'right-0' };

// Always in the DOM (so aria-controls resolves), hidden while closed.
export function PopoverPanel({ id, open, align = 'left', className = '', children }) {
  return (
    <div
      id={id}
      hidden={!open}
      className={`absolute top-full z-50 mt-2 rounded-onair-row bg-gradient-to-b from-onair-surface-1 to-onair-surface-3 p-2 font-onair shadow-onair-card motion-safe:animate-fade-in ${ALIGN[align]} ${className}`}
    >
      {children}
    </div>
  );
}

// Rows inside a panel: `${MENU_ROW} ${now ? MENU_ROW_NOW : MENU_ROW_IDLE}`.
export const MENU_ROW = `flex w-full items-center gap-3 rounded-onair-control px-3 py-2.5 text-left text-[0.9375rem] font-bold transition-colors duration-150 motion-reduce:transition-none ${FOCUS}`;
export const MENU_ROW_IDLE = 'text-onair-ink-2 hover:bg-white/5';
export const MENU_ROW_NOW =
  'bg-gradient-to-r from-onair-signal-deep/[0.16] to-onair-signal-deep/[0.03] text-onair-ink-1 shadow-onair-lit-signal';
