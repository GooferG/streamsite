// src/components/hunt/HuntStatGrid.js
import { fmt, fmtX } from '../../utils/huntCalc';

// 4-up secondary stat grid. Values come from computeStats + counts.
function Cell({ label, value, tint }) {
  return (
    <div className="rounded-lg border border-white/8 bg-zinc-card/30 px-3 py-2.5">
      <div className="text-[10px] font-bold uppercase tracking-eyebrow-md text-white/55 font-mono mb-1">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${tint || 'text-white-body'}`}>{value}</div>
    </div>
  );
}

export default function HuntStatGrid({ stats, bonusCount, pendingCount }) {
  const winTint = stats.totalWins > 0 ? 'text-emerald-signal' : 'text-white-body';
  const avgXTint = stats.curAvgX != null && stats.curAvgX >= 1 ? 'text-emerald-signal' : 'text-white-body';
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Cell label={`Bonuses${pendingCount ? ` · ${pendingCount} pending` : ''}`} value={bonusCount} />
      <Cell label="Start cost" value={fmt(stats.totalStakes)} />
      <Cell label="Winnings" value={fmt(stats.totalWins)} tint={winTint} />
      <Cell label="Avg req" value={stats.avgReqRemaining != null ? fmt(stats.avgReqRemaining) : '—'} />
      <Cell label="Cur avg" value={stats.curAvgWin != null ? fmt(stats.curAvgWin) : '—'} />
      <Cell label="Total X" value={stats.totalX > 0 ? fmtX(stats.totalX) : '—'} />
      <Cell label="Req X" value={stats.reqX != null ? fmtX(stats.reqX) : '—'} />
      <Cell label="Cur avg X" value={stats.curAvgX != null ? fmtX(stats.curAvgX) : '—'} tint={avgXTint} />
    </div>
  );
}
