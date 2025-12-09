import React, { useState, useEffect } from 'react';
import { Gamepad2, Clock } from 'lucide-react';

export default function SteamGames() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSteamGames = async () => {
      try {
        const response = await fetch('/api/steam-games');

        if (!response.ok) {
          throw new Error('Failed to fetch Steam games');
        }

        const data = await response.json();
        setGames(data.games || []);
      } catch (err) {
        console.error('Error fetching Steam games:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSteamGames();
  }, []);

  if (loading) {
    return (
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="inline-block w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
            <p className="text-white/60 mt-4">Loading Steam games...</p>
          </div>
        </div>
      </section>
    );
  }

  if (error || games.length === 0) {
    return null; // Don't show section if there's an error or no games
  }

  return (
    <section className="py-24 px-6 bg-black/20 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <Gamepad2 size={32} className="text-purple-400" />
            <h2 className="text-5xl font-black tracking-tighter">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-purple-400">
                TOP PLAYED GAMES
              </span>
            </h2>
          </div>
          <p className="text-white/60 text-lg">
            My most-played games on Steam recently
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {games.map((game, index) => (
            <div
              key={game.appid}
              className="group relative overflow-hidden rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-900/20 to-emerald-900/20 backdrop-blur-sm transition-all duration-300 hover:border-purple-500/40 hover:scale-105"
              style={{
                animation: `slideInUp 0.6s ease-out ${index * 0.1}s both`
              }}
            >
              {/* Game Header Image */}
              <div className="aspect-[16/9] relative overflow-hidden">
                <img
                  src={game.img_logo_url}
                  alt={game.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                  onError={(e) => {
                    e.target.src = `https://via.placeholder.com/460x215/1a1a2e/ffffff?text=${encodeURIComponent(game.name)}`;
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

                {/* Rank Badge */}
                <div className="absolute top-3 left-3 w-10 h-10 rounded-full bg-purple-500/90 flex items-center justify-center font-black text-white text-lg">
                  {index + 1}
                </div>
              </div>

              {/* Game Info */}
              <div className="p-4">
                <h3 className="font-bold text-white mb-3 line-clamp-2 text-sm group-hover:text-purple-400 transition-colors">
                  {game.name}
                </h3>

                <div className="space-y-2 text-xs">
                  {/* Total Playtime */}
                  <div className="flex items-center justify-between text-white/60">
                    <span className="flex items-center gap-1.5">
                      <Clock size={14} />
                      Total
                    </span>
                    <span className="font-bold text-purple-400">
                      {game.playtime_forever}h
                    </span>
                  </div>

                  {/* Recent Playtime (if available) */}
                  {game.playtime_2weeks > 0 && (
                    <div className="flex items-center justify-between text-white/60">
                      <span>Last 2 weeks</span>
                      <span className="font-bold text-emerald-400">
                        {game.playtime_2weeks}h
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
