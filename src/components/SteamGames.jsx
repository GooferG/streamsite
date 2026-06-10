import { useEffect, useState } from 'react';
import SectionHeader from './SectionHeader';
import SectionDivider from './SectionDivider';

function GameSkeleton() {
  return (
    <div className="aspect-[16/9] bg-zinc-card border border-white/5 rounded-md" />
  );
}

function GameCard({ game, index }) {
  const rank = String(index + 1).padStart(2, '0');
  return (
    <div className="group">
      <div className="relative aspect-[16/9] bg-zinc-card border border-white/5 overflow-hidden rounded-md transition-colors duration-200 group-hover:border-purple-gamba/40">
        {game.img_logo_url ? (
          <img
            src={game.img_logo_url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-zinc-elevated" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-broadcast/85 via-zinc-broadcast/10 to-transparent" />

        <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-zinc-broadcast/80 text-purple-bright text-[10px] font-bold font-mono tracking-eyebrow-sm">
          #{rank}
        </div>
      </div>

      <div className="mt-2 bg-zinc-card border border-white/5 border-t-0 px-3 py-2.5 transition-colors duration-200 group-hover:bg-zinc-elevated rounded-b-md">
        <h3 className="text-sm font-bold text-white-body line-clamp-2 leading-snug mb-1.5">
          {game.name}
        </h3>
        <div className="flex items-center justify-between gap-3 text-[10px] font-bold tracking-eyebrow-xs uppercase">
          <span className="text-white/55">Total</span>
          <span className="text-purple-bright tabular-nums font-mono">
            {game.playtime_forever}h
          </span>
        </div>
        {game.playtime_2weeks > 0 && (
          <div className="mt-1 flex items-center justify-between gap-3 text-[10px] font-bold tracking-eyebrow-xs uppercase">
            <span className="text-white/55">2w</span>
            <span className="text-emerald-signal tabular-nums font-mono">
              {game.playtime_2weeks}h
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SteamGames({ segment = '03', withDivider = false }) {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSteamGames = async () => {
      try {
        const response = await fetch('/api/steam-games');
        if (!response.ok) throw new Error('Failed to fetch Steam games');
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

  if (!loading && (error || games.length === 0)) {
    return null;
  }

  return (
    <>
      {withDivider && <SectionDivider />}
      <section className="py-16 px-6 sm:px-10">
      <div className="max-w-7xl mx-auto">
        <SectionHeader
          segment={segment}
          eyebrow="Most played · Steam"
          title="Off-air rotation"
          accent="white"
        />

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <GameSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {games.map((game, i) => (
              <GameCard key={game.appid} game={game} index={i} />
            ))}
          </div>
        )}
        </div>
      </section>
    </>
  );
}
