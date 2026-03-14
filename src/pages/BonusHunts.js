import { useState, useEffect } from 'react';
import { Target, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, RefreshCcw } from 'lucide-react';

async function fetchHunts() {
  const res = await fetch('/api/bonus-hunts?path=hunts');
  if (!res.ok) throw new Error(`Failed to fetch hunts: ${res.status}`);
  return res.json();
}


function formatCurrency(val) {
  if (val == null) return '—';
  return `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function ProfitBadge({ profit }) {
  if (profit == null) return null;
  if (profit > 0) return (
    <span className="flex items-center gap-1 text-emerald-400 font-bold text-sm">
      <TrendingUp size={14} /> +{formatCurrency(profit)}
    </span>
  );
  if (profit < 0) return (
    <span className="flex items-center gap-1 text-red-400 font-bold text-sm">
      <TrendingDown size={14} /> {formatCurrency(profit)}
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-white/50 font-bold text-sm">
      <Minus size={14} /> {formatCurrency(profit)}
    </span>
  );
}

function MultiplierBar({ value, max }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const color = value >= 100 ? 'from-emerald-500 to-emerald-400' : value >= 50 ? 'from-yellow-500 to-yellow-400' : 'from-red-500 to-red-400';
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${color} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-white/60 w-12 text-right">{value?.toFixed(0)}x</span>
    </div>
  );
}

function HuntCard({ hunt }) {
  const [expanded, setExpanded] = useState(false);

  const totalCost = hunt.startCost ?? null;
  const totalPayout = hunt.stats?.totalWinnings ?? null;
  const profit = hunt.stats?.profitLoss ?? null;
  const bonusCount = hunt.stats?.bonusCount ?? hunt.bonuses?.length ?? '—';
  const isOpening = hunt.isOpening ?? false;

  const bonuses = hunt.bonuses ?? [];
  const maxMultiplier = bonuses.length > 0 ? Math.max(...bonuses.map((b) => b.multiplier ?? 0)) : 1;

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-emerald-500/30 transition-all duration-200">
      {/* Card Header */}
      <div className="p-5 cursor-pointer select-none" onClick={() => setExpanded((prev) => !prev)}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Target size={15} className="text-emerald-400 flex-shrink-0" />
              <h3 className="font-black text-white text-lg leading-tight truncate">
                {hunt.title ?? `Hunt #${hunt.id}`}
              </h3>
              {isOpening && (
                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex-shrink-0">
                  LIVE
                </span>
              )}
            </div>
            <p className="text-sm text-white/40">{hunt.casino} · {formatDate(hunt.createdAt)}</p>
          </div>

          <div className="flex items-center gap-6 flex-shrink-0">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-white/40 mb-0.5">Cost</p>
              <p className="font-bold text-white text-sm">{formatCurrency(totalCost)}</p>
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-xs text-white/40 mb-0.5">Payout</p>
              <p className="font-bold text-white text-sm">{formatCurrency(totalPayout)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/40 mb-0.5">Result</p>
              <ProfitBadge profit={profit} />
            </div>
            <div className="text-right hidden md:block">
              <p className="text-xs text-white/40 mb-0.5">Bonuses</p>
              <p className="font-bold text-white/70 text-sm">{bonusCount}</p>
            </div>
            <div className="text-white/30 flex-shrink-0">
              {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>
          </div>
        </div>

        {/* Mobile cost/payout row */}
        <div className="sm:hidden flex gap-4 mt-3 pt-3 border-t border-white/5">
          <div>
            <p className="text-xs text-white/40">Cost</p>
            <p className="font-bold text-white text-sm">{formatCurrency(totalCost)}</p>
          </div>
          <div>
            <p className="text-xs text-white/40">Payout</p>
            <p className="font-bold text-white text-sm">{formatCurrency(totalPayout)}</p>
          </div>
          <div>
            <p className="text-xs text-white/40">Bonuses</p>
            <p className="font-bold text-white/70 text-sm">{bonusCount}</p>
          </div>
        </div>
      </div>

      {/* Expanded Detail */}
      {expanded && bonuses.length > 0 && (
        <div className="border-t border-white/10 px-5 pb-5">
          <div className="mt-4 space-y-2">
            <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">
              Bonus Results ({bonuses.length})
            </p>
            {bonuses.map((bonus, i) => (
              <div key={bonus.id ?? i} className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                {bonus.slotImage && (
                  <img
                    src={bonus.slotImage}
                    alt={bonus.slotName}
                    className="w-10 h-10 rounded object-cover flex-shrink-0 bg-white/10"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-sm truncate">{bonus.slotName ?? `Bonus ${i + 1}`}</p>
                  <p className="text-xs text-white/40">{bonus.provider} · Bet: {formatCurrency(bonus.betSize)}</p>
                </div>
                <div className="w-36 hidden sm:block">
                  <MultiplierBar value={bonus.multiplier ?? 0} max={maxMultiplier} />
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-sm text-white">{formatCurrency(bonus.payout)}</p>
                  <p className="text-xs text-white/40">{(bonus.multiplier ?? 0).toFixed(1)}x</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function BonusHuntsPage() {
  const [hunts, setHunts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchHunts();
      // Handle both array response and { hunts: [...] } envelope
      const list = Array.isArray(data) ? data : (data.hunts ?? data.data ?? []);
      // Sort newest first
      list.sort((a, b) => new Date(b.created_at ?? b.date ?? 0) - new Date(a.created_at ?? a.date ?? 0));
      setHunts(list);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="pt-32 pb-24 px-6">
      <div className="max-w-4xl mx-auto space-y-10">
        {/* Header */}
        <header className="text-center space-y-4">
          <h1 className="text-6xl md:text-7xl font-black tracking-tighter">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-purple-400">
              BONUS HUNTS
            </span>
          </h1>
          <p className="text-lg text-white/60 max-w-xl mx-auto">
            All past bonus hunts — click any hunt to see the full breakdown.
          </p>
        </header>

        {/* Hunt List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-white/40">
            <RefreshCcw size={28} className="animate-spin" />
            <p className="text-sm">Loading hunts…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <p className="text-red-400 font-bold">Failed to load hunts</p>
            <p className="text-white/40 text-sm">{error}</p>
            <button
              onClick={load}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-bold text-sm hover:bg-emerald-500/30 transition-all"
            >
              <RefreshCcw size={14} />
              Retry
            </button>
          </div>
        ) : hunts.length === 0 ? (
          <p className="text-center text-white/40 py-24">No hunts found.</p>
        ) : (
          <div className="space-y-3">
            {hunts.map((hunt) => (
              <HuntCard key={hunt.id} hunt={hunt} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
