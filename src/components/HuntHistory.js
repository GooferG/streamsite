import { useState } from 'react';
import { ChevronDown, ChevronRight, Download, History, Trash2, RotateCcw } from 'lucide-react';
import { fmt, fmtX, computeStats, computeCallerStats } from '../utils/huntCalc';
import ScatterPill from './ScatterPill';

function tsToDate(ts) {
  if (!ts) return null;
  if (typeof ts === 'number') return new Date(ts);
  if (ts.toDate) return ts.toDate();
  return new Date(ts);
}

function HistoryRow({ hunt, onReexport, onReopen, onDelete }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmingReopen, setConfirmingReopen] = useState(false);
  const s = computeStats(hunt);
  const callerStats = computeCallerStats(hunt.bonuses ?? []);
  const d = tsToDate(hunt.completedAt);
  const dateLabel = d
    ? d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
    : '—';

  const totalBuyIns = s.totalBuyIns;
  const finish = s.finish;

  return (
    <div className="border-t border-white/8 first:border-t-0">
      <div className="w-full grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-3 items-center px-3 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-white/40 hover:text-white-body"
          aria-label={open ? 'Collapse' : 'Expand'}
        >
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <button type="button" onClick={() => setOpen((o) => !o)} className="min-w-0 text-left">
          <p className="font-bold text-white-body text-sm truncate">{hunt.name || 'Untitled'}</p>
          <p className="text-[10px] font-bold tracking-eyebrow-md uppercase text-white/40 font-mono mt-0.5 tabular-nums">
            {dateLabel} · {s.bonusCount} bonuses · best {s.bestX != null ? fmtX(s.bestX) : '—'}
          </p>
        </button>
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
        <button
          type="button"
          onClick={() => onReexport(hunt)}
          className="p-1.5 border border-emerald-signal/40 text-emerald-signal hover:bg-emerald-signal/10 transition-colors duration-150"
          aria-label="Re-export recap"
          title="Export recap"
        >
          <Download size={12} aria-hidden="true" />
        </button>
        {onReopen ? (
          confirmingReopen ? (
            <span className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  onReopen(hunt.id);
                  setConfirmingReopen(false);
                }}
                className="p-1.5 bg-purple-gamba/20 border border-purple-gamba/60 text-purple-bright text-[9px] font-bold tracking-eyebrow-md uppercase font-mono"
                title="Confirm re-open"
              >
                Open
              </button>
              <button
                type="button"
                onClick={() => setConfirmingReopen(false)}
                className="p-1.5 border border-white/10 text-white/50 text-[9px] font-bold tracking-eyebrow-md uppercase font-mono"
                title="Cancel"
              >
                ✕
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingReopen(true)}
              className="p-1.5 border border-purple-gamba/40 text-purple-bright hover:bg-purple-gamba/15 transition-colors duration-150"
              aria-label="Re-open hunt"
              title="Re-open — bring this hunt back as active"
            >
              <RotateCcw size={12} aria-hidden="true" />
            </button>
          )
        ) : (
          <span />
        )}
        {onDelete ? (
          confirming ? (
            <span className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  onDelete(hunt.id);
                  setConfirming(false);
                }}
                className="p-1.5 bg-red-destructive/15 border border-red-destructive/50 text-red-destructive text-[9px] font-bold tracking-eyebrow-md uppercase font-mono"
                title="Confirm delete"
              >
                Del
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="p-1.5 border border-white/10 text-white/50 text-[9px] font-bold tracking-eyebrow-md uppercase font-mono"
                title="Cancel"
              >
                ✕
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="p-1.5 border border-red-destructive/30 text-red-destructive/70 hover:bg-red-destructive/10 transition-colors duration-150"
              aria-label="Delete hunt"
              title="Delete this hunt"
            >
              <Trash2 size={12} aria-hidden="true" />
            </button>
          )
        ) : (
          <span />
        )}
      </div>

      {open && (
        <div className="px-3 pb-3 space-y-3">
          {/* Bonuses */}
          {(hunt.bonuses?.length ?? 0) > 0 ? (
            <div className="border border-white/8 overflow-x-auto [scrollbar-width:thin]">
              <table className="w-full text-sm min-w-[360px]">
                <thead>
                  <tr className="border-b border-white/10 text-white/65 text-[10px] uppercase tracking-eyebrow-md bg-zinc-broadcast/50 font-mono">
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
                        <td className="px-3 py-2 font-bold text-white-body max-w-[160px]">
                          <span className="flex items-center gap-1.5 min-w-0">
                            <ScatterPill bonus={b} size="sm" />
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

          {/* Caller calls */}
          {callerStats.leaderboard.length > 0 && (
            <div className="border border-white/8 bg-zinc-broadcast/30 px-3 py-2.5 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-eyebrow-lg text-purple-bright font-mono">
                Slot calls
              </p>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {callerStats.leaderboard.map((row) => (
                  <span key={row.name} className="text-[11px] font-mono text-white/70">
                    <span className="font-bold text-white-body">{row.name}</span>
                    <span className="text-purple-bright tabular-nums"> {row.calls}</span>
                  </span>
                ))}
              </div>
              <div className="text-[11px] font-mono text-white/60 space-y-0.5 tabular-nums">
                {callerStats.bestCall && (
                  <p>
                    <span className="text-emerald-signal font-bold uppercase tracking-eyebrow-md">Best</span>{' '}
                    {callerStats.bestCall.slot} · {fmtX(callerStats.bestCall.x)} · {callerStats.bestCall.caller}
                  </p>
                )}
                {callerStats.worstCall && (
                  <p>
                    <span className="text-red-destructive font-bold uppercase tracking-eyebrow-md">Brick</span>{' '}
                    {callerStats.worstCall.slot} · {fmtX(callerStats.worstCall.x)} · {callerStats.worstCall.caller}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function HuntHistory({ history, onReexport, onReopen, onDelete }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-eyebrow-lg text-white/65 font-mono">
        <History size={12} className="text-white/45" aria-hidden="true" />
        <span>Past hunts</span>
        <span className="text-white/70 tabular-nums tracking-eyebrow-lg">
          {String(history.length).padStart(2, '0')}
        </span>
      </div>
      {history.length === 0 ? (
        <p className="text-center text-white/50 py-6 text-[11px] font-bold tracking-eyebrow-lg uppercase font-mono">
          No completed hunts yet.
        </p>
      ) : (
        <div className="border border-white/8 bg-zinc-card/30">
          {history.map((h) => (
            <HistoryRow
              key={h.id}
              hunt={h}
              onReexport={onReexport}
              onReopen={onReopen}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
