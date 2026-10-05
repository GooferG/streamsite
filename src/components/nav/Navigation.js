import { useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { FOCUS } from '../onAir/classes';
import { NAV_ITEMS, currentFor } from './navItems';
import { NAV_H } from './navMetrics';
import BarLink from './BarLink';
import GambaMenu from './GambaMenu';
import StatusReadout, { PowerLed } from './StatusReadout';
import AccountMenu from './AccountMenu';
import OperatorControls from './OperatorControls';
import NavSheet from './NavSheet';
import useNavSheet from './useNavSheet';

const SECRET_CLICKS = 5;
const SECRET_WINDOW_MS = 2000;

// LED + wordmark. A link home; five clicks inside two seconds open /admin.
function Wordmark({ live }) {
  const navigate = useNavigate();
  const clicks = useRef([]);
  const onClick = (e) => {
    const now = Date.now();
    clicks.current = [...clicks.current, now].filter((t) => now - t <= SECRET_WINDOW_MS);
    if (clicks.current.length >= SECRET_CLICKS) {
      e.preventDefault();
      clicks.current = [];
      navigate('/admin');
    }
  };
  return (
    <Link
      to="/"
      onClick={onClick}
      aria-label="GooferG home"
      className={`flex flex-none items-center gap-2.5 rounded-onair-tile ${FOCUS}`}
    >
      <PowerLed live={live} />
      <span className="text-xl font-extrabold tracking-[-0.01em] text-onair-ink-1">GooferG</span>
    </Link>
  );
}

// The site nav: the TV's bezel (DESIGN.md §7, Navigation). Full bar with
// channel codes from xl, labels only from lg, LED · wordmark · tally · menu
// button with the side sheet below lg. Height is NAV_H (57px) everywhere.
export default function Navigation({ isLive = false, viewerCount = null, statusReady = false }) {
  const { pathname } = useLocation();
  const { open: sheetOpen, close: closeSheet, toggle, buttonRef: menuButtonRef, sheetId, isAdmin, isStaff } = useNavSheet({ closeAtLg: true });

  const status = { isLive, viewerCount, statusReady };

  return (
    <>
      {/* z-50 sits under the control room panel (z-[65]) so its modals cover
          the bar; while a nav menu is open the bar lifts to z-[70] so the
          menu opens over the panel. */}
      <nav
        aria-label="Site"
        style={{ height: NAV_H }}
        className="fixed inset-x-0 top-0 z-50 [&:has([data-nav-popover][aria-expanded=true])]:z-[70] flex items-center gap-3 bg-gradient-to-b from-onair-bezel-top to-onair-bezel-bottom px-4 font-onair shadow-onair-bar sm:px-6 lg:gap-4 lg:px-[22px]"
      >
        {/* The first Tab stop on every page: past the nav, straight to <main>. */}
        <a
          href="#main"
          className={`sr-only rounded-onair-control focus:not-sr-only focus:absolute focus:left-3 focus:top-2 focus:z-10 focus:inline-flex focus:min-h-11 focus:items-center focus:bg-gradient-to-b focus:from-onair-surface-1 focus:to-onair-surface-3 focus:px-4 focus:text-sm focus:font-bold focus:text-onair-ink-1 focus:shadow-onair-card ${FOCUS}`}
        >
          Skip to content
        </a>
        <Wordmark live={statusReady && isLive} />

        <ul className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 lg:flex">
          {NAV_ITEMS.map((item) => {
            const current = currentFor(item, pathname);
            return (
              <li key={item.id}>
                {item.id === 'gamba' ? <GambaMenu current={current} /> : <BarLink item={item} current={current} />}
              </li>
            );
          })}
        </ul>

        <div className="ml-auto flex flex-none items-center gap-2 lg:ml-0 lg:gap-3">
          <StatusReadout {...status} />
          {/* Exactly one identity: admin XOR viewer. Staff add the control room. */}
          <div className="hidden items-center gap-2 lg:flex">
            {isAdmin ? (
              <OperatorControls isAdmin />
            ) : (
              <>
                {isStaff && <OperatorControls isAdmin={false} />}
                <AccountMenu />
              </>
            )}
          </div>
          <button
            ref={menuButtonRef}
            type="button"
            onClick={toggle}
            aria-expanded={sheetOpen}
            aria-controls={sheetId}
            aria-label={sheetOpen ? 'Close menu' : 'Open menu'}
            className={`inline-flex h-11 w-11 items-center justify-center rounded-onair-control bg-white/[0.07] text-onair-ink-2 transition-colors duration-150 hover:bg-white/[0.12] motion-reduce:transition-none lg:hidden ${FOCUS}`}
          >
            {sheetOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
        </div>
      </nav>

      <NavSheet id={sheetId} open={sheetOpen} onClose={closeSheet} {...status} isAdmin={isAdmin} isStaff={isStaff} />
    </>
  );
}
