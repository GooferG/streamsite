import { useEffect, useState } from 'react';
import { formatUSD, formatPosition } from './format';
import TrendArrow from './TrendArrow';
import WagerDropChip from './WagerDropChip';

export default function RaceBars({ players, leaderWagered }) {
  // `mounted` controls the bar fill-in animation on initial render.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (!leaderWagered) return null;

  return (
    <div className="divide-y divide-white/6">
      {players.map((p, i) => {
        const pct = Math.max(2, Math.min(100, (p.wagered / leaderWagered) * 100));
        return (
          <div
            key={p.id}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-4 px-4 sm:px-6 py-3"
          >
            <div className="flex items-center gap-2 w-16 sm:w-20">
              <span className="text-[11px] font-bold tracking-eyebrow-lg text-white/65 tabular-nums font-mono">
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
                  className="h-full bg-white/35 transition-[width] duration-700 ease-out motion-reduce:transition-none motion-reduce:duration-0"
                  style={{
                    width: mounted ? `${pct}%` : '0%',
                    transitionDelay: `${i * 80}ms`,
                  }}
                />
              </div>
            </div>

            <div className="text-sm sm:text-base font-bold tabular-nums font-mono text-white-body text-right">
              {formatUSD(p.wagered)}
            </div>

            <div className="text-right w-20 sm:w-24">
              <div className="text-[9px] font-bold tracking-eyebrow-md text-emerald-signal/60 font-mono">
                PRIZE
              </div>
              <div className="text-sm font-bold tabular-nums font-mono text-emerald-signal">
                {p.prize > 0 ? formatUSD(p.prize) : '—'}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
