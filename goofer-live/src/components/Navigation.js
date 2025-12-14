import { useState } from 'react';
import { Menu, X } from 'lucide-react';

export default function Navigation({ currentPage, setPage }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'home', label: 'HOME' },
    { id: 'schedule', label: 'SCHEDULE' },
    { id: 'vods', label: 'VODS & CLIPS' },
    { id: 'gear', label: 'GEAR' },
    { id: 'gamba', label: 'GAMBA' },
    { id: 'about', label: 'ABOUT ME' },
    { id: 'admin', label: 'ADMIN' },
  ];

  const handleNavClick = (pageId) => {
    setPage(pageId);
    setMobileMenuOpen(false);
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-black/20 border-b border-emerald-500/10">
        <div className="w-full px-6 py-4 flex items-center justify-between">
          <div
            onClick={() => setPage('home')}
            className="text-2xl font-bold tracking-tighter cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0"
          >
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-purple-400">
              GooferG
            </span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex gap-8 flex-1 ml-36">
            {navItems.map((item) => {
              const isAdmin = item.id === 'admin';
              const activeColor = isAdmin
                ? 'text-orange-400'
                : 'text-emerald-400';
              const hoverColor = isAdmin
                ? 'hover:text-orange-400'
                : 'hover:text-emerald-400';
              const gradientColor = isAdmin
                ? 'bg-gradient-to-r from-orange-400 to-red-400'
                : 'bg-gradient-to-r from-emerald-400 to-purple-400';

              return (
                <button
                  key={item.id}
                  onClick={() => setPage(item.id)}
                  className={`text-sm font-bold tracking-wider transition-all duration-300 ${hoverColor} relative group whitespace-nowrap ${
                    currentPage === item.id ? activeColor : 'text-white/60'
                  }`}
                >
                  {item.label}
                  <span
                    className={`absolute -bottom-1 left-0 h-0.5 ${gradientColor} transition-all duration-300 ${
                      currentPage === item.id
                        ? 'w-full'
                        : 'w-0 group-hover:w-full'
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-white/80 hover:text-emerald-400 transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Menu Drawer */}
      <div
        className={`fixed top-[73px] right-0 bottom-0 w-64 bg-gradient-to-b from-zinc-950 to-emerald-950/50 backdrop-blur-xl border-l border-emerald-500/20 z-40 transform transition-transform duration-300 ease-in-out md:hidden ${
          mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col p-6 gap-1">
          {navItems.map((item) => {
            const isAdmin = item.id === 'admin';
            const activeColor = isAdmin
              ? 'bg-orange-500/10 border-orange-500/30 text-orange-400'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
            const hoverColor = isAdmin
              ? 'hover:bg-orange-500/5 hover:border-orange-500/20'
              : 'hover:bg-emerald-500/5 hover:border-emerald-500/20';

            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full text-left px-4 py-3 rounded-lg font-bold tracking-wider transition-all duration-300 border ${
                  currentPage === item.id
                    ? activeColor
                    : `text-white/60 border-transparent ${hoverColor}`
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
