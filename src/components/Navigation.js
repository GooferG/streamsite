import React from 'react';

export default function Navigation({ currentPage, setPage }) {
  const navItems = [
    { id: 'home', label: 'HOME' },
    { id: 'schedule', label: 'SCHEDULE' },
    { id: 'vods', label: 'VODS & CLIPS' },
    { id: 'about', label: 'ABOUT' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-black/20 border-b border-emerald-500/10">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="text-2xl font-bold tracking-tighter">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-purple-400">
            Goofer LIVE
          </span>
        </div>

        <div className="flex gap-8">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`text-sm font-bold tracking-wider transition-all duration-300 hover:text-emerald-400 relative group ${
                currentPage === item.id ? 'text-emerald-400' : 'text-white/60'
              }`}
            >
              {item.label}
              <span
                className={`absolute -bottom-1 left-0 h-0.5 bg-gradient-to-r from-emerald-400 to-purple-400 transition-all duration-300 ${
                  currentPage === item.id ? 'w-full' : 'w-0 group-hover:w-full'
                }`}
              />
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
