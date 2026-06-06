import { useState, useEffect, useMemo } from 'react';
import {
  List,
  Shuffle,
  Search,
  Clock,
  ArrowUpDown,
  RefreshCcw,
} from 'lucide-react';
import GameWheel from '../components/GameWheel';
import { useNowTimestamp, formatTimecode } from '../utils/timecode';

const inputCls =
  'w-full bg-zinc-broadcast/60 border border-white/10 pl-10 pr-4 py-2.5 text-sm text-white-body placeholder:text-white/25 focus:border-emerald-signal/70 focus:outline-none transition-colors duration-150';

const TOOLS = [
  { id: 'browse', label: 'Browse', code: 'LIB', icon: List },
  { id: 'wheel', label: 'Wheel', code: 'WHL', icon: Shuffle },
];

function ScanlineOverlay() {
  return (
    <div
      className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-screen motion-reduce:hidden"
      aria-hidden="true"
      style={{
        backgroundImage:
          'repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(255,255,255,0.6) 2px, rgba(255,255,255,0.6) 3px)',
      }}
    />
  );
}

function ToolTab({ tool, active, onClick }) {
  const Icon = tool.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2.5 px-4 py-2.5 transition-colors duration-150 ${
        active
          ? 'bg-zinc-card text-white-body'
          : 'text-white/55 hover:text-white-body hover:bg-zinc-card/50'
      }`}
    >
      <span
        className={`text-[0.625rem] font-bold tracking-eyebrow-md tabular-nums ${
          active ? 'text-emerald-signal' : 'text-white/30'
        } font-mono`}
      >
        {tool.code}
      </span>
      <Icon size={14} aria-hidden="true" className="opacity-80" />
      <span className="text-sm font-bold tracking-tight">{tool.label}</span>
    </button>
  );
}

function GameCard({ game, index }) {
  const tape = String(index + 1).padStart(3, '0');
  return (
    <div className="group border border-white/8 bg-zinc-card/40 hover:border-emerald-signal/40 transition-colors duration-200 overflow-hidden">
      <div className="relative aspect-[460/215] overflow-hidden bg-zinc-broadcast">
        {game.img_logo_url ? (
          <img
            src={game.img_logo_url}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-zinc-elevated" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-broadcast/85 via-zinc-broadcast/10 to-transparent" />
        <div
          className="absolute top-2 left-2 px-1.5 py-0.5 bg-zinc-broadcast/80 text-emerald-signal text-[0.625rem] font-bold tracking-eyebrow font-mono"
      >
          #{tape}
        </div>
      </div>
      <div className="px-3 py-2.5">
        <p className="text-xs font-bold text-white-body line-clamp-2 leading-snug">
          {game.name}
        </p>
        {game.playtime_forever > 0 && (
          <div
            className="mt-1.5 flex items-center justify-between gap-2 text-[0.625rem] font-bold tracking-eyebrow uppercase font-mono"
      >
            <span className="text-white/45 inline-flex items-center gap-1">
              <Clock size={10} aria-hidden="true" />
              Played
            </span>
            <span className="text-emerald-signal tabular-nums">
              {game.playtime_forever}h
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function GamingPage() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTool, setActiveTool] = useState('browse');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('playtime');
  const now = useNowTimestamp();

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
    let filtered = searchQuery.trim()
      ? games.filter((g) =>
          g.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : games;

    if (sortBy === 'alpha') {
      filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    }
    return filtered;
  }, [games, searchQuery, sortBy]);

  return (
    <div className="relative pt-32 pb-24 px-6 sm:px-10">
      <ScanlineOverlay />

      <div className="relative max-w-7xl 2xl:max-w-[1440px] mx-auto">
        {/* Slate header */}
        <header className="mb-10 sm:mb-12">
          <div
            className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[0.625rem] sm:text-[0.6875rem] font-bold uppercase tracking-eyebrow-lg text-white/45 mb-6 font-mono"
      >
            <span className="inline-flex items-center gap-2 text-emerald-signal">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-signal" />
              <span>STEAM LIBRARY</span>
            </span>
            <span className="text-white/20">·</span>
            <span>GAME PICKER</span>
            <span className="text-white/20">·</span>
            <span className="text-white/30 tabular-nums">
              {String(games.length).padStart(3, '0')} TITLES
            </span>
          </div>

          <h1
            className="font-black leading-[0.82] tracking-[-0.035em] text-white-body select-none"
            style={{
              fontFamily: 'ui-sans-serif, system-ui, sans-serif',
              fontSize: 'clamp(3rem, 10vw, 6.5rem)',
            }}
          >
            <span className="block">Can't decide?</span>
            <span className="block text-emerald-signal">Spin the wheel.</span>
          </h1>

          <div
            className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-[0.6875rem] uppercase tracking-eyebrow text-white/45 font-mono"
      >
            <span>
              Source · <span className="text-white/70">Steam</span>
            </span>
            <span className="text-white/15">·</span>
            <span>
              Sort ·{' '}
              <span className="text-white/70">
                {sortBy === 'playtime' ? 'Most played' : 'A–Z'}
              </span>
            </span>
            <span className="text-white/15">·</span>
            <span>
              Now ·{' '}
              <span className="text-emerald-signal tabular-nums">
                {formatTimecode(now)}
              </span>
            </span>
          </div>
        </header>

        {/* Loading */}
        {loading && (
          <div className="border border-white/8 bg-zinc-card/30 py-16 flex flex-col items-center gap-3">
            <RefreshCcw
              size={20}
              className="text-white/40 animate-spin"
              aria-hidden="true"
            />
            <p
              className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/40 font-mono"
      >
              Loading library…
            </p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="border border-white/8 bg-zinc-card/30 py-16 px-6 flex flex-col items-center gap-3 text-center">
            <p
              className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-red-destructive/80 font-mono"
      >
              Signal lost
            </p>
            <p className="text-sm text-white/55">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150"
            >
              <RefreshCcw size={12} aria-hidden="true" />
              <span
                className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono"
      >
                Retry
              </span>
            </button>
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-6">
            {/* Mode toggle */}
            <div className="inline-flex border border-white/8 bg-zinc-card/30">
              {TOOLS.map((tool, i) => (
                <div
                  key={tool.id}
                  className={i > 0 ? 'border-l border-white/8' : ''}
                >
                  <ToolTab
                    tool={tool}
                    active={activeTool === tool.id}
                    onClick={() => setActiveTool(tool.id)}
                  />
                </div>
              ))}
            </div>

            {/* Search + sort */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  placeholder="Search library…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={inputCls}
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  setSortBy((s) => (s === 'playtime' ? 'alpha' : 'playtime'))
                }
                className="inline-flex items-center gap-2 px-3.5 py-2.5 border border-white/10 text-white/65 hover:text-white-body hover:border-emerald-signal/40 transition-colors duration-150"
              >
                <ArrowUpDown size={13} aria-hidden="true" />
                <span
                  className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono"
      >
                  {sortBy === 'playtime' ? 'Most played' : 'A–Z'}
                </span>
              </button>
            </div>

            {/* Result strip */}
            <div
              className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/40 font-mono"
      >
              <span>
                Showing{' '}
                <span className="text-white/70 tabular-nums">
                  {String(visibleGames.length).padStart(3, '0')}
                </span>
                {' / '}
                <span className="text-white/70 tabular-nums">
                  {String(games.length).padStart(3, '0')}
                </span>
              </span>
              {searchQuery && (
                <>
                  <span className="text-white/15">·</span>
                  <span>
                    Filter ·{' '}
                    <span className="text-emerald-signal normal-case tracking-normal">
                      "{searchQuery}"
                    </span>
                  </span>
                </>
              )}
            </div>

            {/* Browse view */}
            {activeTool === 'browse' && (
              <>
                {visibleGames.length === 0 ? (
                  <div className="border border-white/8 bg-zinc-card/30 py-16 text-center">
                    <p
                      className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/40 mb-2 font-mono"
      >
                      No matches
                    </p>
                    <p className="text-sm text-white/55">
                      No games match the current search.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {visibleGames.map((game, i) => (
                      <GameCard key={game.appid} game={game} index={i} />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Wheel view */}
            {activeTool === 'wheel' && (
              <div className="max-w-lg mx-auto border border-white/8 bg-zinc-card/30">
                <div
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 border-b border-white/8 text-[0.625rem] font-bold uppercase tracking-eyebrow-md font-mono"
      >
                  <span className="inline-flex items-center gap-2 text-emerald-signal">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-signal" />
                    <span>WHEEL READY</span>
                  </span>
                  <span className="text-white/15">·</span>
                  <span className="text-white/45">POOL</span>
                  <span className="text-white/70 tabular-nums tracking-eyebrow-lg">
                    {String(visibleGames.length).padStart(3, '0')}
                  </span>
                </div>
                <div className="px-5 py-6">
                  <p
                    className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/40 mb-2 font-mono"
      >
                    Game wheel
                  </p>
                  <h2 className="text-2xl font-bold tracking-tight text-white-body mb-5">
                    Let fate decide.
                  </h2>
                  <GameWheel games={visibleGames} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
