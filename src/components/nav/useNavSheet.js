import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export const ADMIN_EMAIL = 'luimeneghim@gmail.com';

// The shell side of the side sheet, shared by the bar and the home button: the
// open flag, closing on navigation (and below/above lg when `closeAtLg`), focus
// returning to the button that opened it, and who is looking.
export default function useNavSheet({ closeAtLg = false } = {}) {
  const { pathname } = useLocation();
  const { currentUser, isStaff } = useAuth();
  const isAdmin = currentUser?.email === ADMIN_EMAIL;
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const wasOpen = useRef(false);
  const sheetId = useId();

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((o) => !o), []);
  // Any navigation (a row, Back, a link elsewhere) closes the sheet.
  useEffect(() => setOpen(false), [pathname]);
  // A sheet that is lg:hidden would leave the page scroll-locked behind nothing.
  useEffect(() => {
    if (!closeAtLg || !open || typeof window.matchMedia !== 'function') return undefined;
    const lg = window.matchMedia('(min-width: 1024px)');
    const onChange = (e) => {
      if (e.matches) setOpen(false);
    };
    lg.addEventListener?.('change', onChange);
    return () => lg.removeEventListener?.('change', onChange);
  }, [closeAtLg, open]);
  // When the sheet closes, focus goes back to the button that opened it.
  useEffect(() => {
    if (wasOpen.current && !open) buttonRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  return { open, close, toggle, buttonRef, sheetId, isAdmin, isStaff };
}
