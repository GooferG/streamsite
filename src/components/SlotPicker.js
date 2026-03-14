import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Search,
  Filter,
  Dice6,
  RefreshCw,
  Play,
  RotateCcw,
  ChevronDown,
  X,
  Zap,
  Layers,
  TrendingUp,
  ImageOff,
} from 'lucide-react';

// ─── Shared fetch helper ────────────────────────────────────────────────────
async function fetchSlots(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/slots?${qs}`);
  if (!res.ok) throw new Error(`slots API error: ${res.status}`);
  return res.json();
}

// ─── Normalise a raw API game object to a clean internal shape ───────────────
function normalizeGame(g) {
  return {
    id: g.id,
    slug: g.slug ?? String(g.id),
    name: g.name ?? 'Unknown',
    providerName: g.provider?.name ?? (typeof g.provider === 'string' ? g.provider : 'Unknown'),
    providerSlug: g.provider?.slug ?? (typeof g.provider === 'string' ? g.provider : ''),
    thumbnail: g.thumbnail ?? g.image ?? g.logo ?? null,
    rtp: g.rtp != null ? Number(g.rtp) : null,
    volatility: g.volatility ?? null,
    bonusBuy: Boolean(g.bonus_buy ?? g.bonusBuy),
    megaways: Boolean(g.megaways),
    progressive: Boolean(g.progressive),
  };
}

// ─── Volatility badge ────────────────────────────────────────────────────────
function VolatilityBadge({ value }) {
  if (!value) return null;
  const styles = {
    high: 'bg-red-500/20 border-red-500/30 text-red-300',
    medium: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-300',
    low: 'bg-blue-500/20 border-blue-500/30 text-blue-300',
  };
  const cls = styles[value?.toLowerCase()] ?? 'bg-white/10 border-white/20 text-white/60';
  return (
    <span className={`px-2 py-0.5 border rounded text-xs font-bold capitalize ${cls}`}>
      {value}
    </span>
  );
}

// ─── Slot image with fallback ─────────────────────────────────────────────────
function SlotImage({ src, alt, className }) {
  const [errored, setErrored] = useState(false);
  if (!src || errored) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-white/5 to-white/10 ${className}`}>
        <ImageOff size={24} className="text-white/20" />
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
  const [providers, setProviders] = useState([]);
  const [providersLoading, setProvidersLoading] = useState(true);

  useEffect(() => {
    setProvidersLoading(true);
    fetchSlots({ path: 'providers', per_page: 150 })
      .then(data => {
        const list = data?.data ?? data ?? [];
        setProviders(list.map(p => ({ name: p.name, slug: p.slug, thumbnail: p.thumbnail ?? p.logo ?? null })));
      })
      .catch(() => setProviders([]))
      .finally(() => setProvidersLoading(false));
  }, []);

  return (
    <div className="space-y-6">
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
        @keyframes result-appear {
          from { opacity: 0; transform: scale(0.96) translateY(12px); }
          to   { opacity: 1; transform: scale(1)   translateY(0);    }
        }
        .result-appear { animation: result-appear 0.4s ease-out forwards; }
        @keyframes confetti-fall {
          0%   { transform: translateY(-100vh) rotate(0deg);   opacity: 1; }
          100% { transform: translateY(100vh)  rotate(720deg); opacity: 0; }
        }
        .confetti-particle {
          position: absolute; width: 10px; height: 10px; top: -10px;
          animation: confetti-fall 3s ease-in forwards;
        }
      `}</style>

      {/* Tab toggle */}
      <div className="flex p-1 bg-white/5 border border-white/10 rounded-xl w-fit gap-1">
        {[
          { id: 'search', label: 'Slot Search', icon: <Search size={16} /> },
          { id: 'picker', label: 'Slot Picker', icon: <Dice6 size={16} /> },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all duration-200 ${
              activeTab === t.id
                ? 'bg-gradient-to-r from-emerald-500 to-purple-500 text-white shadow'
                : 'text-white/50 hover:text-white'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'search' && <SlotSearch providers={providers} providersLoading={providersLoading} />}
      {activeTab === 'picker' && <SlotRandomizer providers={providers} providersLoading={providersLoading} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SLOT SEARCH
// ═══════════════════════════════════════════════════════════════════════════
function SlotSearch({ providers, providersLoading }) {
  const [searchTerm, setSearchTerm]         = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterBonusBuy, setFilterBonusBuy]   = useState(false);
  const [filterMegaways, setFilterMegaways]   = useState(false);
  const [filterProgressive, setFilterProgressive] = useState(false);
  const [volatility, setVolatility]           = useState('all');
  const [selectedProviders, setSelectedProviders] = useState([]);
  const [providerDropdownOpen, setProviderDropdownOpen] = useState(false);
  const [page, setPage]         = useState(1);
  const [games, setGames]       = useState([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]       = useState(null);
  const debounceRef  = useRef(null);
  const dropdownRef  = useRef(null);
  const PER_PAGE = 24;

  // Debounce search input
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(e.target.value), 350);
  };

  // Reset to page 1 when filters change (not page itself)
  const filtersKey = `${debouncedSearch}|${filterBonusBuy}|${filterMegaways}|${filterProgressive}|${volatility}|${selectedProviders.join(',')}`;
  const prevFiltersKey = useRef(filtersKey);
  useEffect(() => {
    if (prevFiltersKey.current !== filtersKey) {
      prevFiltersKey.current = filtersKey;
      setPage(1);
      setGames([]);
    }
  }, [filtersKey]);

  // Fetch games
  useEffect(() => {
    let cancelled = false;
    const isFirstPage = page === 1;
    if (isFirstPage) setLoading(true); else setLoadingMore(true);
    setError(null);

    const params = new URLSearchParams({ path: 'games', per_page: PER_PAGE, page, published: 1 });
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (filterBonusBuy) params.set('bonus_buy', 1);
    if (filterMegaways) params.set('megaways', 1);
    if (filterProgressive) params.set('progressive', 1);
    if (volatility !== 'all') params.set('volatility', volatility);
    selectedProviders.forEach(slug => params.append('provider[]', slug));

    fetch(`/api/slots?${params}`)
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then(data => {
        if (cancelled) return;
        const raw = data?.data ?? (Array.isArray(data) ? data : []);
        const normalized = raw.map(normalizeGame);
        setGames(prev => isFirstPage ? normalized : [...prev, ...normalized]);
        setTotal(data?.total ?? data?.meta?.total ?? normalized.length);
      })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) { setLoading(false); setLoadingMore(false); } });

    return () => { cancelled = true; };
  }, [debouncedSearch, filterBonusBuy, filterMegaways, filterProgressive, volatility, selectedProviders, page]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close provider dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setProviderDropdownOpen(false); };
    if (providerDropdownOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [providerDropdownOpen]);

  const toggleProvider = (slug) => {
    setSelectedProviders(prev => prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]);
  };

  const activeFilters = [filterBonusBuy, filterMegaways, filterProgressive, volatility !== 'all', selectedProviders.length > 0].filter(Boolean).length;

  return (
    <div className="space-y-5">
      {/* Search bar + filter row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={18} />
          <input
            type="text"
            placeholder="Search slots..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:border-emerald-400 focus:outline-none text-sm"
          />
        </div>

        {/* Provider dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setProviderDropdownOpen(o => !o)}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-bold transition-all whitespace-nowrap ${
              selectedProviders.length > 0
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
            }`}
          >
            <Filter size={15} />
            {selectedProviders.length > 0 ? `${selectedProviders.length} providers` : 'All Providers'}
            <ChevronDown size={14} className={`transition-transform ${providerDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {providerDropdownOpen && (
            <div className="absolute top-full mt-2 left-0 z-50 w-64 max-h-72 overflow-y-auto bg-zinc-900 border border-white/10 rounded-xl shadow-2xl p-2">
              {selectedProviders.length > 0 && (
                <button
                  onClick={() => setSelectedProviders([])}
                  className="w-full text-left px-3 py-2 text-xs text-white/40 hover:text-white transition-colors mb-1"
                >
                  Clear selection
                </button>
              )}
              {providersLoading ? (
                <p className="text-xs text-white/40 px-3 py-4 text-center">Loading providers...</p>
              ) : (
                providers.map(p => (
                  <label key={p.slug} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedProviders.includes(p.slug)}
                      onChange={() => toggleProvider(p.slug)}
                      className="accent-emerald-400"
                    />
                    {p.thumbnail && (
                      <img src={p.thumbnail} alt={p.name} className="w-5 h-5 object-contain rounded" onError={e => e.target.style.display = 'none'} />
                    )}
                    <span className="text-sm text-white/80">{p.name}</span>
                  </label>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Feature + volatility filters */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: 'Bonus Buy', icon: <Zap size={12} />, active: filterBonusBuy, toggle: () => setFilterBonusBuy(v => !v) },
          { label: 'Megaways', icon: <Layers size={12} />, active: filterMegaways, toggle: () => setFilterMegaways(v => !v) },
          { label: 'Progressive', icon: <TrendingUp size={12} />, active: filterProgressive, toggle: () => setFilterProgressive(v => !v) },
        ].map(f => (
          <button
            key={f.label}
            onClick={f.toggle}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
              f.active
                ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
            }`}
          >
            {f.icon} {f.label}
          </button>
        ))}

        <div className="flex items-center gap-1 ml-auto">
          {['all', 'low', 'medium', 'high'].map(v => (
            <button
              key={v}
              onClick={() => setVolatility(v)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-bold capitalize transition-all ${
                volatility === v
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
              }`}
            >
              {v === 'all' ? 'All Vol.' : v}
            </button>
          ))}
        </div>
      </div>

      {/* Active filter count */}
      {activeFilters > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/40">{activeFilters} filter{activeFilters !== 1 ? 's' : ''} active</span>
          <button
            onClick={() => { setFilterBonusBuy(false); setFilterMegaways(false); setFilterProgressive(false); setVolatility('all'); setSelectedProviders([]); setDebouncedSearch(''); setSearchTerm(''); }}
            className="flex items-center gap-1 text-xs text-white/40 hover:text-white transition-colors"
          >
            <X size={12} /> Clear all
          </button>
        </div>
      )}

      {/* Results count */}
      {!loading && !error && (
        <p className="text-xs text-white/40">
          {games.length > 0 ? `Showing ${games.length} of ${total} slots` : ''}
        </p>
      )}

      {/* Error */}
      {error && (
        <div className="text-center py-12 text-red-400 text-sm">
          Failed to load slots: {error}
        </div>
      )}

      {/* Skeletons on first load */}
      {loading && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="rounded-xl overflow-hidden border border-white/5">
              <div className="skeleton-shimmer aspect-video" />
              <div className="p-3 space-y-2">
                <div className="skeleton-shimmer h-4 rounded w-3/4" />
                <div className="skeleton-shimmer h-3 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Game grid */}
      {!loading && games.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {games.map((game, idx) => (
            <div
              key={`${game.slug}-${idx}`}
              className="group bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-emerald-500/40 transition-all duration-200"
            >
              <div className="aspect-video overflow-hidden">
                <SlotImage
                  src={game.thumbnail}
                  alt={game.name}
                  className="w-full h-full group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-3 space-y-2">
                <p className="font-bold text-white text-sm leading-tight line-clamp-1">{game.name}</p>
                <p className="text-xs text-white/50">{game.providerName}</p>
                <div className="flex flex-wrap gap-1">
                  {game.rtp != null && (
                    <span className="px-1.5 py-0.5 bg-emerald-500/20 border border-emerald-500/30 rounded text-xs font-bold text-emerald-300">
                      {game.rtp}% RTP
                    </span>
                  )}
                  <VolatilityBadge value={game.volatility} />
                </div>
                <div className="flex flex-wrap gap-1">
                  {game.bonusBuy && <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-purple-500/20 border border-purple-500/30 rounded text-xs text-purple-300"><Zap size={10} />BB</span>}
                  {game.megaways && <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-500/20 border border-blue-500/30 rounded text-xs text-blue-300"><Layers size={10} />MW</span>}
                  {game.progressive && <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-yellow-500/20 border border-yellow-500/30 rounded text-xs text-yellow-300"><TrendingUp size={10} />PROG</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && games.length === 0 && (
        <div className="text-center py-20">
          <p className="text-white/50">No slots match your filters.</p>
          <p className="text-white/30 text-sm mt-1">Try adjusting your search or clearing filters.</p>
        </div>
      )}

      {/* Load more */}
      {!loading && !error && games.length < total && (
        <div className="flex justify-center pt-2">
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={loadingMore}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:border-emerald-400/40 font-bold text-sm transition-all disabled:opacity-50"
          >
            {loadingMore ? <RefreshCw size={16} className="animate-spin" /> : null}
            {loadingMore ? 'Loading…' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SLOT RANDOMIZER / PICKER
// ═══════════════════════════════════════════════════════════════════════════
function SlotRandomizer({ providers, providersLoading }) {
  const [gamePool, setGamePool]         = useState([]);
  const [poolLoading, setPoolLoading]   = useState(false);
  const [poolError, setPoolError]       = useState(null);
  const [poolProgress, setPoolProgress] = useState(0);
  const [excludedProviders, setExcludedProviders] = useState(new Set());
  const [filterBonusBuyOnly, setFilterBonusBuyOnly]   = useState(false);
  const [filterMegawaysOnly, setFilterMegawaysOnly]   = useState(false);
  const [isSpinning, setIsSpinning]     = useState(false);
  const [selectedGame, setSelectedGame] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const wheelRef   = useRef(null);
  const poolFetched = useRef(false);

  const ITEM_HEIGHT = 120; // px — matches h-[120px] on reel items
  const CYCLES      = 5;
  const SPIN_MS     = 4200;

  // Fetch entire game pool when this tab first mounts
  useEffect(() => {
    if (poolFetched.current) return;
    poolFetched.current = true;
    setPoolLoading(true);

    async function fetchAll() {
      const PER_PAGE = 150;
      let all = [];
      let page = 1;

      try {
        while (true) {
          const data = await fetchSlots({ path: 'games', per_page: PER_PAGE, page, published: 1 });
          const batch = (data?.data ?? (Array.isArray(data) ? data : [])).map(normalizeGame);
          all = [...all, ...batch];
          const totalCount = data?.total ?? data?.meta?.total ?? batch.length;
          setPoolProgress(Math.min(100, Math.round((all.length / totalCount) * 100)));
          if (all.length >= totalCount || batch.length < PER_PAGE) break;
          page++;
        }
        setGamePool(all);
      } catch (e) {
        setPoolError(e.message);
      } finally {
        setPoolLoading(false);
      }
    }

    fetchAll();
  }, []);

  // Filtered candidate pool
  const candidates = useMemo(() => {
    return gamePool.filter(g => {
      if (excludedProviders.has(g.providerSlug)) return false;
      if (filterBonusBuyOnly && !g.bonusBuy) return false;
      if (filterMegawaysOnly && !g.megaways) return false;
      return true;
    });
  }, [gamePool, excludedProviders, filterBonusBuyOnly, filterMegawaysOnly]);

  const toggleProvider = useCallback((slug) => {
    setExcludedProviders(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug); else next.add(slug);
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
    const finalOffset = (CYCLES * candidates.length + randomIndex) * ITEM_HEIGHT;

    if (wheelRef.current) {
      // Reset position first (critical — forces browser reflow before animating)
      wheelRef.current.style.transition = 'none';
      wheelRef.current.style.transform = 'translateY(0)';
      wheelRef.current.getBoundingClientRect(); // force reflow

      // Now animate with strong deceleration
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

  // Build extended reel items (candidates repeated CYCLES+1 times for smooth scroll)
  const reelItems = useMemo(() => {
    if (candidates.length === 0) return [];
    return Array.from({ length: CYCLES + 1 }, () => candidates).flat();
  }, [candidates]);

  return (
    <div className="space-y-6">
      {/* Loading pool */}
      {poolLoading && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <RefreshCw size={32} className="animate-spin text-emerald-400" />
          <p className="text-white/60 text-sm">Loading game library… {poolProgress}%</p>
          <div className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-purple-500 transition-all duration-300" style={{ width: `${poolProgress}%` }} />
          </div>
        </div>
      )}

      {poolError && (
        <p className="text-center text-red-400 text-sm py-8">Failed to load games: {poolError}</p>
      )}

      {!poolLoading && !poolError && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Reel + Spin */}
          <div className="lg:col-span-2 space-y-6">
            {/* Feature toggles */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilterBonusBuyOnly(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-bold transition-all ${
                  filterBonusBuyOnly
                    ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                    : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
                }`}
              >
                <Zap size={14} /> Bonus Buy Only
              </button>
              <button
                onClick={() => setFilterMegawaysOnly(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-bold transition-all ${
                  filterMegawaysOnly
                    ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                    : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
                }`}
              >
                <Layers size={14} /> Megaways Only
              </button>
              <span className="ml-auto text-xs text-white/30 self-center">
                {candidates.length} eligible slots
              </span>
            </div>

            {/* Reel */}
            <div className="relative rounded-2xl overflow-hidden border-2 border-white/10 bg-gradient-to-br from-zinc-900/60 to-purple-900/30" style={{ height: '360px' }}>
              {/* Fade top */}
              <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-zinc-950 to-transparent z-10 pointer-events-none" />
              {/* Selection window */}
              <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 z-10 pointer-events-none" style={{ height: `${ITEM_HEIGHT}px` }}>
                <div className="absolute inset-0 border-y-2 border-emerald-500/70 bg-emerald-500/5" />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-0 h-0 border-t-8 border-b-8 border-r-10 border-t-transparent border-b-transparent border-r-emerald-500/80" />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 w-0 h-0 border-t-8 border-b-8 border-l-10 border-t-transparent border-b-transparent border-l-emerald-500/80" />
              </div>
              {/* Fade bottom */}
              <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-zinc-950 to-transparent z-10 pointer-events-none" />

              {/* Reel track */}
              <div className="absolute inset-0 overflow-hidden">
                <div
                  ref={wheelRef}
                  style={{ transition: 'none', transform: 'translateY(0)', willChange: 'transform' }}
                >
                  {candidates.length === 0 ? (
                    <div className="flex items-center justify-center h-[360px] text-white/30 text-sm">
                      No slots match — adjust your filters
                    </div>
                  ) : (
                    reelItems.map((game, i) => (
                      <div
                        key={`${game.slug}-${i}`}
                        className="flex items-center gap-4 px-6 border-b border-white/5"
                        style={{ height: `${ITEM_HEIGHT}px` }}
                      >
                        <SlotImage
                          src={game.thumbnail}
                          alt={game.name}
                          className="w-16 h-16 rounded-lg flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="font-black text-white text-lg leading-tight truncate">{game.name}</p>
                          <p className="text-sm text-white/50">{game.providerName}</p>
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {game.rtp != null && <span className="text-xs text-emerald-400 font-bold">{game.rtp}% RTP</span>}
                            {game.bonusBuy && <span className="text-xs text-purple-400 font-bold ml-1">· BB</span>}
                            {game.megaways && <span className="text-xs text-blue-400 font-bold ml-1">· MW</span>}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Spin / Reset buttons */}
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={spinWheel}
                disabled={isSpinning || candidates.length === 0}
                className={`group relative px-14 py-5 rounded-2xl font-black text-xl tracking-widest transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isSpinning
                    ? 'bg-gradient-to-r from-gray-600 to-gray-700 text-white/60'
                    : 'bg-gradient-to-r from-emerald-500 to-purple-500 hover:from-emerald-400 hover:to-purple-400 text-white shadow-lg hover:shadow-emerald-500/30 hover:shadow-2xl hover:scale-105'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Play size={24} className={isSpinning ? 'animate-pulse' : ''} />
                  {isSpinning ? 'SPINNING…' : 'SPIN'}
                </span>
              </button>

              {selectedGame && !isSpinning && (
                <button
                  onClick={() => { resetWheel(); spinWheel(); }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/50 hover:text-white hover:border-emerald-400/40 text-sm font-bold transition-all"
                >
                  <RotateCcw size={15} /> Spin Again
                </button>
              )}
            </div>

            {/* Result card */}
            {selectedGame && !isSpinning && (
              <div className="result-appear p-6 rounded-2xl bg-gradient-to-r from-emerald-500/20 to-purple-500/20 border-2 border-emerald-500/50">
                <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-3">🎰 Selected Slot</p>
                <div className="flex gap-5 items-start">
                  <SlotImage
                    src={selectedGame.thumbnail}
                    alt={selectedGame.name}
                    className="w-24 h-24 rounded-xl flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-3xl font-black text-white leading-tight">{selectedGame.name}</h3>
                    <p className="text-white/60 font-bold mt-1">{selectedGame.providerName}</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {selectedGame.rtp != null && (
                        <div className="px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-center">
                          <p className="text-xs text-white/50">RTP</p>
                          <p className="font-bold text-emerald-300">{selectedGame.rtp}%</p>
                        </div>
                      )}
                      {selectedGame.volatility && (
                        <div className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-center">
                          <p className="text-xs text-white/50">Volatility</p>
                          <p className="font-bold text-white capitalize">{selectedGame.volatility}</p>
                        </div>
                      )}
                      {selectedGame.bonusBuy && (
                        <div className="px-3 py-1.5 bg-purple-500/20 border border-purple-500/30 rounded-lg text-center">
                          <Zap size={14} className="text-purple-300 mx-auto" />
                          <p className="text-xs text-purple-300 font-bold">Bonus Buy</p>
                        </div>
                      )}
                      {selectedGame.megaways && (
                        <div className="px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 rounded-lg text-center">
                          <Layers size={14} className="text-blue-300 mx-auto" />
                          <p className="text-xs text-blue-300 font-bold">Megaways</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: Provider exclusion list */}
          <div className="space-y-3">
            <div>
              <p className="text-sm font-bold text-white/60 mb-1">Exclude Providers</p>
              <p className="text-xs text-white/30">Unchecked providers are excluded from the spin.</p>
            </div>

            {excludedProviders.size > 0 && (
              <button
                onClick={() => setExcludedProviders(new Set())}
                className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                Re-include all
              </button>
            )}

            <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1">
              {providersLoading ? (
                <p className="text-xs text-white/30 py-4">Loading providers…</p>
              ) : providers.length === 0 ? (
                <p className="text-xs text-white/30 py-4">No providers found</p>
              ) : (
                providers.map(p => (
                  <label key={p.slug} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 cursor-pointer transition-all">
                    <input
                      type="checkbox"
                      checked={!excludedProviders.has(p.slug)}
                      onChange={() => toggleProvider(p.slug)}
                      className="accent-emerald-400"
                    />
                    {p.thumbnail && (
                      <img src={p.thumbnail} alt={p.name} className="w-5 h-5 object-contain" onError={e => e.target.style.display = 'none'} />
                    )}
                    <span className={`text-sm flex-1 ${excludedProviders.has(p.slug) ? 'text-white/25 line-through' : 'text-white/80'}`}>
                      {p.name}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confetti */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50">
          {Array.from({ length: 60 }).map((_, i) => (
            <div
              key={i}
              className="confetti-particle"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 0.6}s`,
                borderRadius: Math.random() > 0.5 ? '50%' : '0',
                backgroundColor: ['#10b981','#a855f7','#eab308','#f97316','#ec4899','#3b82f6'][Math.floor(Math.random() * 6)],
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
