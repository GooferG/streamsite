import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Search,
  Filter,
  Dice6,
  Play,
  RotateCcw,
  ChevronDown,
  X,
  Zap,
  Layers,
  TrendingUp,
  ImageOff,
} from 'lucide-react';
import rawSlots from '../data/slots';

// Normalise local DB entries to the same shape the UI expects
const ALL_SLOTS = rawSlots.map((g) => ({
  id: g.id,
  slug: String(g.id),
  name: g.name,
  providerName: g.provider,
  providerSlug: g.provider.toLowerCase().replace(/[^a-z0-9]/g, '-'),
  thumbnail: g.image,
  rtp: g.rtp ?? null,
  volatility: g.volatility ?? null,
  bonusBuy: Boolean(g.bonusBuy),
  megaways: Boolean(g.megaways),
  progressive: Boolean(g.progressive),
}));

const ALL_PROVIDERS = Array.from(
  new Map(
    ALL_SLOTS.map((g) => [
      g.providerSlug,
      { name: g.providerName, slug: g.providerSlug, thumbnail: null },
    ])
  ).values()
).sort((a, b) => a.name.localeCompare(b.name));

// ─── Mono badge primitives ───────────────────────────────────────────────────
function MonoBadge({ children, tone = 'neutral' }) {
  const styles = {
    emerald: 'border-emerald-signal/50 text-emerald-signal',
    purple: 'border-purple-gamba/50 text-purple-bright',
    orange: 'border-orange-admin/50 text-orange-admin',
    red: 'border-red-destructive/50 text-red-destructive',
    yellow: 'border-yellow-500/50 text-yellow-400',
    neutral: 'border-white/20 text-white/65',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 border text-[10px] font-bold tracking-eyebrow uppercase ${styles[tone]} font-mono`}
      >
      {children}
    </span>
  );
}

function VolatilityBadge({ value }) {
  if (!value) return null;
  const tone =
    value?.toLowerCase() === 'high'
      ? 'red'
      : value?.toLowerCase() === 'medium'
        ? 'yellow'
        : value?.toLowerCase() === 'low'
          ? 'neutral'
          : 'neutral';
  return <MonoBadge tone={tone}>{value}</MonoBadge>;
}

// ─── Slot image with fallback ────────────────────────────────────────────────
function SlotImage({ src, alt, className }) {
  const [errored, setErrored] = useState(false);
  if (!src || errored) {
    return (
      <div
        className={`flex items-center justify-center bg-zinc-broadcast/60 border border-white/8 ${className}`}
      >
        <ImageOff size={20} className="text-white/20" aria-hidden="true" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setErrored(true)}
      className={`object-cover ${className}`}
    />
  );
}

// ─── Root component ──────────────────────────────────────────────────────────
export default function SlotPicker() {
  const [activeTab, setActiveTab] = useState('search');

  return (
    <div className="space-y-5">
      <style>{`
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
        .skeleton-shimmer {
          background: linear-gradient(90deg,
            rgba(255,255,255,0.04) 25%,
            rgba(255,255,255,0.09) 50%,
            rgba(255,255,255,0.04) 75%
          );
          background-size: 200% 100%;
          animation: shimmer 1.6s infinite;
        }
        @keyframes signal-acquired {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .signal-acquired { animation: signal-acquired 0.35s ease-out forwards; }
        @keyframes signal-pulse {
          0%, 100% { opacity: 0.55; }
          50%      { opacity: 1; }
        }
        .signal-pulse { animation: signal-pulse 1.4s ease-in-out infinite; }
        @keyframes confetti-fall {
          0%   { transform: translateY(-100vh) rotate(0deg);   opacity: 1; }
          100% { transform: translateY(100vh)  rotate(720deg); opacity: 0; }
        }
        .confetti-particle {
          position: absolute; width: 8px; height: 8px; top: -10px;
          animation: confetti-fall 3s ease-in forwards;
        }
        @keyframes tune-scan {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        .tune-scan-line {
          background: linear-gradient(
            to bottom,
            transparent 0%,
            rgba(16, 185, 129, 0.18) 50%,
            transparent 100%
          );
          animation: tune-scan 0.9s linear infinite;
        }
      `}</style>

      {/* Mode toggle — broadcast tab strip */}
      <div className="inline-flex border border-white/8 bg-zinc-card/30">
        {[
          { id: 'search', label: 'Catalog', code: 'CAT', icon: Search },
          { id: 'picker', label: 'Slot Spinner', code: 'SPN', icon: Dice6 },
        ].map((t, i) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2.5 px-4 py-2.5 transition-colors duration-150 ${
                i > 0 ? 'border-l border-white/8' : ''
              } ${
                isActive
                  ? 'bg-zinc-card text-white-body'
                  : 'text-white/55 hover:text-white-body hover:bg-zinc-card/50'
              }`}
            >
              <span
                className={`text-[10px] font-bold tracking-eyebrow-md tabular-nums ${
                  isActive ? 'text-emerald-signal' : 'text-white/30'
                } font-mono`}
      >
                {t.code}
              </span>
              <Icon size={14} aria-hidden="true" className="opacity-80" />
              <span className="text-sm font-bold tracking-tight">{t.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === 'search' && <SlotSearch />}
      {activeTab === 'picker' && <SlotRandomizer />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CATALOG (search)
// ═══════════════════════════════════════════════════════════════════════════
function SlotSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBonusBuy, setFilterBonusBuy] = useState(false);
  const [filterMegaways, setFilterMegaways] = useState(false);
  const [filterProgressive, setFilterProgressive] = useState(false);
  const [volatility, setVolatility] = useState('all');
  const [selectedProviders, setSelectedProviders] = useState([]);
  const [providerDropdownOpen, setProviderDropdownOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(24);
  const dropdownRef = useRef(null);
  const PER_PAGE = 24;

  const filteredGames = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return ALL_SLOTS.filter((g) => {
      if (
        term &&
        !g.name.toLowerCase().includes(term) &&
        !g.providerName.toLowerCase().includes(term)
      )
        return false;
      if (filterBonusBuy && !g.bonusBuy) return false;
      if (filterMegaways && !g.megaways) return false;
      if (filterProgressive && !g.progressive) return false;
      if (volatility !== 'all' && g.volatility !== volatility) return false;
      if (
        selectedProviders.length > 0 &&
        !selectedProviders.includes(g.providerSlug)
      )
        return false;
      return true;
    });
  }, [
    searchTerm,
    filterBonusBuy,
    filterMegaways,
    filterProgressive,
    volatility,
    selectedProviders,
  ]);

  const prevFiltered = useRef(filteredGames);
  if (prevFiltered.current !== filteredGames) {
    prevFiltered.current = filteredGames;
    setVisibleCount(PER_PAGE);
  }

  const visibleGames = filteredGames.slice(0, visibleCount);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setProviderDropdownOpen(false);
    };
    if (providerDropdownOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [providerDropdownOpen]);

  const toggleProvider = (slug) => {
    setSelectedProviders((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const activeFilters = [
    filterBonusBuy,
    filterMegaways,
    filterProgressive,
    volatility !== 'all',
    selectedProviders.length > 0,
  ].filter(Boolean).length;

  const inputCls =
    'bg-zinc-broadcast/60 border border-white/10 px-3 py-2.5 text-sm text-white-body placeholder:text-white/25 focus:border-emerald-signal/70 focus:outline-none transition-colors duration-150';

  return (
    <div className="space-y-5">
      {/* Search bar + provider dropdown */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35"
            size={16}
            aria-hidden="true"
          />
          <input
            type="text"
            placeholder="Search catalog…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full pl-10 pr-4 ${inputCls}`}
          />
        </div>

        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setProviderDropdownOpen((o) => !o)}
            className={`inline-flex items-center gap-2 px-3.5 py-2.5 border transition-colors duration-150 whitespace-nowrap ${
              selectedProviders.length > 0
                ? 'bg-emerald-signal/10 border-emerald-signal/40 text-emerald-signal'
                : 'border-white/10 text-white/65 hover:text-white-body hover:border-white/25'
            }`}
          >
            <Filter size={13} aria-hidden="true" />
            <span
              className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono"
      >
              {selectedProviders.length > 0
                ? `${selectedProviders.length} providers`
                : 'All providers'}
            </span>
            <ChevronDown
              size={13}
              className={`transition-transform ${providerDropdownOpen ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>

          {providerDropdownOpen && (
            <div className="absolute top-full mt-2 left-0 z-50 w-64 max-h-72 overflow-y-auto bg-zinc-broadcast border border-white/10 p-2 shadow-2xl">
              {selectedProviders.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedProviders([])}
                  className="w-full text-left px-3 py-2 text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/40 hover:text-emerald-signal transition-colors mb-1 border-b border-white/5 font-mono"
      >
                  Clear selection
                </button>
              )}
              {ALL_PROVIDERS.map((p) => (
                <label
                  key={p.slug}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-zinc-card/60 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedProviders.includes(p.slug)}
                    onChange={() => toggleProvider(p.slug)}
                    className="accent-emerald-signal"
                  />
                  <span className="text-sm text-white/80">{p.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Feature toggles + volatility */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: 'Bonus buy', icon: Zap, active: filterBonusBuy, toggle: () => setFilterBonusBuy((v) => !v), tone: 'purple' },
          { label: 'Megaways', icon: Layers, active: filterMegaways, toggle: () => setFilterMegaways((v) => !v), tone: 'purple' },
          { label: 'Progressive', icon: TrendingUp, active: filterProgressive, toggle: () => setFilterProgressive((v) => !v), tone: 'purple' },
        ].map((f) => {
          const Icon = f.icon;
          return (
            <button
              key={f.label}
              type="button"
              onClick={f.toggle}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 border text-[10px] font-bold tracking-eyebrow-md uppercase transition-colors duration-150 ${
                f.active
                  ? 'border-purple-gamba/50 text-purple-bright bg-purple-gamba/10'
                  : 'border-white/10 text-white/55 hover:text-white-body hover:border-white/25'
              } font-mono`}
      >
              <Icon size={11} aria-hidden="true" />
              {f.label}
            </button>
          );
        })}

        <div className="flex items-center gap-1.5 ml-auto">
          {['all', 'low', 'medium', 'high'].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVolatility(v)}
              className={`px-2.5 py-1.5 border text-[10px] font-bold tracking-eyebrow-md uppercase transition-colors duration-150 ${
                volatility === v
                  ? 'border-emerald-signal/50 text-emerald-signal bg-emerald-signal/10'
                  : 'border-white/10 text-white/55 hover:text-white-body hover:border-white/25'
              } font-mono`}
      >
              {v === 'all' ? 'All vol.' : v}
            </button>
          ))}
        </div>
      </div>

      {/* Filter / result strip */}
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/40 font-mono"
      >
        <span>
          Showing{' '}
          <span className="text-white/70 tabular-nums">
            {String(visibleGames.length).padStart(3, '0')}
          </span>
          {' / '}
          <span className="text-white/70 tabular-nums">
            {String(filteredGames.length).padStart(3, '0')}
          </span>
        </span>
        {activeFilters > 0 && (
          <>
            <span className="text-white/15">·</span>
            <span>
              <span className="text-emerald-signal tabular-nums">
                {String(activeFilters).padStart(2, '0')}
              </span>{' '}
              filter{activeFilters !== 1 ? 's' : ''} active
            </span>
            <button
              type="button"
              onClick={() => {
                setFilterBonusBuy(false);
                setFilterMegaways(false);
                setFilterProgressive(false);
                setVolatility('all');
                setSelectedProviders([]);
                setSearchTerm('');
              }}
              className="inline-flex items-center gap-1.5 text-white/40 hover:text-emerald-signal transition-colors"
            >
              <X size={11} aria-hidden="true" /> Clear all
            </button>
          </>
        )}
      </div>

      {/* Game grid */}
      {visibleGames.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {visibleGames.map((game, idx) => {
            const tape = String(idx + 1).padStart(3, '0');
            return (
              <div
                key={`${game.slug}-${idx}`}
                className="group border border-white/8 bg-zinc-card/40 hover:border-emerald-signal/40 transition-colors duration-200 overflow-hidden"
              >
                <div className="relative aspect-video overflow-hidden">
                  <SlotImage
                    src={game.thumbnail}
                    alt={game.name}
                    className="w-full h-full"
                  />
                  <div
                    className="absolute top-2 left-2 px-1.5 py-0.5 bg-zinc-broadcast/80 text-emerald-signal text-[10px] font-bold tracking-eyebrow font-mono"
      >
                    #{tape}
                  </div>
                </div>
                <div className="p-3 space-y-2">
                  <div>
                    <p className="font-bold text-white-body text-sm leading-tight line-clamp-1">
                      {game.name}
                    </p>
                    <p
                      className="text-[10px] tracking-eyebrow-sm uppercase text-white/40 truncate mt-0.5 font-mono"
      >
                      {game.providerName}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {game.rtp != null && (
                      <MonoBadge tone="emerald">{game.rtp}% RTP</MonoBadge>
                    )}
                    <VolatilityBadge value={game.volatility} />
                    {game.bonusBuy && (
                      <MonoBadge tone="purple">
                        <Zap size={9} aria-hidden="true" /> BB
                      </MonoBadge>
                    )}
                    {game.megaways && (
                      <MonoBadge tone="purple">
                        <Layers size={9} aria-hidden="true" /> MW
                      </MonoBadge>
                    )}
                    {game.progressive && (
                      <MonoBadge tone="yellow">
                        <TrendingUp size={9} aria-hidden="true" /> PROG
                      </MonoBadge>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {filteredGames.length === 0 && (
        <div
          className="text-center py-16 border border-white/8 bg-zinc-card/30 font-mono"
      >
          <p className="text-[11px] font-bold tracking-eyebrow-lg uppercase text-white/40 mb-2">
            No signal
          </p>
          <p className="text-sm text-white/55">
            No slots match the current filters.
          </p>
        </div>
      )}

      {/* Load more */}
      {visibleCount < filteredGames.length && (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={() => setVisibleCount((c) => c + PER_PAGE)}
            className="inline-flex items-center gap-2 px-5 py-2.5 border border-white/10 text-white/65 hover:text-white-body hover:border-emerald-signal/40 transition-colors duration-150"
          >
            <span
              className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono"
      >
              Load more
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SIGNAL LOCK (randomizer)
// ═══════════════════════════════════════════════════════════════════════════
function SlotRandomizer() {
  const [excludedProviders, setExcludedProviders] = useState(new Set());
  const [filterBonusBuyOnly, setFilterBonusBuyOnly] = useState(false);
  const [filterMegawaysOnly, setFilterMegawaysOnly] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [selectedGame, setSelectedGame] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const wheelRef = useRef(null);

  const ITEM_HEIGHT = 120;
  const CYCLES = 5;
  const SPIN_MS = 4200;

  const candidates = useMemo(() => {
    return ALL_SLOTS.filter((g) => {
      if (excludedProviders.has(g.providerSlug)) return false;
      if (filterBonusBuyOnly && !g.bonusBuy) return false;
      if (filterMegawaysOnly && !g.megaways) return false;
      return true;
    });
  }, [excludedProviders, filterBonusBuyOnly, filterMegawaysOnly]);

  const toggleProvider = useCallback((slug) => {
    setExcludedProviders((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }, []);

  const resetWheel = () => {
    setSelectedGame(null);
    setIsSpinning(false);
    if (wheelRef.current) {
      wheelRef.current.style.transition = 'none';
      wheelRef.current.style.transform = 'translateY(0)';
    }
  };

  const spinWheel = () => {
    if (isSpinning || candidates.length === 0) return;
    setIsSpinning(true);
    setSelectedGame(null);

    const randomIndex = Math.floor(Math.random() * candidates.length);
    const WINDOW_CENTER = 180;
    const finalOffset =
      (CYCLES * candidates.length + randomIndex) * ITEM_HEIGHT -
      (WINDOW_CENTER - ITEM_HEIGHT / 2);

    if (wheelRef.current) {
      wheelRef.current.style.transition = 'none';
      wheelRef.current.style.transform = 'translateY(0)';
      wheelRef.current.getBoundingClientRect();
      wheelRef.current.style.transition = `transform ${SPIN_MS}ms cubic-bezier(0.05, 0.8, 0.1, 1)`;
      wheelRef.current.style.transform = `translateY(-${finalOffset}px)`;
    }

    setTimeout(() => {
      setSelectedGame(candidates[randomIndex]);
      setIsSpinning(false);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    }, SPIN_MS);
  };

  const reelItems = useMemo(() => {
    if (candidates.length === 0) return [];
    return Array.from({ length: CYCLES + 1 }, () => candidates).flat();
  }, [candidates]);

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Left — reel + spin */}
      <div className="lg:col-span-2 space-y-5">
        {/* Eligibility strip */}
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 border border-white/8 bg-zinc-card/30 text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono"
      >
          <span className="inline-flex items-center gap-2 text-emerald-signal">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-signal" />
            <span>SCANNER READY</span>
          </span>
          <span className="text-white/15">·</span>
          <span className="text-white/45">CANDIDATES</span>
          <span className="text-white/75 tabular-nums">
            {String(candidates.length).padStart(3, '0')}
          </span>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => setFilterBonusBuyOnly((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-2 py-1 border transition-colors duration-150 ${
                filterBonusBuyOnly
                  ? 'border-purple-gamba/50 text-purple-bright bg-purple-gamba/10'
                  : 'border-white/10 text-white/55 hover:text-white-body hover:border-white/25'
              }`}
            >
              <Zap size={10} aria-hidden="true" />
              <span className="text-[10px] tracking-eyebrow-md">BB only</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterMegawaysOnly((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-2 py-1 border transition-colors duration-150 ${
                filterMegawaysOnly
                  ? 'border-purple-gamba/50 text-purple-bright bg-purple-gamba/10'
                  : 'border-white/10 text-white/55 hover:text-white-body hover:border-white/25'
              }`}
            >
              <Layers size={10} aria-hidden="true" />
              <span className="text-[10px] tracking-eyebrow-md">MW only</span>
            </button>
          </div>
        </div>

        {/* Reel container — broadcast scanner */}
        <div className="relative border border-white/10 bg-zinc-broadcast overflow-hidden">
          {/* Scanline atmosphere */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-screen motion-reduce:hidden z-20"
            aria-hidden="true"
            style={{
              backgroundImage:
                'repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(255,255,255,0.6) 2px, rgba(255,255,255,0.6) 3px)',
            }}
          />

          {/* Tuning scan line — only while spinning */}
          {isSpinning && (
            <div
              className="pointer-events-none absolute inset-0 z-30 overflow-hidden motion-reduce:hidden"
              aria-hidden="true"
            >
              <div className="tune-scan-line absolute inset-x-0 h-32" />
            </div>
          )}

          {/* Signal Lock label */}
          <div
            className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-3 py-2 border-b border-white/8 bg-zinc-broadcast/80 text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono"
      >
            <span
              className={`inline-flex items-center gap-2 ${
                isSpinning ? 'text-orange-admin signal-pulse' : 'text-emerald-signal'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isSpinning ? 'bg-orange-admin' : 'bg-emerald-signal'
                }`}
              />
              <span>{isSpinning ? 'Tuning…' : 'Signal lock'}</span>
            </span>
            <span className="text-white/30">REEL · GG-04</span>
          </div>

          <div className="relative" style={{ height: '360px' }}>
            {/* Fade top */}
            <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-zinc-broadcast to-transparent z-10 pointer-events-none" />

            {/* Selection window */}
            <div
              className="absolute top-1/2 left-0 right-0 -translate-y-1/2 z-10 pointer-events-none"
              style={{ height: `${ITEM_HEIGHT}px` }}
            >
              <div className="absolute inset-0 border-y border-emerald-signal/70 bg-emerald-signal/5" />
              <span
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-signal font-bold text-xl leading-none"
                
                aria-hidden="true"
              >
                [
              </span>
              <span
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-signal font-bold text-xl leading-none"
                
                aria-hidden="true"
              >
                ]
              </span>
            </div>

            {/* Fade bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-zinc-broadcast to-transparent z-10 pointer-events-none" />

            {/* Reel track */}
            <div className="absolute inset-0 overflow-hidden">
              <div
                ref={wheelRef}
                style={{
                  transition: 'none',
                  transform: 'translateY(0)',
                  willChange: 'transform',
                }}
              >
                {candidates.length === 0 ? (
                  <div
                    className="flex flex-col items-center justify-center h-[360px] text-white/30 gap-2 font-mono"
      >
                    <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/40">
                      No signal
                    </span>
                    <span className="text-sm text-white/55">
                      Adjust filters to acquire candidates.
                    </span>
                  </div>
                ) : (
                  reelItems.map((game, i) => (
                    <div
                      key={`${game.slug}-${i}`}
                      className="flex items-center gap-4 px-5 border-b border-white/5"
                      style={{ height: `${ITEM_HEIGHT}px` }}
                    >
                      <SlotImage
                        src={game.thumbnail}
                        alt={game.name}
                        className="w-16 h-16 flex-shrink-0 border border-white/8"
                      />
                      <div className="min-w-0">
                        <p className="font-bold text-white-body text-base leading-tight truncate">
                          {game.name}
                        </p>
                        <p
                          className="text-[10px] tracking-eyebrow-sm uppercase text-white/45 truncate mt-0.5 font-mono"
      >
                          {game.providerName}
                        </p>
                        <div
                          className="flex gap-2 mt-1 flex-wrap text-[10px] font-bold tracking-eyebrow-sm uppercase font-mono"
      >
                          {game.rtp != null && (
                            <span className="text-emerald-signal tabular-nums">
                              {game.rtp}% RTP
                            </span>
                          )}
                          {game.bonusBuy && (
                            <span className="text-purple-bright">BB</span>
                          )}
                          {game.megaways && (
                            <span className="text-purple-bright">MW</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tune controls */}
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={spinWheel}
            disabled={isSpinning || candidates.length === 0}
            className={`group relative inline-flex items-center gap-3 px-10 sm:px-14 py-4 transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed overflow-hidden ${
              isSpinning
                ? 'bg-orange-admin/15 border border-orange-admin/40 text-orange-admin'
                : 'bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright border border-emerald-signal'
            }`}
          >
            <Play size={18} aria-hidden="true" className={isSpinning ? 'signal-pulse' : ''} />
            <span
              className="text-sm font-bold tracking-eyebrow-lg uppercase font-mono"
      >
              {isSpinning ? 'Tuning…' : 'Tune'}
            </span>
            {!isSpinning && (
              <span
                className="text-sm font-bold tracking-eyebrow-lg opacity-70"
                
                aria-hidden="true"
              >
                →
              </span>
            )}
          </button>

          {selectedGame && !isSpinning && (
            <button
              type="button"
              onClick={() => {
                resetWheel();
                spinWheel();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 border border-white/10 text-white/60 hover:text-white-body hover:border-emerald-signal/40 transition-colors duration-150"
            >
              <RotateCcw size={13} aria-hidden="true" />
              <span
                className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono"
      >
                Tune again
              </span>
            </button>
          )}
        </div>

        {/* Signal acquired panel */}
        {selectedGame && !isSpinning && (
          <div className="relative overflow-hidden border border-emerald-signal/40 bg-zinc-card/40 signal-acquired">
            {/* Atmospheric glow behind reveal */}
            <div
              className="pointer-events-none absolute -top-20 -right-20 w-64 h-64 rounded-full bg-emerald-signal/15 blur-3xl motion-reduce:hidden"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-screen motion-reduce:hidden"
              aria-hidden="true"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(255,255,255,0.6) 2px, rgba(255,255,255,0.6) 3px)',
              }}
            />

            <div
              className="relative flex items-center gap-2 px-4 py-2 border-b border-white/8 text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono"
      >
              <span className="relative flex w-1.5 h-1.5">
                <span className="absolute inset-0 rounded-full bg-emerald-signal motion-safe:animate-ping opacity-50" />
                <span className="relative w-1.5 h-1.5 rounded-full bg-emerald-signal" />
              </span>
              <span className="text-emerald-signal">Broadcast signal acquired</span>
            </div>

            <div className="relative p-5 sm:p-6 flex gap-5 items-start">
              <SlotImage
                src={selectedGame.thumbnail}
                alt={selectedGame.name}
                className="w-24 h-24 flex-shrink-0 border border-white/10"
              />
              <div className="flex-1 min-w-0">
                <p
                  className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/40 mb-1 font-mono"
      >
                  Now tuned to
                </p>
                <h3
                  className="text-2xl sm:text-3xl font-black text-white-body tracking-tight leading-tight"
                  style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
                >
                  {selectedGame.name}
                </h3>
                <p
                  className="text-[10px] tracking-eyebrow uppercase text-white/50 mt-1.5 font-mono"
      >
                  {selectedGame.providerName}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                  {selectedGame.rtp != null && (
                    <div className="px-2.5 py-1.5 border border-emerald-signal/40 bg-emerald-signal/5">
                      <p
                        className="text-[9px] font-bold tracking-eyebrow-md uppercase text-white/45 font-mono"
      >
                        RTP
                      </p>
                      <p className="font-bold text-emerald-signal tabular-nums mt-0.5">
                        {selectedGame.rtp}%
                      </p>
                    </div>
                  )}
                  {selectedGame.volatility && (
                    <div className="px-2.5 py-1.5 border border-white/10 bg-zinc-broadcast/40">
                      <p
                        className="text-[9px] font-bold tracking-eyebrow-md uppercase text-white/45 font-mono"
      >
                        Volatility
                      </p>
                      <p className="font-bold text-white-body capitalize mt-0.5">
                        {selectedGame.volatility}
                      </p>
                    </div>
                  )}
                  {selectedGame.bonusBuy && (
                    <div className="px-2.5 py-1.5 border border-purple-gamba/40 bg-purple-gamba/5">
                      <p
                        className="text-[9px] font-bold tracking-eyebrow-md uppercase text-white/45 font-mono"
      >
                        Bonus buy
                      </p>
                      <p
                        className="font-bold text-purple-bright mt-0.5 font-mono"
      >
                        AVAILABLE
                      </p>
                    </div>
                  )}
                  {selectedGame.megaways && (
                    <div className="px-2.5 py-1.5 border border-purple-gamba/40 bg-purple-gamba/5">
                      <p
                        className="text-[9px] font-bold tracking-eyebrow-md uppercase text-white/45 font-mono"
      >
                        Megaways
                      </p>
                      <p
                        className="font-bold text-purple-bright mt-0.5 font-mono"
      >
                        ENABLED
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right — provider exclusion */}
      <div className="border border-white/8 bg-zinc-card/30 h-fit">
        <div
          className="flex items-center justify-between px-3 py-2.5 border-b border-white/8 text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono"
      >
          <span className="text-white/55">Provider filter</span>
          {excludedProviders.size > 0 && (
            <button
              type="button"
              onClick={() => setExcludedProviders(new Set())}
              className="text-emerald-signal/80 hover:text-emerald-signal transition-colors"
            >
              Reset
            </button>
          )}
        </div>

        <p
          className="px-3 py-2.5 text-[10px] tracking-eyebrow uppercase text-white/35 border-b border-white/8 font-mono"
      >
          Unchecked providers are excluded.
        </p>

        <div className="max-h-[500px] overflow-y-auto">
          {ALL_PROVIDERS.map((p) => {
            const excluded = excludedProviders.has(p.slug);
            return (
              <label
                key={p.slug}
                className="flex items-center gap-3 px-3 py-2 border-b border-white/5 hover:bg-zinc-card/60 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={!excluded}
                  onChange={() => toggleProvider(p.slug)}
                  className="accent-emerald-signal"
                />
                <span
                  className={`text-sm flex-1 ${
                    excluded ? 'text-white/25 line-through' : 'text-white/80'
                  }`}
                >
                  {p.name}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Confetti — brand palette only */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 motion-reduce:hidden">
          {Array.from({ length: 60 }).map((_, i) => (
            <div
              key={i}
              className="confetti-particle"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 0.6}s`,
                borderRadius: Math.random() > 0.5 ? '50%' : '0',
                backgroundColor: [
                  '#10b981', // emerald-signal
                  '#34d399', // emerald-bright
                  '#fafafa', // white-body
                  '#f97316', // orange-admin
                ][Math.floor(Math.random() * 4)],
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
