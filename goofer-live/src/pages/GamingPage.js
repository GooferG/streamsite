import { useState, useEffect, useMemo } from 'react';
import { Gamepad2, List, Shuffle, Search, Clock, ArrowUpDown } from 'lucide-react';
import GameWheel from '../components/GameWheel';

export default function GamingPage() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTool, setActiveTool] = useState('browse');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('playtime');

  useEffect(() => {
    const fetchLibrary = async () => {
      try {
        const res = await fetch('/api/steam-library');
        if (!res.ok) throw new Error('Failed to fetch Steam library');
        const data = await res.json();
        setGames(data.games || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchLibrary();
  }, []);

  const visibleGames = useMemo(() => {
    let filtered = query.trim()
      ? games.filter(g => g.name.toLowerCase().includes(query.toLowerCase()))
      : games;

    if (sortBy === 'alpha') {
      filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    }

    return filtered;
  }, [games, query, sortBy]);

  return (
    <div className="pt-32 pb-24 px-6">
      <div className="max-w-7xl mx-auto space-y-10">
        <header className="text-center space-y-4">
          <h1 className="text-6xl md:text-7xl font-black tracking-tighter">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-purple-400">
              GAME PICKER
            </span>
          </h1>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            Can't decide what to play? Browse your Steam library or let the wheel decide.
          </p>

          <div className="flex justify-center gap-4 pt-4 flex-wrap">
            <button
              onClick={() => setActiveTool('browse')}
              className={`px-6 py-3 rounded-lg font-bold tracking-wide transition-all duration-200 flex items-center gap-2 ${
                activeTool === 'browse'
                  ? 'bg-gradient-to-r from-emerald-500 to-purple-500 text-white shadow-lg'
                  : 'bg-white/5 border border-white/10 text-white/60 hover:text-white hover:border-emerald-400/60'
              }`}
            >
              <List size={18} />
              Browse
            </button>
            <button
              onClick={() => setActiveTool('wheel')}
              className={`px-6 py-3 rounded-lg font-bold tracking-wide transition-all duration-200 flex items-center gap-2 ${
                activeTool === 'wheel'
                  ? 'bg-gradient-to-r from-emerald-500 to-purple-500 text-white shadow-lg'
                  : 'bg-white/5 border border-white/10 text-white/60 hover:text-white hover:border-emerald-400/60'
              }`}
            >
              <Shuffle size={18} />
              Wheel
            </button>
          </div>
        </header>

        {loading && (
          <div className="text-center py-20">
            <div className="inline-block w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            <p className="text-white/60 mt-4">Loading Steam library...</p>
          </div>
        )}

        {error && !loading && (
          <div className="text-center py-20 space-y-4">
            <p className="text-red-400 font-bold">Failed to load library</p>
            <p className="text-white/50 text-sm">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:border-emerald-400/60 transition-all font-bold"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-6">
            {/* Shared search + sort bar */}
            <div className="flex gap-3 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="text"
                  placeholder="Search games..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-3 focus:border-emerald-400 focus:outline-none text-sm"
                />
              </div>
              <button
                onClick={() => setSortBy(s => s === 'playtime' ? 'alpha' : 'playtime')}
                className="flex items-center gap-2 px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:border-emerald-400/60 transition-all text-sm font-bold"
              >
                <ArrowUpDown size={14} />
                {sortBy === 'playtime' ? 'Most Played' : 'A–Z'}
              </button>
            </div>

            {/* Browse view */}
            {activeTool === 'browse' && (
              <div>
                <p className="text-white/40 text-sm mb-4">
                  {visibleGames.length} game{visibleGames.length !== 1 ? 's' : ''}
                  {query ? ` matching "${query}"` : ' in library'}
                </p>
                {visibleGames.length === 0 ? (
                  <div className="text-center py-16 text-white/40">No games match your search.</div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {visibleGames.map(game => (
                      <div
                        key={game.appid}
                        className="group rounded-xl overflow-hidden border border-white/10 bg-white/5 hover:border-emerald-500/40 hover:scale-105 transition-all duration-200"
                      >
                        <div className="aspect-[460/215] relative overflow-hidden bg-black/40">
                          <img
                            src={game.img_logo_url}
                            alt={game.name}
                            className="w-full h-full object-cover"
                            onError={e => { e.target.style.display = 'none'; }}
                          />
                        </div>
                        <div className="p-3">
                          <p className="font-bold text-white text-xs line-clamp-2 group-hover:text-emerald-400 transition-colors">
                            {game.name}
                          </p>
                          {game.playtime_forever > 0 && (
                            <p className="flex items-center gap-1 text-white/40 text-xs mt-1">
                              <Clock size={10} />
                              {game.playtime_forever}h
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Wheel view */}
            {activeTool === 'wheel' && (
              <div className="max-w-lg mx-auto p-8 bg-gradient-to-br from-emerald-900/20 to-purple-900/20 border border-emerald-500/20 rounded-xl backdrop-blur-sm">
                <div className="flex items-center gap-2 text-emerald-400 font-bold mb-2">
                  <Gamepad2 size={18} />
                  Game Wheel
                </div>
                <h2 className="text-3xl font-black tracking-tighter mb-6">
                  Let fate decide.
                </h2>
                <GameWheel games={visibleGames} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
