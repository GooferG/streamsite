import { useEffect, useState } from 'react';
import { useCountdown } from '../../../hooks/useCountdown';
import { formatUSD, formatPosition, formatPrizeHeadline } from '../format';
import NeonShaderBackground from './NeonShaderBackground';
import NeonPodium from './NeonPodium';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function freshness(now, lastUpdatedAt) {
  const ms = Math.max(0, now - lastUpdatedAt);
  if (ms < 60_000) return `${Math.floor(ms / 1000)}S AGO`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}M AGO`;
  return `${Math.floor(ms / 3_600_000)}H AGO`;
}

// Arcade/neon register. Signature motion: glow pulse on the leader + animated
// bar fills. Motion is gated by motion-reduce:* utilities so reduced-motion
// users keep the static neon glow without movement. Renders the full info
// contract (prize, period, code, countdown, top-3 emphasis, ranked list,
// last-updated).
export default function NeonTheme({ data, now }) {
  const remaining = useCountdown(data.endsAt);
  const players = data.players.slice(0, 20);
  const leaderWagered = players[0] ? players[0].wagered : 0;

  // Drive the bar fill-in on mount (mirrors RaceBars' pattern).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      data-theme="neon"
      className="relative overflow-hidden border border-purple-gamba/40 bg-zinc-broadcast/55 backdrop-blur-sm"
    >
      <NeonShaderBackground />

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-screen motion-reduce:hidden"
        aria-hidden="true"
        style={{
          backgroundImage:
            'repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(192,132,252,0.7) 2px, rgba(192,132,252,0.7) 3px)',
        }}
      />

      {/* Header: prize headline + period + code/brand + countdown */}
      <div className="relative px-4 sm:px-6 py-6 border-b border-purple-gamba/30 text-center">
        <div className="text-[11px] font-bold tracking-eyebrow-lg uppercase font-mono text-purple-bright">
          {data.periodLabel}
        </div>
        <h2
          className="mt-1 font-display text-4xl sm:text-5xl tracking-tight uppercase leading-none text-purple-bright animate-neon-pulse motion-reduce:animate-none motion-reduce:[text-shadow:0_0_10px_rgba(192,132,252,0.9)]"
        >
          {formatPrizeHeadline(data.prizePool)} LEADERBOARD
        </h2>
        <div className="mt-3 text-[11px] font-bold tracking-eyebrow-sm uppercase font-mono text-white/65">
          CODE{' '}
          <span className="text-purple-bright">{data.referralCode}</span>{' '}
          ON{' '}
          <span className="text-purple-bright">{data.brand}</span>
        </div>

        {/* Countdown — big glowing tiles to hype the deadline */}
        {remaining.isOver ? (
          <div className="mt-5 font-display text-3xl sm:text-4xl tracking-tight uppercase text-red-destructive animate-neon-pulse motion-reduce:animate-none">
            LEADERBOARD OVER
          </div>
        ) : (
          <div className="mt-5 flex items-end justify-center gap-2 sm:gap-3">
            {[
              ['DAYS', remaining.days],
              ['HRS', remaining.hours],
              ['MIN', remaining.minutes],
              ['SEC', remaining.seconds],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col items-center">
                <span className="min-w-[2.2ch] px-2 py-1 border border-purple-gamba/50 bg-purple-gamba/10 text-3xl sm:text-5xl font-extrabold tabular-nums font-mono text-purple-bright leading-none shadow-[0_0_14px_rgba(168,85,247,0.55)]">
                  {pad2(value)}
                </span>
                <span className="mt-1.5 text-[9px] font-bold tracking-eyebrow-md uppercase font-mono text-white/45">
                  {label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top-3 cards */}
      <NeonPodium players={players} />

      {/* Ranked list (positions 4+) with animated bar fills */}
      <div className="relative divide-y divide-purple-gamba/15">
        {players.slice(3).map((p, idx) => {
          const i = idx + 3;
          const pct =
            leaderWagered > 0
              ? Math.max(2, Math.min(100, (p.wagered / leaderWagered) * 100))
              : 0;
          return (
            <div
              key={p.id}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-4 px-4 sm:px-6 py-3"
            >
              <span className="w-12 text-sm font-bold tabular-nums font-mono text-purple-bright">
                {formatPosition(p.position)}
              </span>

              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-white-body">
                  {p.maskedUsername}
                </div>
                <div className="mt-1.5 h-2 bg-purple-gamba/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-gamba to-purple-bright shadow-[0_0_8px_rgba(168,85,247,0.8)] transition-[width] duration-700 ease-out motion-reduce:transition-none motion-reduce:duration-0"
                    style={{
                      width: mounted ? `${pct}%` : '0%',
                      transitionDelay: `${i * 60}ms`,
                    }}
                  />
                </div>
              </div>

              <span className="text-sm sm:text-base font-bold tabular-nums font-mono text-white-body text-right">
                {formatUSD(p.wagered)}
              </span>

              <span className="w-20 sm:w-24 text-right text-sm font-bold tabular-nums font-mono text-purple-bright">
                {p.prize > 0 ? formatUSD(p.prize) : '—'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Last-updated freshness */}
      <div className="relative px-4 sm:px-6 py-3 border-t border-purple-gamba/25 text-center text-[10px] font-bold tracking-eyebrow-md uppercase font-mono text-white/40 tabular-nums">
        SIGNAL UPDATED {freshness(now, data.lastUpdatedAt)}
      </div>
    </div>
  );
}
