import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { isWatching } from '../../utils/watching';
import { FOCUS } from '../onAir/classes';
import { PowerLed } from './StatusReadout';
import NavSheet from './NavSheet';
import useNavSheet from './useNavSheet';

// The home page has no bar (the room is the navigation), so the site menu is a
// small button in the top-right corner that opens the same side sheet at every
// width. z-50 matches the bar: under the control room panel, over the room.
// Inside the TV (the watch dialog) it steps out of the way, and its sheet
// closes, so it never comes back open.
export default function HomeMenuButton({ isLive = false, viewerCount = null, statusReady = false }) {
  const location = useLocation();
  const { open, close, toggle, buttonRef, sheetId, isAdmin, isStaff } = useNavSheet();
  const watching = isWatching(location, isLive);
  useEffect(() => {
    if (watching) close();
  }, [watching, close]);
  if (watching) return null;

  const onAir = statusReady && isLive;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-label={onAir ? 'Menu, on air' : 'Menu'}
        aria-expanded={open}
        aria-controls={sheetId}
        style={{ top: 'max(0.75rem, env(safe-area-inset-top))', right: 'max(0.75rem, env(safe-area-inset-right))' }}
        className={`fixed z-50 inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-onair-control bg-gradient-to-b from-onair-bezel-top to-onair-bezel-bottom px-3 font-onair text-onair-ink-2 shadow-onair-bar transition-colors duration-150 hover:text-onair-ink-1 motion-reduce:transition-none ${FOCUS}`}
      >
        <Menu size={20} aria-hidden="true" />
        {onAir && <PowerLed live />}
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
