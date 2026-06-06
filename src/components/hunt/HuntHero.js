// src/components/hunt/HuntHero.js
import { fmt, fmtX } from '../../utils/huntCalc';

// Hero Profit/Loss card. `profit` is the effective P/L (finish-based or running).
export default function HuntHero({ profit, avgReqRemaining, totalWins, start, wlMultiplier }) {
  const positive = profit != null && profit >= 0;
  const behind = profit != null && profit < 0 && avgReqRemaining != null;
  return (
    <div className="relative overflow-hidden rounded-lg border border-white/8 bg-zinc-card/40 p-5">
      <div
        className={`pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full blur-3xl motion-reduce:hidden ${
          positive ? 'bg-emerald-signal/10' : 'bg-red-destructive/10'
        }`}
        aria-hidden="true"
      />
      <div className="relative flex items-center justify-between gap-2 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-eyebrow-lg text-white/55 font-mono">
          Profit / Loss
        </span>
        {behind ? (
          <span className="text-[9px] font-bold uppercase tracking-eyebrow-md font-mono text-red-destructive">
            Behind · need {fmt(avgReqRemaining)} avg
          </span>
        ) : positive && profit > 0 ? (
          <span className="text-[9px] font-bold uppercase tracking-eyebrow-md font-mono text-emerald-signal">
            Ahead
          </span>
        ) : null}
      </div>
      <div className={`relative text-[52px] leading-none font-black tabular-nums ${
        profit == null ? 'text-white/40' : positive ? 'text-emerald-signal' : 'text-red-destructive'
      }`}>
        {profit == null ? '—' : `${positive ? '+' : '−'}${fmt(Math.abs(profit))}`}
      </div>
      <div className="relative text-[11px] font-mono text-white/45 mt-2 tabular-nums">
        {fmt(totalWins)} won{start != null ? ` · ${fmt(start)} start` : ''}{wlMultiplier != null ? ` · ${fmtX(wlMultiplier)} recovered` : ''}
      </div>
    </div>
  );
}
