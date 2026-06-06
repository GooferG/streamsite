import { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  limit as fLimit,
} from 'firebase/firestore';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  RefreshCcw,
} from 'lucide-react';
import { db } from '../config/firebase';
import useTuningPhrase from '../hooks/useTuningPhrase';
import PredictionSlip from '../components/PredictionSlip';
import PredictionWall from '../components/PredictionWall';
import PredictionNumberLine from '../components/PredictionNumberLine';
import PredictionWinnersReveal from '../components/PredictionWinnersReveal';
import SuggestionSubmit from '../components/SuggestionSubmit';
import SuggestionList from '../components/SuggestionList';

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
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function ProfitBadge({ profit }) {
  if (profit == null) return null;
  if (profit > 0)
    return (
      <span className="inline-flex items-center gap-1 text-emerald-signal font-bold text-sm tabular-nums">
        <TrendingUp size={13} aria-hidden="true" /> +{formatCurrency(profit)}
      </span>
    );
  if (profit < 0)
    return (
      <span className="inline-flex items-center gap-1 text-red-destructive font-bold text-sm tabular-nums">
        <TrendingDown size={13} aria-hidden="true" /> {formatCurrency(profit)}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-white/70 font-bold text-sm tabular-nums">
      <Minus size={13} aria-hidden="true" /> {formatCurrency(profit)}
    </span>
  );
}

function MultiplierBar({ value, max }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  // Semantic data viz — keeps gradient fills for magnitude (intentional)
  const color =
    value >= 100
      ? 'from-emerald-signal to-emerald-bright'
      : value >= 50
        ? 'from-yellow-500 to-yellow-400'
        : 'from-red-destructive to-red-destructive/70';
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1 bg-white/10 overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${color} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className="text-[0.625rem] text-white/75 w-10 text-right tabular-nums tracking-eyebrow-sm font-mono"
      >
        {value?.toFixed(0)}x
      </span>
    </div>
  );
}

function HuntCard({ hunt, index }) {
  const [expanded, setExpanded] = useState(false);

  const totalCost = hunt.startCost ?? null;
  const totalPayout = hunt.stats?.totalWinnings ?? null;
  const profit = hunt.stats?.profitLoss ?? null;
  const bonusCount = hunt.stats?.bonusCount ?? hunt.bonuses?.length ?? '—';
  const isOpening = hunt.isOpening ?? false;
  const tape = String(index + 1).padStart(3, '0');

  const bonuses = hunt.bonuses ?? [];
  const maxMultiplier =
    bonuses.length > 0 ? Math.max(...bonuses.map((b) => b.multiplier ?? 0)) : 1;

  return (
    <div
      className={`border bg-zinc-card/40 transition-colors duration-200 ${
        expanded
          ? 'border-emerald-signal/30'
          : 'border-white/8 hover:border-emerald-signal/25'
      }`}
    >
      {/* Card header — clickable */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full text-left px-4 sm:px-5 py-4"
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <span
              className="mt-1 text-[0.625rem] font-bold tracking-eyebrow-md tabular-nums text-emerald-signal/80 font-mono"
      >
              #{tape}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-white-body text-base sm:text-lg leading-tight tracking-tight truncate">
                  {hunt.title ?? `Hunt #${hunt.id}`}
                </h3>
                {isOpening && (
                  <span
                    className="inline-flex items-center gap-1.5 px-1.5 py-0.5 text-[0.5625rem] font-bold tracking-eyebrow-md text-emerald-signal border border-emerald-signal/40 font-mono"
      >
                    <span className="relative flex w-1.5 h-1.5">
                      <span className="absolute inset-0 rounded-full bg-emerald-signal motion-safe:animate-ping opacity-50" />
                      <span className="relative w-1.5 h-1.5 rounded-full bg-emerald-signal" />
                    </span>
                    LIVE
                  </span>
                )}
              </div>
              <p
                className="mt-1 text-[0.6875rem] tracking-eyebrow-sm uppercase text-white/65 truncate font-mono"
      >
                {hunt.casino} · {formatDate(hunt.createdAt)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 flex-shrink-0">
            <div className="text-right hidden sm:block">
              <p
                className="text-[0.625rem] font-bold tracking-eyebrow-md uppercase text-white/65 mb-0.5 font-mono"
      >
                Cost
              </p>
              <p className="font-bold text-white-body text-sm tabular-nums">
                {formatCurrency(totalCost)}
              </p>
            </div>
            <div className="text-right hidden sm:block">
              <p
                className="text-[0.625rem] font-bold tracking-eyebrow-md uppercase text-white/65 mb-0.5 font-mono"
      >
                Payout
              </p>
              <p className="font-bold text-white-body text-sm tabular-nums">
                {formatCurrency(totalPayout)}
              </p>
            </div>
            <div className="text-right">
              <p
                className="text-[0.625rem] font-bold tracking-eyebrow-md uppercase text-white/65 mb-0.5 font-mono"
      >
                Result
              </p>
              <ProfitBadge profit={profit} />
            </div>
            <div className="text-right hidden md:block">
              <p
                className="text-[0.625rem] font-bold tracking-eyebrow-md uppercase text-white/65 mb-0.5 font-mono"
      >
                Bonuses
              </p>
              <p className="font-bold text-white/70 text-sm tabular-nums">
                {bonusCount}
              </p>
            </div>
            <div className="text-white/60 flex-shrink-0">
              {expanded ? (
                <ChevronUp size={16} aria-hidden="true" />
              ) : (
                <ChevronDown size={16} aria-hidden="true" />
              )}
            </div>
          </div>
        </div>

        {/* Mobile cost/payout row */}
        <div className="sm:hidden grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-white/8">
          <div>
            <p
              className="text-[0.625rem] font-bold tracking-eyebrow-md uppercase text-white/65 font-mono"
      >
              Cost
            </p>
            <p className="font-bold text-white-body text-sm tabular-nums">
              {formatCurrency(totalCost)}
            </p>
          </div>
          <div>
            <p
              className="text-[0.625rem] font-bold tracking-eyebrow-md uppercase text-white/65 font-mono"
      >
              Payout
            </p>
            <p className="font-bold text-white-body text-sm tabular-nums">
              {formatCurrency(totalPayout)}
            </p>
          </div>
          <div>
            <p
              className="text-[0.625rem] font-bold tracking-eyebrow-md uppercase text-white/65 font-mono"
      >
              Bonuses
            </p>
            <p className="font-bold text-white/70 text-sm tabular-nums">
              {bonusCount}
            </p>
          </div>
        </div>
      </button>

      {/* Expanded — bonus detail */}
      {expanded && bonuses.length > 0 && (
        <div className="border-t border-white/8 px-4 sm:px-5 pb-5 pt-4">
          <p
            className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/65 mb-3 font-mono"
      >
            Bonus reel · {bonuses.length}
          </p>
          <div className="space-y-1.5">
            {bonuses.map((bonus, i) => (
              <div
                key={bonus.id ?? i}
                className="flex items-center gap-3 px-3 py-2.5 bg-zinc-broadcast/40 border border-white/5"
              >
                {bonus.slotImage && (
                  <img
                    src={bonus.slotImage}
                    alt=""
                    className="w-9 h-9 object-cover flex-shrink-0 bg-white/5 border border-white/10"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white-body text-sm truncate leading-tight">
                    {bonus.slotName ?? `Bonus ${i + 1}`}
                  </p>
                  <p
                    className="text-[0.625rem] tracking-eyebrow-sm uppercase text-white/65 truncate mt-0.5 font-mono"
      >
                    {bonus.provider} · Bet {formatCurrency(bonus.betSize)}
                  </p>
                </div>
                <div className="w-32 hidden sm:block">
                  <MultiplierBar value={bonus.multiplier ?? 0} max={maxMultiplier} />
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-sm text-white-body tabular-nums">
                    {formatCurrency(bonus.payout)}
                  </p>
                  <p
                    className="text-[0.625rem] tracking-eyebrow-sm text-white/65 tabular-nums font-mono"
      >
                    {(bonus.multiplier ?? 0).toFixed(1)}x
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PredictionModeBanner({ round }) {
  if (!round) return null;
  const tone =
    round.status === 'open'
      ? 'text-emerald-signal border-emerald-signal/40'
      : round.status === 'locked'
        ? 'text-orange-admin border-orange-admin/50'
        : 'text-white-body border-white/30';

  const features = [
    round.acceptPredictions && 'PREDICT',
    round.acceptSuggestions && 'SUGGEST',
  ].filter(Boolean).join(' + ') || 'HUNT';
  const statusLabel =
    round.status === 'open' ? 'OPEN'
      : round.status === 'locked' ? 'LOCKED'
      : 'SETTLED';
  const label = `${features} · ${statusLabel}`;

  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 border ${tone} bg-zinc-card/30 text-[0.625rem] font-bold uppercase tracking-eyebrow-md font-mono`}>
      <span className="inline-flex items-center gap-2">
        <span className="relative flex w-1.5 h-1.5">
          {round.status === 'open' && (
            <span className="absolute inset-0 rounded-full bg-emerald-signal motion-safe:animate-ping opacity-50" />
          )}
          <span
            className={`relative w-1.5 h-1.5 rounded-full ${
              round.status === 'open'
                ? 'bg-emerald-signal'
                : round.status === 'locked'
                  ? 'bg-orange-admin'
                  : 'bg-white-body'
            }`}
          />
        </span>
        <span>{label}</span>
      </span>
      <span className="text-white/15">·</span>
      <span className="text-white/55 truncate max-w-[40ch]">{round.title}</span>
      <span className="ml-auto text-white/40 tabular-nums flex flex-wrap items-center gap-x-3 gap-y-1">
        {round.acceptPredictions && (
          <span>{String(round.entryCount ?? 0).padStart(4, '0')} ENTRIES</span>
        )}
        {round.acceptSuggestions && (
          <span>{String(round.suggestionCount ?? 0).padStart(3, '0')} SUGG.</span>
        )}
      </span>
    </div>
  );
}

function usePredictionRound() {
  const [round, setRound] = useState(null);
  useEffect(() => {
    // Most recent non-deleted round. Show settled rounds too (last result lingers).
    const q = query(
      collection(db, 'hunts'),
      orderBy('createdAt', 'desc'),
      fLimit(1)
    );
    const unsub = onSnapshot(q, (snap) => {
      if (snap.empty) {
        setRound(null);
      } else {
        const d = snap.docs[0];
        setRound({ id: d.id, ...d.data() });
      }
    });
    return unsub;
  }, []);
  return round;
}

export default function BonusHuntsPage() {
  const [hunts, setHunts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const round = usePredictionRound();
  const tuningPhrase = useTuningPhrase(loading);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchHunts();
      const list = Array.isArray(data) ? data : data.hunts ?? data.data ?? [];
      list.sort(
        (a, b) =>
          new Date(b.created_at ?? b.date ?? 0) -
          new Date(a.created_at ?? a.date ?? 0)
      );
      setHunts(list);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Determine which mode we're in for prediction layout. The live hunt widget
  // is shown in all modes, but its prominence shifts based on round status.
  const mode =
    !round
      ? 'no_round'
      : round.status === 'open'
        ? 'predicting'
        : round.status === 'locked'
          ? 'opening'
          : 'settled';

  return (
    <div className="space-y-6">
      {round && <PredictionModeBanner round={round} />}

      {/* PREDICTING mode — slip + wall hero (only if predictions enabled) */}
      {mode === 'predicting' && round?.acceptPredictions && (
        <>
          <PredictionSlip round={round} />
          <PredictionNumberLine round={round} />
          <PredictionWall round={round} />
        </>
      )}

      {/* OPENING mode (predictions locked, hunt is being opened) */}
      {mode === 'opening' && round?.acceptPredictions && (
        <>
          <PredictionSlip round={round} />
          <PredictionWall round={round} />
        </>
      )}

      {/* SETTLED mode — winners hero */}
      {mode === 'settled' && round?.acceptPredictions && (
        <>
          <PredictionWinnersReveal round={round} />
          <PredictionNumberLine round={round} />
          <PredictionWall round={round} />
          <PredictionSlip round={round} />
        </>
      )}

      {/* Suggestion sections — render whenever the hunt accepts suggestions */}
      {round?.acceptSuggestions && (
        <>
          <SuggestionSubmit hunt={round} />
          <SuggestionList huntId={round.id} adminMode={false} />
        </>
      )}

      {/* Active hunt iframe — kept as-is */}
      <div className="border border-white/8 overflow-hidden">
        <div
          className="flex items-center gap-3 px-4 py-2.5 border-b border-white/8 text-[0.625rem] font-bold uppercase tracking-eyebrow-md bg-zinc-broadcast/40 font-mono"
      >
          <span className="inline-flex items-center gap-2 text-emerald-signal">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-signal" />
            <span>LIVE WIDGET</span>
          </span>
          <span className="text-white/15">·</span>
          <span className="text-white/65">Bonushunt.gg</span>
        </div>
        <iframe
          src="https://bonushunt.gg/widget/1?userId=cmjxkol6401c3jcm59l6fssds"
          title="Active Bonus Hunt"
          className="w-full bg-zinc-broadcast"
          style={{ height: '500px', border: 'none' }}
          loading="lazy"
        />
      </div>

      {/* Archive */}
      <div className="border border-white/8 bg-zinc-card/30">
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 border-b border-white/8 text-[0.625rem] font-bold uppercase tracking-eyebrow-md font-mono"
      >
          <span className="inline-flex items-center gap-2 text-emerald-signal">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-signal" />
            <span>HUNT ARCHIVE</span>
          </span>
          <span className="text-white/15">·</span>
          <span className="text-white/65">REELS</span>
          <span className="text-white/70 tabular-nums tracking-eyebrow-lg">
            {String(hunts.length).padStart(3, '0')}
          </span>
          <button
            type="button"
            onClick={load}
            className="ml-auto inline-flex items-center gap-2 px-3 py-1.5 border border-white/10 text-white/75 hover:text-white-body hover:border-white/30 transition-colors duration-150"
          >
            <RefreshCcw
              size={11}
              aria-hidden="true"
              className={loading ? 'animate-spin' : ''}
            />
            <span className="text-[0.625rem] font-bold tracking-eyebrow-lg">
              Refresh
            </span>
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div className="py-16 flex flex-col items-center gap-3 text-white/65">
            <RefreshCcw size={20} className="animate-spin" aria-hidden="true" />
            <p
              className="text-[0.6875rem] font-bold tracking-eyebrow-lg uppercase font-mono"
      >
              {tuningPhrase}
            </p>
          </div>
        ) : error ? (
          <div className="py-16 px-4 flex flex-col items-center gap-3 text-center">
            <p
              className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-red-destructive/80 font-mono"
      >
              Signal lost
            </p>
            <p className="text-sm text-white/75">{error}</p>
            <button
              type="button"
              onClick={load}
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
        ) : hunts.length === 0 ? (
          <div className="text-center py-16 font-mono space-y-1">
            <p className="text-[0.6875rem] font-bold tracking-eyebrow-lg uppercase text-white/65">
              No hunts on file.
            </p>
            <p className="text-[0.6875rem] tracking-eyebrow-lg uppercase text-white/35">
              The reels are quiet.
            </p>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {hunts.map((hunt, i) => (
              <HuntCard key={hunt.id} hunt={hunt} index={i} />
            ))}
          </div>
        )}

        <div
          className="px-4 py-3 border-t border-white/8 text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/60 text-center font-mono"
      >
          Tracker by{' '}
          <a
            href="https://bonushunt.gg"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/75 hover:text-emerald-signal transition-colors"
          >
            bonushunt.gg
          </a>
        </div>
      </div>
    </div>
  );
}
