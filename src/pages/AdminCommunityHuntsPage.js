import { useEffect, useState, useCallback } from 'react';
import {
  TrendingUp,
  Trophy,
  Users,
  Layers,
  ChevronDown,
  ChevronRight,
  Trash2,
  Download,
} from 'lucide-react';
import { authedFetch } from '../utils/authedFetch';
import { useAuth } from '../contexts/AuthContext';
import { fmt, fmtX, computeStats, computeCallerStats } from '../utils/huntCalc';
import { renderRecap } from '../utils/huntExport';
import ScatterPill from '../components/ScatterPill';

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
      <div className="flex items-center gap-1.5 text-[0.5625rem] font-bold tracking-eyebrow-lg uppercase text-white/45 font-mono">
        {Icon && <Icon size={11} aria-hidden="true" />}
        <span>{label}</span>
      </div>
      <div className="mt-1 text-lg font-bold text-white-body tabular-nums">{value}</div>
      {hint && <div className="text-[0.625rem] text-white/40 font-mono truncate">{hint}</div>}
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
              <tr className="border-b border-white/10 text-white/65 text-[0.625rem] uppercase tracking-eyebrow-md bg-zinc-broadcast/50 font-mono">
                <th className="text-left px-3 py-2 font-bold">Slot</th>
                <th className="text-right px-3 py-2 font-bold">Bet</th>
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
                        <ScatterPill bonus={b} size="sm" />
                        <span className="truncate">{b.slot}</span>
                      </span>
                      {b.caller && (
                        <span className="block text-[0.625rem] font-mono tracking-eyebrow-md uppercase text-purple-bright truncate mt-0.5">
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
        <p className="text-center text-white/40 py-3 text-[0.6875rem] font-bold tracking-eyebrow-lg uppercase font-mono">
          No bonuses logged.
        </p>
      )}

      {/* Squad split */}
      {(hunt.gamblers?.length ?? 0) > 0 && (
        <div className="border border-white/8 overflow-x-auto [scrollbar-width:thin]">
          <table className="w-full text-sm min-w-[360px]">
            <thead>
              <tr className="border-b border-white/10 text-white/65 text-[0.625rem] uppercase tracking-eyebrow-md bg-zinc-broadcast/50 font-mono">
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
          <p className="text-[0.625rem] font-bold uppercase tracking-eyebrow-lg text-purple-bright font-mono">
            Slot calls
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {callerStats.leaderboard.map((row) => (
              <span key={row.name} className="text-[0.6875rem] font-mono text-white/70">
                <span className="font-bold text-white-body">{row.name}</span>
                <span className="text-purple-bright tabular-nums"> {row.calls}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HuntRow({ hunt, canDelete, onDelete, deleting }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
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
          <p className="text-[0.625rem] font-bold tracking-eyebrow-md uppercase text-white/40 font-mono mt-0.5 tabular-nums">
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
        <span className="text-[0.625rem] font-mono text-white/35 tabular-nums">
          best {s.bestX != null ? fmtX(s.bestX) : '—'}
        </span>
      </button>
      {open && (
        <>
          <HuntDetail hunt={hunt} />
          <div className="px-3 pb-3 flex items-center justify-end gap-2" data-html2canvas-ignore="true">
            <button
              type="button"
              onClick={() => renderRecap(hunt)}
              title="Re-export the recap image for this hunt"
              className="inline-flex items-center gap-1.5 px-2 py-1 border border-emerald-signal/40 text-emerald-signal hover:bg-emerald-signal/10 text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono transition-colors"
            >
              <Download size={11} aria-hidden="true" />
              Reprint results
            </button>
            {canDelete &&
              (confirming ? (
                <div className="flex items-center gap-2">
                  <span className="text-[0.625rem] font-mono uppercase tracking-eyebrow-md text-white/50">Delete this hunt?</span>
                  <button
                    type="button"
                    disabled={!!deleting}
                    onClick={() => onDelete({ kind: 'completed', ownerTwitchId: hunt.ownerTwitchId, huntId: hunt.id })}
                    className="px-2 py-1 bg-red-destructive/15 border border-red-destructive/50 text-red-destructive text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono disabled:opacity-50"
                  >
                    {deleting ? 'Deleting…' : 'Confirm'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    className="px-2 py-1 border border-white/10 text-white/55 text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className="inline-flex items-center gap-1.5 px-2 py-1 border border-red-destructive/30 text-red-destructive/70 hover:bg-red-destructive/10 text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono"
                >
                  <Trash2 size={11} aria-hidden="true" />
                  Delete
                </button>
              ))}
          </div>
        </>
      )}
    </div>
  );
}

function LiveRow({ hunt, canDelete, onDelete, deleting }) {
  const [confirming, setConfirming] = useState(false);
  const s = computeStats(hunt);
  const ownerName = hunt.owner?.displayName || hunt.owner?.twitchName || hunt.ownerTwitchId;

  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-4 py-2.5 border-t border-white/5 first:border-t-0">
      <div className="min-w-0">
        <p className="font-bold text-white-body text-sm truncate">
          {hunt.name}
          {hunt.shared && (
            <span className="ml-2 text-[0.5625rem] font-bold tracking-eyebrow-md uppercase text-red-destructive font-mono">● live link</span>
          )}
        </p>
        <p className="text-[0.625rem] font-bold tracking-eyebrow-md uppercase text-white/40 font-mono mt-0.5 tabular-nums">
          {ownerName} · {hunt.phase} · {s.bonusCount} bonuses
        </p>
      </div>
      <span className="text-[0.625rem] font-mono text-white/35 tabular-nums">
        best {s.bestX != null ? fmtX(s.bestX) : '—'}
      </span>
      <span className="text-sm font-bold tabular-nums text-white/60">{fmt(s.totalStakes)}</span>
      {canDelete ? (
        confirming ? (
          <span className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={!!deleting}
              onClick={() => onDelete({ kind: 'live', ownerTwitchId: hunt.ownerTwitchId })}
              className="px-2 py-1 bg-red-destructive/15 border border-red-destructive/50 text-red-destructive text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono disabled:opacity-50"
            >
              {deleting ? '…' : 'Stop'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="px-2 py-1 border border-white/10 text-white/55 text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono"
            >
              ✕
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            title="Stop & delete this in-progress hunt"
            className="p-1 border border-red-destructive/30 text-red-destructive/70 hover:bg-red-destructive/10"
            aria-label="Delete live hunt"
          >
            <Trash2 size={11} aria-hidden="true" />
          </button>
        )
      ) : (
        <span />
      )}
    </div>
  );
}

export default function AdminCommunityHuntsPage() {
  const { isOwner } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(null); // key of the row being deleted

  const load = useCallback(async () => {
    try {
      const res = await authedFetch('/api/admin/community-hunts', { method: 'GET' });
      const json = await res.json();
      if (!res.ok) setError(json.error || 'Failed to load');
      else {
        setData(json);
        setError(null);
      }
    } catch (e) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const deleteHunt = useCallback(
    async (payload, key) => {
      setDeleting(key);
      try {
        const res = await authedFetch('/api/admin/community-hunts', {
          method: 'POST',
          body: JSON.stringify({ action: 'delete', ...payload }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          alert(`Delete failed: ${j.error || res.status}`);
        } else {
          await load();
        }
      } catch (e) {
        alert('Delete failed (network).');
      } finally {
        setDeleting(null);
      }
    },
    [load]
  );

  const stats = data?.stats;
  const hunts = data?.hunts ?? [];
  const live = data?.live ?? [];

  return (
    <div className="p-6 sm:p-8 max-w-4xl mx-auto">
      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[0.625rem] font-bold uppercase tracking-eyebrow-lg text-white/45 mb-5 font-mono">
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
          <p className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/40 font-mono">
            Loading…
          </p>
        </div>
      )}

      {error && !loading && (
        <div className="border border-red-destructive/30 bg-red-destructive/5 py-6 px-4 text-center">
          <p className="text-[0.6875rem] font-bold tracking-eyebrow uppercase text-red-destructive font-mono">
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

          {/* Live now — in-progress hunts */}
          {live.length > 0 && (
            <div className="border border-emerald-signal/30 bg-emerald-signal/5 mb-6">
              <header className="px-4 py-2.5 border-b border-white/10 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-signal animate-pulse" />
                <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-emerald-signal font-mono">
                  Live now
                </span>
                <span className="ml-auto text-[0.625rem] font-mono text-white/45 tabular-nums">{live.length}</span>
              </header>
              <div>
                {live.map((h) => (
                  <LiveRow
                    key={`${h.ownerTwitchId}-${h.id}`}
                    hunt={h}
                    canDelete={isOwner}
                    onDelete={(payload) => deleteHunt(payload, `l-${h.ownerTwitchId}`)}
                    deleting={deleting === `l-${h.ownerTwitchId}`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Top hunts by profit */}
          {stats.topHuntsByProfit.length > 0 && (
            <div className="border border-white/10 bg-zinc-card/30 mb-6">
              <header className="px-4 py-2.5 border-b border-white/10 flex items-center gap-2">
                <Trophy size={13} className="text-emerald-signal" aria-hidden="true" />
                <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white-body font-mono">
                  Top hunts by profit
                </span>
              </header>
              <div>
                {stats.topHuntsByProfit.map((h, i) => (
                  <div
                    key={`${h.huntName}-${i}`}
                    className="flex items-center gap-3 px-4 py-2 border-t border-white/5 first:border-t-0"
                  >
                    <span className="text-[0.625rem] font-bold tabular-nums text-white/30 font-mono w-5">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="flex-1 min-w-0 truncate text-sm font-bold text-white-body">
                      {h.huntName}
                    </span>
                    <span className="text-[0.6875rem] font-mono text-white/45 truncate max-w-[120px]">{h.owner}</span>
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
              <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white-body font-mono">
                Recent hunts
              </span>
              <span className="ml-auto text-[0.625rem] font-mono text-white/45 tabular-nums">
                {hunts.length}
                {data.capped ? ' (latest 200)' : ''}
              </span>
            </header>
            {hunts.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/40 font-mono">
                  No completed hunts yet
                </p>
              </div>
            ) : (
              <div>
                {hunts.map((h) => (
                  <HuntRow
                    key={`${h.ownerTwitchId}-${h.id}`}
                    hunt={h}
                    canDelete={isOwner}
                    onDelete={(payload) => deleteHunt(payload, `c-${h.ownerTwitchId}-${h.id}`)}
                    deleting={deleting === `c-${h.ownerTwitchId}-${h.id}`}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
