import { useState } from 'react';
import { Menu, X } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'home', label: 'Home', code: '01' },
  { id: 'schedule', label: 'Schedule', code: '02' },
  { id: 'vods', label: 'Vods', code: '03' },
  { id: 'gamba', label: 'Gamba', code: '04' },
  { id: 'gaming', label: 'Gaming', code: '05' },
  { id: 'about', label: 'About', code: '06' },
];

const ADMIN_ITEM = { id: 'admin', label: 'Admin', code: 'AD' };

function Wordmark({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-baseline gap-2 cursor-pointer flex-shrink-0"
      aria-label="GooferG home"
    >
      <span
        className="text-xs font-bold tracking-eyebrow-lg uppercase text-white/40 group-hover:text-emerald-signal transition-colors duration-200 font-mono"
      >
        GG
      </span>
      <span className="text-lg font-black tracking-tight text-white-body group-hover:text-emerald-signal transition-colors duration-200">
        Goofer<span className="text-emerald-signal">G</span>
      </span>
    </button>
  );
}

function NavLink({ item, active, accent = 'emerald', onClick }) {
  const accentDot = accent === 'orange' ? 'bg-orange-admin' : 'bg-emerald-signal';
  const accentText = accent === 'orange' ? 'text-orange-admin' : 'text-emerald-signal';

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative inline-flex items-center gap-2 py-1.5"
    >
      <span
        className={`text-[10px] font-bold tracking-eyebrow-md tabular-nums transition-colors duration-200 ${
          active ? accentText : 'text-white/25 group-hover:text-white/45'
        } font-mono`}
      >
        {item.code}
      </span>
      <span
        className={`text-[13px] font-bold tracking-tight transition-colors duration-200 whitespace-nowrap ${
          active ? 'text-white-body' : 'text-white/60 group-hover:text-white-body'
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

export default function Navigation({ currentPage, setPage }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = (pageId) => {
    setPage(pageId);
    setMobileMenuOpen(false);
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-zinc-broadcast/85 backdrop-blur-md border-b border-white/8">
        <div className="w-full px-5 sm:px-8 py-3 flex items-center gap-6">
          <Wordmark onClick={() => setPage('home')} />

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-7 flex-1 justify-center">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.id}
                item={item}
                active={currentPage === item.id}
                onClick={() => setPage(item.id)}
              />
            ))}
          </div>

          {/* Admin — visually separated */}
          <div className="hidden md:flex items-center flex-shrink-0 pl-6 border-l border-white/10">
            <NavLink
              item={ADMIN_ITEM}
              active={currentPage === ADMIN_ITEM.id}
              accent="orange"
              onClick={() => setPage(ADMIN_ITEM.id)}
            />
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
        className={`fixed top-[57px] right-0 bottom-0 w-72 bg-zinc-broadcast border-l border-white/10 z-40 transform transition-transform duration-200 ease-out md:hidden ${
          mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!mobileMenuOpen}
      >
        {/* Drawer header */}
        <div
          className="px-5 py-4 border-b border-white/10 text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/40 font-mono"
      >
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
                  className={`text-[10px] font-bold tracking-eyebrow-md tabular-nums ${
                    isActive ? 'text-emerald-signal' : 'text-white/30'
                  } font-mono`}
      >
                  {item.code}
                </span>
                <span
                  className={`text-sm font-bold tracking-tight ${
                    isActive ? 'text-white-body' : 'text-white/70'
                  }`}
                >
                  {item.label}
                </span>
                {isActive && (
                  <span
                    className="ml-auto text-[9px] font-bold tracking-eyebrow-lg text-emerald-signal font-mono"
      >
                    ON
                  </span>
                )}
              </button>
            );
          })}

          {/* Admin separator */}
          <div
            className="mt-2 px-5 pt-4 pb-2 border-t border-white/10 text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/40 font-mono"
      >
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
              className={`text-[10px] font-bold tracking-eyebrow-md tabular-nums ${
                currentPage === ADMIN_ITEM.id ? 'text-orange-admin' : 'text-white/30'
              } font-mono`}
      >
              {ADMIN_ITEM.code}
            </span>
            <span
              className={`text-sm font-bold tracking-tight ${
                currentPage === ADMIN_ITEM.id ? 'text-white-body' : 'text-white/70'
              }`}
            >
              {ADMIN_ITEM.label}
            </span>
            {currentPage === ADMIN_ITEM.id && (
              <span
                className="ml-auto text-[9px] font-bold tracking-eyebrow-lg text-orange-admin font-mono"
      >
                ON
              </span>
            )}
          </button>
        </nav>
      </div>
    </>
  );
}
