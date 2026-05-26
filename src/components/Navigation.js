import { useState, useRef, useEffect } from 'react';
import {
  Menu,
  X,
  LogOut,
  User as UserIcon,
  Store as StoreIcon,
} from 'lucide-react';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import { useAuth } from '../contexts/AuthContext';

const ADMIN_EMAIL = 'luimeneghim@gmail.com';

const NAV_ITEMS = [
  { id: 'home', label: 'Home', code: '01' },
  { id: 'schedule', label: 'Schedule', code: '02' },
  { id: 'vods', label: 'Vods', code: '03' },
  { id: 'gamba', label: 'Gamba', code: '04' },
  { id: 'gaming', label: 'Gaming', code: '05' },
  { id: 'store', label: 'Store', code: '06' },
  { id: 'giveaway', label: 'Giveaway', code: '07' },
  { id: 'about', label: 'About', code: '08' },
];

const ADMIN_ITEM = { id: 'admin', label: 'Admin', code: 'AD' };

function Wordmark({ onClick, onSecretActivate }) {
  const clicksRef = useRef([]);

  const handleClick = () => {
    if (onSecretActivate) {
      const now = Date.now();
      clicksRef.current = [...clicksRef.current, now].filter(
        (t) => now - t <= 2000
      );
      if (clicksRef.current.length >= 5) {
        clicksRef.current = [];
        onSecretActivate();
        return;
      }
    }
    if (onClick) onClick();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="group flex items-baseline gap-2 cursor-pointer flex-shrink-0"
      aria-label="GooferG home"
    >
      <span className="text-xs font-bold tracking-eyebrow-lg uppercase text-white/40 group-hover:text-emerald-signal transition-colors duration-200 font-mono">
        GG
      </span>
      <span className="text-lg font-black tracking-tight text-white-body group-hover:text-emerald-signal transition-colors duration-200">
        Goofer<span className="text-emerald-signal">G</span>
      </span>
    </button>
  );
}

function NavLink({ item, active, accent = 'emerald', onClick, size = 'md' }) {
  const accentDot =
    accent === 'orange' ? 'bg-orange-admin' : 'bg-emerald-signal';
  const sizeCls =
    size === 'lg' ? 'text-[18px]' : 'text-sm md:text-[15px]';

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative inline-flex items-center gap-1.5 lg:gap-2 py-1.5"
    >
      <span
        className={`${sizeCls} font-bold tracking-tight transition-colors duration-200 whitespace-nowrap ${
          active
            ? 'text-white-body'
            : 'text-white/60 group-hover:text-white-body'
        }`}
      >
        {item.label}
      </span>
      {active && (
        <span
          className={`inline-block w-1.5 h-1.5 rounded-full ${accentDot}`}
          aria-hidden="true"
        />
      )}
    </button>
  );
}

function ViewerAuthControl({ onNavigate }) {
  const { twitchUser, loading, loginWithTwitch, logout } = useTwitchAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target))
        setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  if (loading) return null;

  if (!twitchUser) {
    return (
      <button
        type="button"
        onClick={loginWithTwitch}
        className="inline-flex items-center gap-1.5 lg:gap-2 px-2 lg:px-3 py-1.5 bg-purple-gamba hover:bg-purple-bright text-white-body transition-colors duration-150 flex-shrink-0"
      >
        <svg
          viewBox="0 0 24 24"
          className="w-3.5 h-3.5 fill-current"
          aria-hidden="true"
        >
          <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
        </svg>
        <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
          Sign in
        </span>
      </button>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        className="flex items-center gap-2 pl-1 pr-2 py-1 border border-white/10 hover:border-emerald-signal/40 transition-colors duration-150"
      >
        {twitchUser.profileImageUrl ? (
          <img
            src={twitchUser.profileImageUrl}
            alt=""
            className="w-6 h-6 rounded-full border border-white/15"
          />
        ) : (
          <span className="w-6 h-6 inline-flex items-center justify-center border border-white/15">
            <UserIcon size={12} aria-hidden="true" />
          </span>
        )}
        <span className="text-[11px] font-bold tracking-eyebrow uppercase text-white/80 max-w-[10ch] truncate font-mono">
          {twitchUser.displayName}
        </span>
      </button>
      {menuOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 border border-white/10 bg-zinc-card shadow-lg z-50">
          <div className="px-3 py-2 border-b border-white/8 text-[9px] font-bold tracking-eyebrow-lg uppercase text-white/40 font-mono">
            Signed in
          </div>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onNavigate('me');
            }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-white/75 hover:text-white-body hover:bg-zinc-broadcast/50 transition-colors duration-150"
          >
            <UserIcon size={13} aria-hidden="true" />
            <span className="text-[11px] font-bold tracking-eyebrow uppercase font-mono">
              My account
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onNavigate('store');
            }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-white/75 hover:text-white-body hover:bg-zinc-broadcast/50 transition-colors duration-150"
          >
            <StoreIcon size={13} aria-hidden="true" />
            <span className="text-[11px] font-bold tracking-eyebrow uppercase font-mono">
              Store
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              logout();
            }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-red-destructive/80 hover:text-red-destructive hover:bg-red-destructive/5 border-t border-white/8 transition-colors duration-150"
          >
            <LogOut size={13} aria-hidden="true" />
            <span className="text-[11px] font-bold tracking-eyebrow uppercase font-mono">
              Sign out
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

export default function Navigation({ currentPage, setPage }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { twitchUser, loginWithTwitch, logout } = useTwitchAuth();
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.email === ADMIN_EMAIL;

  const handleNavClick = (pageId) => {
    setPage(pageId);
    setMobileMenuOpen(false);
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-zinc-broadcast/85 backdrop-blur-md border-b border-white/8">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3 md:gap-4 lg:gap-6">
          <Wordmark
            onClick={() => setPage('home')}
            onSecretActivate={() => setPage('admin')}
          />

          {/* Desktop nav — centered, flexible mid */}
          <div className="hidden md:flex items-center justify-center md:gap-3 lg:gap-5 flex-1 min-w-0">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.id}
                item={item}
                active={currentPage === item.id}
                onClick={() => setPage(item.id)}
              />
            ))}
          </div>

          {/* Right cluster: viewer auth + admin — never shrinks */}
          <div className="hidden md:flex items-center gap-2 lg:gap-3 flex-shrink-0">
            <ViewerAuthControl onNavigate={(id) => setPage(id)} />
            {isAdmin && (
              <div className="pl-2 lg:pl-3 border-l border-white/10">
                <NavLink
                  item={ADMIN_ITEM}
                  active={currentPage === ADMIN_ITEM.id}
                  accent="orange"
                  onClick={() => setPage(ADMIN_ITEM.id)}
                />
              </div>
            )}
          </div>

          {/* Mobile menu trigger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-white/70 hover:text-white-body transition-colors ml-auto"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-zinc-broadcast/70 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <div
        className={`fixed top-[57px] right-0 bottom-0 w-72 bg-zinc-broadcast border-l border-white/10 z-40 transform transition-transform duration-200 ease-out md:hidden overflow-y-auto ${
          mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!mobileMenuOpen}
      >
        {/* Viewer identity / login */}
        <div className="px-5 py-4 border-b border-white/10">
          {twitchUser ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {twitchUser.profileImageUrl && (
                  <img
                    src={twitchUser.profileImageUrl}
                    alt=""
                    className="w-9 h-9 rounded-full border border-white/15"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white-body truncate">
                    {twitchUser.displayName}
                  </p>
                  <p className="text-[9px] font-bold tracking-eyebrow-lg uppercase text-emerald-signal/80 font-mono">
                    Signed in · Twitch
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleNavClick('me')}
                  className="flex-1 px-2 py-2 border border-white/10 text-white/70 hover:text-white-body transition-colors text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono"
                >
                  Account
                </button>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                  }}
                  className="px-2 py-2 border border-red-destructive/40 text-red-destructive/80 hover:bg-red-destructive/5 transition-colors text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono"
                >
                  Out
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                loginWithTwitch();
                setMobileMenuOpen(false);
              }}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 bg-purple-gamba hover:bg-purple-bright text-white-body transition-colors duration-150"
            >
              <svg
                viewBox="0 0 24 24"
                className="w-3.5 h-3.5 fill-current"
                aria-hidden="true"
              >
                <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
              </svg>
              <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
                Sign in with Twitch
              </span>
            </button>
          )}
        </div>

        <div className="px-5 py-4 border-b border-white/10 text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/40 font-mono">
          Channel Index
        </div>

        <nav className="flex flex-col">
          {NAV_ITEMS.map((item) => {
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`group flex items-center gap-3 px-5 py-3.5 border-l-2 transition-colors duration-150 ${
                  isActive
                    ? 'bg-zinc-card border-emerald-signal'
                    : 'border-transparent hover:bg-zinc-card/50'
                }`}
              >
                <span
                  className={`text-sm font-bold tracking-tight ${
                    isActive ? 'text-white-body' : 'text-white/70'
                  }`}
                >
                  {item.label}
                </span>
                {isActive && (
                  <span className="ml-auto text-[9px] font-bold tracking-eyebrow-lg text-emerald-signal font-mono">
                    ON
                  </span>
                )}
              </button>
            );
          })}

          {isAdmin && (
            <>
              {/* Admin separator */}
              <div className="mt-2 px-5 pt-4 pb-2 border-t border-white/10 text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/40 font-mono">
                Operator
              </div>

              <button
                type="button"
                onClick={() => handleNavClick(ADMIN_ITEM.id)}
                className={`group flex items-center gap-3 px-5 py-3.5 border-l-2 transition-colors duration-150 ${
                  currentPage === ADMIN_ITEM.id
                    ? 'bg-zinc-card border-orange-admin'
                    : 'border-transparent hover:bg-zinc-card/50'
                }`}
              >
                <span
                  className={`text-sm font-bold tracking-tight ${
                    currentPage === ADMIN_ITEM.id
                      ? 'text-white-body'
                      : 'text-white/70'
                  }`}
                >
                  {ADMIN_ITEM.label}
                </span>
                {currentPage === ADMIN_ITEM.id && (
                  <span className="ml-auto text-[9px] font-bold tracking-eyebrow-lg text-orange-admin font-mono">
                    ON
                  </span>
                )}
              </button>
            </>
          )}
        </nav>
      </div>
    </>
  );
}
