import { useEffect, useState } from 'react';
import {
  TrendingUp,
  Trophy,
  Users,
  Layers,
  ChevronDown,
  ChevronRight,
  Star,
} from 'lucide-react';
import { authedFetch } from '../utils/authedFetch';
import { fmt, fmtX, computeStats, computeCallerStats } from '../utils/huntCalc';

function formatDate(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

function StatTile({ icon: Icon, label, value, hint }) {
  return (
    <div className="border border-white/10 bg-zinc-card/40 p-3">
      <div className="flex items-center gap-1.5 text-[9px] font-bold tracking-eyebrow-lg uppercase text-white/45 font-mono">
        {Icon && <Icon size={11} aria-hidden="true" />}
        <span>{label}</span>
      </div>
      <div className="mt-1 text-lg font-bold text-white-body tabular-nums">{value}</div>
      {hint && <div className="text-[10px] text-white/40 font-mono truncate">{hint}</div>}
    </div>
  );
}

function HuntDetail({ hunt }) {
  const s = computeStats(hunt);
  const callerStats = computeCallerStats(hunt.bonuses ?? []);
  const finish = s.finish;
  const totalBuyIns = s.totalBuyIns;

  return (
    <div className="px-3 pb-3 space-y-3 bg-zinc-broadcast/20">
      {/* Bonuses */}
      {(hunt.bonuses?.length ?? 0) > 0 ? (
        <div className="border border-white/8 overflow-x-auto [scrollbar-width:thin]">
          <table className="w-full text-sm min-w-[360px]">
            <thead>
              <tr className="border-b border-white/10 text-white/65 text-[10px] uppercase tracking-eyebrow-md bg-zinc-broadcast/50 font-mono">
                <th className="text-left px-3 py-2 font-bold">Slot</th>
                <th className="text-right px-3 py-2 font-bold">Stake</th>
                <th className="text-right px-3 py-2 font-bold">Win</th>
                <th className="text-right px-3 py-2 font-bold">X</th>
              </tr>
            </thead>
            <tbody>
              {hunt.bonuses.map((b) => {
                const x = b.stake > 0 ? b.win / b.stake : null;
                return (
                  <tr key={b.id} className="border-b border-white/5">
                    <td className="px-3 py-2 font-bold text-white-body max-w-[180px]">
                      <span className="flex items-center gap-1.5 min-w-0">
                        {b.super && (
                          <span className="shrink-0 px-1 py-0.5 text-[8px] font-bold tracking-eyebrow-md uppercase font-mono border border-orange-admin/60 text-orange-admin leading-none">S</span>
                        )}
                        {b.fiveScat && (
                          <Star size={11} aria-label="5 scatter" className="shrink-0 fill-yellow-400 text-yellow-400" />
                        )}
                        <span className="truncate">{b.slot}</span>
                      </span>
                      {b.caller && (
                        <span className="block text-[10px] font-mono tracking-eyebrow-md uppercase text-purple-bright truncate mt-0.5">
                          📣 {b.caller}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-white/70 tabular-nums">{fmt(b.stake)}</td>
                    <td className="px-3 py-2 text-right text-white/70 tabular-nums">{fmt(b.win)}</td>
                    <td className="px-3 py-2 text-right font-bold text-white/70 tabular-nums">
                      {x != null ? fmtX(x) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-center text-white/40 py-3 text-[11px] font-bold tracking-eyebrow-lg uppercase font-mono">
          No bonuses logged.
        </p>
      )}

      {/* Squad split */}
      {(hunt.gamblers?.length ?? 0) > 0 && (
        <div className="border border-white/8 overflow-x-auto [scrollbar-width:thin]">
          <table className="w-full text-sm min-w-[360px]">
            <thead>
              <tr className="border-b border-white/10 text-white/65 text-[10px] uppercase tracking-eyebrow-md bg-zinc-broadcast/50 font-mono">
                <th className="text-left px-3 py-2 font-bold">Name</th>
                <th className="text-right px-3 py-2 font-bold">In for</th>
                <th className="text-right px-3 py-2 font-bold">%</th>
                <th className="text-right px-3 py-2 font-bold">Payout</th>
              </tr>
            </thead>
            <tbody>
              {hunt.gamblers.map((g) => {
                const pct = totalBuyIns > 0 ? (g.inFor / totalBuyIns) * 100 : 0;
                const payout = finish != null && totalBuyIns > 0 ? (pct / 100) * finish : null;
                return (
                  <tr key={g.id} className="border-b border-white/5">
                    <td className="px-3 py-2 font-bold text-white-body">{g.name}</td>
                    <td className="px-3 py-2 text-right text-white/70 tabular-nums">{fmt(g.inFor)}</td>
                    <td className="px-3 py-2 text-right text-purple-bright font-bold tabular-nums">{pct.toFixed(2)}%</td>
                    <td className="px-3 py-2 text-right font-bold text-white/70 tabular-nums">
                      {payout != null ? fmt(payout) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Slot calls */}
      {callerStats.leaderboard.length > 0 && (
        <div className="border border-white/8 bg-zinc-broadcast/30 px-3 py-2.5 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-eyebrow-lg text-purple-bright font-mono">
            Slot calls
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {callerStats.leaderboard.map((row) => (
              <span key={row.caller} className="text-[11px] font-mono text-white/70">
                <span className="font-bold text-white-body">{row.caller}</span>
                <span className="text-purple-bright tabular-nums"> {row.calls}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HuntRow({ hunt }) {
  const [open, setOpen] = useState(false);
  const s = computeStats(hunt);
  const ownerName = hunt.owner?.displayName || hunt.owner?.twitchName || hunt.ownerTwitchId;

  return (
    <div className="border-t border-white/8 first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full grid grid-cols-[auto_1fr_auto_auto] gap-3 items-center px-3 py-2.5 text-left hover:bg-white/5 transition-colors"
      >
        <span className="text-white/40">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <div className="min-w-0">
          <p className="font-bold text-white-body text-sm truncate">{hunt.name}</p>
          <p className="text-[10px] font-bold tracking-eyebrow-md uppercase text-white/40 font-mono mt-0.5 tabular-nums">
            {ownerName} · {formatDate(hunt.completedAt)} · {s.bonusCount} bonuses
          </p>
        </div>
        <span
          className={`text-sm font-bold tabular-nums ${
            s.profit == null
              ? 'text-white/40'
              : s.profit >= 0
                ? 'text-emerald-signal'
                : 'text-red-destructive'
          }`}
        >
          {s.profit == null ? '—' : (s.profit >= 0 ? '+' : '') + fmt(s.profit)}
        </span>
        <span className="text-[10px] font-mono text-white/35 tabular-nums">
          best {s.bestX != null ? fmtX(s.bestX) : '—'}
        </span>
      </button>
      {open && <HuntDetail hunt={hunt} />}
    </div>
  );
}

export default function AdminCommunityHuntsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authedFetch('/api/admin/community-hunts', { method: 'GET' });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) setError(json.error || 'Failed to load');
        else setData(json);
      } catch (e) {
        if (!cancelled) setError('Network error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = data?.stats;
  const hunts = data?.hunts ?? [];

  return (
    <div className="p-6 sm:p-8 max-w-4xl mx-auto">
      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[10px] font-bold uppercase tracking-eyebrow-lg text-white/45 mb-5 font-mono">
          <span className="inline-flex items-center gap-2 text-orange-admin">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-admin" />
            <span>COMMUNITY HUNTS</span>
          </span>
          <span className="text-white/20">·</span>
          <span>MODULE</span>
          <span className="text-white/70 tracking-eyebrow-lg">CHT</span>
        </div>
        <h1
          className="font-black leading-[0.85] tracking-[-0.035em] text-white-body"
          style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif', fontSize: 'clamp(2.25rem, 6vw, 3.25rem)' }}
        >
          <span className="block">Community</span>
          <span className="block text-orange-admin">hunts.</span>
        </h1>
      </header>

      {loading && (
        <div className="border border-white/8 bg-zinc-card/30 py-16 text-center">
          <p className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/40 font-mono">
            Loading…
          </p>
        </div>
      )}

      {error && !loading && (
        <div className="border border-red-destructive/30 bg-red-destructive/5 py-6 px-4 text-center">
          <p className="text-[11px] font-bold tracking-eyebrow uppercase text-red-destructive font-mono">
            {error}
          </p>
        </div>
      )}

      {!loading && !error && stats && (
        <>
          {/* Aggregate stat tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatTile icon={Layers} label="Hunts" value={stats.totalHunts} />
            <StatTile icon={Users} label="Players" value={stats.uniquePlayers} />
            <StatTile
              icon={TrendingUp}
              label="Biggest win"
              value={stats.biggestWin ? fmt(stats.biggestWin.amount) : '—'}
              hint={stats.biggestWin ? `${stats.biggestWin.slot} · ${stats.biggestWin.owner}` : null}
            />
            <StatTile
              icon={Trophy}
              label="Best call"
              value={stats.bestCallX ? fmtX(stats.bestCallX.x) : '—'}
              hint={
                stats.bestCallX
                  ? `${stats.bestCallX.slot}${stats.bestCallX.caller ? ` · ${stats.bestCallX.caller}` : ''}`
                  : null
              }
            />
          </div>

          {/* Top hunts by profit */}
          {stats.topHuntsByProfit.length > 0 && (
            <div className="border border-white/10 bg-zinc-card/30 mb-6">
              <header className="px-4 py-2.5 border-b border-white/10 flex items-center gap-2">
                <Trophy size={13} className="text-emerald-signal" aria-hidden="true" />
                <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-white-body font-mono">
                  Top hunts by profit
                </span>
              </header>
              <div>
                {stats.topHuntsByProfit.map((h, i) => (
                  <div
                    key={`${h.huntName}-${i}`}
                    className="flex items-center gap-3 px-4 py-2 border-t border-white/5 first:border-t-0"
                  >
                    <span className="text-[10px] font-bold tabular-nums text-white/30 font-mono w-5">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="flex-1 min-w-0 truncate text-sm font-bold text-white-body">
                      {h.huntName}
                    </span>
                    <span className="text-[11px] font-mono text-white/45 truncate max-w-[120px]">{h.owner}</span>
                    <span
                      className={`text-sm font-bold tabular-nums ${
                        h.profit >= 0 ? 'text-emerald-signal' : 'text-red-destructive'
                      }`}
                    >
                      {(h.profit >= 0 ? '+' : '') + fmt(h.profit)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent hunts */}
          <div className="border border-white/10 bg-zinc-card/30">
            <header className="px-4 py-2.5 border-b border-white/10 flex items-center gap-2">
              <Layers size={13} className="text-orange-admin" aria-hidden="true" />
              <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-white-body font-mono">
                Recent hunts
              </span>
              <span className="ml-auto text-[10px] font-mono text-white/45 tabular-nums">
                {hunts.length}
                {data.capped ? ' (latest 200)' : ''}
              </span>
            </header>
            {hunts.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/40 font-mono">
                  No completed hunts yet
                </p>
              </div>
            ) : (
              <div>
                {hunts.map((h) => (
                  <HuntRow key={`${h.ownerTwitchId}-${h.id}`} hunt={h} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
