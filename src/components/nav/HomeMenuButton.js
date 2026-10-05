import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { FOCUS } from '../onAir/classes';
import { PowerLed } from './StatusReadout';
import NavSheet from './NavSheet';

const ADMIN_EMAIL = 'luimeneghim@gmail.com';

// The home page has no bar (the room is the navigation), so the site menu is a
// small button in the top-right corner that opens the same side sheet at every
// width. z-50 matches the bar: under the control room panel, over the room.
export default function HomeMenuButton({ isLive = false, viewerCount = null, statusReady = false }) {
  const { pathname } = useLocation();
  const { currentUser, isStaff } = useAuth();
  const isAdmin = currentUser?.email === ADMIN_EMAIL;
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const wasOpen = useRef(false);
  const sheetId = useId();

  const close = useCallback(() => setOpen(false), []);
  useEffect(() => setOpen(false), [pathname]);
  // When the sheet closes, focus goes back to the button that opened it.
  useEffect(() => {
    if (wasOpen.current && !open) buttonRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  const onAir = statusReady && isLive;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Menu"
        aria-expanded={open}
        aria-controls={sheetId}
        style={{ top: 'max(0.75rem, env(safe-area-inset-top))', right: 'max(0.75rem, env(safe-area-inset-right))' }}
        className={`fixed z-50 inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-onair-control bg-black/50 px-3 font-onair text-onair-ink-2 backdrop-blur-sm transition-colors duration-150 hover:bg-black/70 motion-reduce:transition-none ${FOCUS}`}
      >
        <Menu size={20} aria-hidden="true" />
        {onAir && (
          <>
            <PowerLed live />
            <span className="sr-only">On air</span>
          </>
        )}
      </button>
      <NavSheet
        always
        id={sheetId}
        open={open}
        onClose={close}
        isLive={isLive}
        viewerCount={viewerCount}
        statusReady={statusReady}
        isAdmin={isAdmin}
        isStaff={isStaff}
      />
    </>
  );
}
