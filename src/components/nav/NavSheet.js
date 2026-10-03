import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MonitorPlay, X } from 'lucide-react';
import { useTwitchAuth } from '../../contexts/TwitchAuthContext';
import { useAuth } from '../../contexts/AuthContext';
import { MENU_ROW_NOW } from '../onAir/Popover';
import { FOCUS, MONO } from '../onAir/classes';
import { GAMBA_CHANNELS, channelForPath, subchannelLabel } from '../../data/gambaTools';
import { NAV_ITEMS, currentFor } from './navItems';
import { NAV_H } from './navMetrics';
import StatusReadout from './StatusReadout';
import { Avatar, SignInButton } from './AccountMenu';
import { OperatorBadge, useControlRoomLauncher } from './OperatorControls';

const EYEBROW = `${MONO} px-3 pb-1.5 pt-4 text-[0.625rem] tracking-[0.25em] text-onair-ink-5`;
const ADMIN_ITEM = { id: 'admin', path: '/admin' };
const GHOST = `inline-flex min-h-11 flex-1 items-center justify-center rounded-onair-control bg-white/[0.07] px-3 py-2 text-sm font-bold text-onair-ink-2 transition-colors duration-150 hover:bg-white/[0.12] motion-reduce:transition-none ${FOCUS}`;

function SheetRow({ to, code, label, current, now = false, sub = false, onClick }) {
  const lit = now || current === 'page';
  return (
    <Link
      to={to}
      onClick={onClick}
      aria-current={now ? 'page' : current}
      className={`flex min-h-11 items-center gap-3 rounded-onair-control px-3 py-2.5 transition-colors duration-150 motion-reduce:transition-none ${FOCUS} ${
        sub ? 'pl-9 text-[0.9375rem] font-medium' : 'text-base font-bold'
      } ${lit ? MENU_ROW_NOW : 'text-onair-ink-2 hover:bg-white/5'}`}
    >
      <span className={`${MONO} w-8 flex-none text-xs font-bold tracking-[0.15em] ${lit || current ? 'text-onair-signal' : 'text-onair-ink-5'}`}>
        {code}
      </span>
      {label}
      {now && <span className={`${MONO} ml-auto text-[0.625rem] tracking-[0.2em] text-onair-signal`}>Now</span>}
    </Link>
  );
}

function Identity({ isAdmin, onClose }) {
  const { twitchUser, loading, loginWithTwitch, logout } = useTwitchAuth();
  const { logout: adminLogout } = useAuth();
  if (isAdmin) {
    return (
      <div className="space-y-3 px-3 py-3">
        <div className="flex items-center gap-3 pr-10">
          <OperatorBadge />
          <div className="min-w-0">
            <p className="font-bold text-onair-ink-1">Operator</p>
            <p className={`${MONO} text-[0.625rem] tracking-[0.2em] text-onair-ink-5`}>Signed in · Admin</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => { adminLogout(); onClose(); }} className={GHOST}>
            Sign out
          </button>
        </div>
      </div>
    );
  }
  if (loading) return null;
  if (!twitchUser) {
    return (
      <div className="p-2 pr-12">
        <SignInButton size="md" onClick={loginWithTwitch} />
      </div>
    );
  }
  return (
    <div className="space-y-3 px-3 py-3">
      <div className="flex items-center gap-3 pr-10">
        <Avatar user={twitchUser} size="h-9 w-9" />
        <div className="min-w-0">
          <p className="truncate font-bold text-onair-ink-1">{twitchUser.displayName}</p>
          <p className={`${MONO} text-[0.625rem] tracking-[0.2em] text-onair-ink-5`}>Signed in · Twitch</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Link to="/me" onClick={onClose} className={GHOST}>
          Account
        </Link>
        <button type="button" onClick={() => { logout(); onClose(); }} className={GHOST}>
          Sign out
        </button>
      </div>
    </div>
  );
}

// The phone nav (below lg): a channel list sliding in from the right under the
// bar. The shell owns `open`, closes it on navigation and at lg, and returns
// focus to the menu button; this owns the scroll lock, Escape and moving focus
// in (to Close, so Enter right after opening never signs anyone out). Every row
// closes it too: a link to the page you are on doesn't change the path.
export default function NavSheet({ id, open, onClose, isLive, viewerCount, statusReady, isAdmin, isStaff }) {
  const { pathname } = useLocation();
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const launcher = useControlRoomLauncher();
  const tuned = channelForPath(pathname);

  useEffect(() => {
    if (!open) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const list = panelRef.current?.querySelectorAll('a[href], button:not([disabled])');
      if (!list || list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          style={{ top: NAV_H }}
          onClick={onClose}
          aria-hidden="true"
          data-testid="nav-scrim"
        />
      )}
      <div
        id={id}
        ref={panelRef}
        inert={!open}
        aria-hidden={!open}
        aria-label="Site menu"
        role="dialog"
        aria-modal={open || undefined}
        style={{ top: NAV_H }}
        className={`fixed bottom-0 right-0 z-40 w-[300px] max-w-[85vw] overflow-y-auto rounded-l-onair-card bg-gradient-to-b from-onair-surface-1 to-onair-surface-3 p-2 font-onair shadow-onair-card transition-transform duration-200 ease-out motion-reduce:transition-none lg:hidden ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="relative min-h-11">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className={`absolute right-0 top-0 inline-flex min-h-11 min-w-11 items-center justify-center rounded-onair-control text-onair-ink-4 transition-colors duration-150 hover:bg-white/5 hover:text-onair-ink-1 motion-reduce:transition-none ${FOCUS}`}
          >
            <X size={20} aria-hidden="true" />
          </button>
          <Identity isAdmin={isAdmin} onClose={onClose} />
        </div>
        {statusReady && (
          <div className="px-2 py-2">
            <StatusReadout isLive={isLive} viewerCount={viewerCount} statusReady variant="sheet" />
          </div>
        )}
        <nav aria-label="Channels">
          <p className={EYEBROW}>Channel index</p>
          <ul>
            {NAV_ITEMS.map((item) => (
              <li key={item.id}>
                <SheetRow
                  to={item.path}
                  code={item.code}
                  label={item.label}
                  // A tuned subchannel is the page; Gamba is then only its section.
                  current={item.id === 'gamba' && tuned ? 'true' : currentFor(item, pathname)}
                  onClick={onClose}
                />
                {item.id === 'gamba' && (
                  <ul>
                    {GAMBA_CHANNELS.map((ch) => (
                      <li key={ch.id}>
                        <SheetRow
                          sub
                          to={ch.path}
                          code={subchannelLabel(ch, item.code)}
                          label={ch.label}
                          now={tuned?.id === ch.id}
                          onClick={onClose}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </nav>
        {isStaff && (
          <>
            <p className={EYEBROW}>Operator</p>
            <button
              type="button"
              onClick={() => {
                launcher.open();
                onClose();
              }}
              className={`flex min-h-11 w-full items-center gap-3 rounded-onair-control px-3 py-2.5 text-left text-base font-bold text-onair-ink-2 transition-colors duration-150 hover:bg-white/5 motion-reduce:transition-none ${FOCUS}`}
            >
              <MonitorPlay size={16} aria-hidden="true" className="w-8 flex-none" />
              Control room
              {launcher.giveaway && (
                <span className={`${MONO} ml-auto inline-flex items-center gap-1.5 text-[0.625rem] tracking-[0.2em] text-onair-signal-light`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-onair-signal" aria-hidden="true" />
                  Live · {launcher.giveaway.entryCount ?? 0}
                </span>
              )}
            </button>
            {isAdmin && (
              <SheetRow to="/admin" code="AD" label="Admin" current={currentFor(ADMIN_ITEM, pathname)} onClick={onClose} />
            )}
          </>
        )}
      </div>
    </>
  );
}
