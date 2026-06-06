import { useEffect, useState } from 'react';
import { formatUSD, formatPosition } from './format';
import TrendArrow from './TrendArrow';
import WagerDropChip from './WagerDropChip';
import { gapToClimb } from './gap';

export default function RosterTable({ players, leaderWagered }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (!players.length) return null;
  const reference = leaderWagered || players[0]?.wagered || 0;

  return (
    <div className="border-t border-white/6">
      <div className="divide-y divide-white/6">
        {players.map((p, i) => {
          const pct =
            reference > 0
              ? Math.max(2, Math.min(100, (p.wagered / reference) * 100))
              : 0;
          const gap = gapToClimb(players, i);
          return (
            <div
              key={p.id}
              className="group relative grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-4 px-4 sm:px-6 py-3 hover:bg-white/3 transition-colors motion-reduce:transition-none"
            >
              <div className="flex items-center gap-2 w-16 sm:w-20">
                <span className="text-[0.6875rem] font-bold tracking-eyebrow-lg text-white/65 tabular-nums font-mono">
                  {formatPosition(p.position)}
                </span>
                <TrendArrow current={p.position} previous={p.previousPosition} />
              </div>

              <div className="min-w-0">
                <div className="flex items-center text-sm font-bold text-white-body truncate">
                  <span className="truncate">{p.maskedUsername}</span>
                  <WagerDropChip delta={p.delta} />
                </div>
                <div className="mt-1.5 h-2 bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-phosphor/30 to-phosphor shadow-[0_0_12px_rgba(31,243,154,0.4)] transition-[width] duration-700 ease-out motion-reduce:transition-none motion-reduce:duration-0"
                    style={{
                      width: mounted ? `${pct}%` : '0%',
                      transitionDelay: `${i * 80}ms`,
                    }}
                  />
                </div>
                {/* "Wager to climb" callout, revealed on row hover. left-[118px]
                    clears the rank column (w-20 = 80px) + grid gap (16px) + slack
                    so it sits under the bar; only shown at sm+ where that column
                    width applies. */}
                {gap > 0 && (
                  <div className="pointer-events-none absolute left-[118px] -bottom-0.5 hidden sm:block text-[0.625rem] tracking-eyebrow-xs text-crt-amber opacity-0 transition-opacity duration-150 group-hover:opacity-100 font-mono">
                    +{formatUSD(gap)} TO {formatPosition(p.position - 1)}
                  </div>
                )}
              </div>

              <div className="text-sm sm:text-base font-bold tabular-nums font-mono text-white-body text-right">
                {formatUSD(p.wagered)}
              </div>

              <div className="text-right w-20 sm:w-24">
                <div className="text-[0.5625rem] font-bold tracking-eyebrow-md text-phosphor/60 font-mono">
                  PRIZE
                </div>
                <div className="text-sm font-bold tabular-nums font-mono text-phosphor">
                  {p.prize > 0 ? formatUSD(p.prize) : '—'}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
