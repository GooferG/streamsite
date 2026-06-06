import { useEffect, useState } from 'react';
import { useCountdown } from '../../../hooks/useCountdown';
import { formatUSD, formatPosition, formatPrizeHeadline } from '../format';
import { gapToClimb } from '../gap';
import useCountUp from '../useCountUp';
import FlipTile from '../FlipTile';
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

function deltaInfo(player) {
  const d = (player.previousPosition || player.position) - player.position;
  if (d > 0) return { glyph: '▲', cls: 'text-nn-cyan' };
  if (d < 0) return { glyph: '▼', cls: 'text-nn-pink-lite' };
  return { glyph: '–', cls: 'text-white/30' };
}

const STREAKS = [
  { left: '12%', dur: '5.5s', delay: '0s' },
  { left: '48%', dur: '7s', delay: '2s' },
  { left: '78%', dur: '6s', delay: '4s' },
];

// Synthwave / Miami-sunset nightlife. Pure-CSS signature elements (sunset disc,
// 3D grid horizon, light streaks) — no WebGL. Renders the full info contract.
// Motion is the theme; all ambient motion gates on motion-reduce.
export default function NeonTheme({ data, now }) {
  const remaining = useCountdown(data.endsAt);
  const players = data.players.slice(0, 20);
  const rest = players.slice(3);
  const leaderWagered = players[0] ? players[0].wagered : 0;
  const animatedWagered = useCountUp(leaderWagered, { durationMs: 1500, delayMs: 200 });

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      data-theme="neon"
      className="relative overflow-hidden font-rajdhani text-white-body rounded-2xl"
      style={{
        background:
          'radial-gradient(80% 50% at 50% 8%, rgba(255,45,149,0.18), transparent 60%), radial-gradient(70% 60% at 50% 20%, rgba(122,61,255,0.18), transparent 60%), linear-gradient(180deg, #0a0420 0%, #120636 45%, #1a0a3e 70%, #2a0f4a 100%)',
      }}
    >
      <style>{`
        @keyframes nn-streak {
          0% { transform: translate(0, -200px) rotate(35deg); opacity: 0; }
          10% { opacity: 0.6; }
          100% { transform: translate(60vw, 110vh) rotate(35deg); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .nn-streak, .nn-grid-plane { animation: none !important; }
        }
      `}</style>

      {/* Sunset disc */}
      <div
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 z-0"
        aria-hidden="true"
        style={{
          top: '-90px',
          width: '560px',
          height: '560px',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(255,138,61,0.2), rgba(255,45,149,0.12) 45%, transparent 68%)',
          filter: 'blur(8px)',
        }}
      />

      {/* Grid horizon */}
      <div
        className="pointer-events-none absolute bottom-0 z-0 overflow-hidden"
        aria-hidden="true"
        style={{
          left: '-20%',
          right: '-20%',
          height: '42%',
          perspective: '340px',
          perspectiveOrigin: '50% 0%',
          opacity: 0.6,
          WebkitMaskImage: 'linear-gradient(180deg, transparent, #000 35%)',
          maskImage: 'linear-gradient(180deg, transparent, #000 35%)',
        }}
      >
        <div
          className="nn-grid-plane absolute inset-0 motion-safe:animate-nn-grid"
          style={{
            top: '-50%',
            transform: 'rotateX(72deg)',
            transformOrigin: '50% 0',
            backgroundImage:
              'linear-gradient(90deg, rgba(33,230,255,0.5) 1px, transparent 1px), linear-gradient(0deg, rgba(255,45,149,0.5) 1px, transparent 1px)',
            backgroundSize: '46px 46px',
          }}
        />
      </div>

      {/* Light streaks */}
      {STREAKS.map((s, i) => (
        <span
          key={i}
          className="nn-streak pointer-events-none absolute z-[1] motion-reduce:hidden"
          aria-hidden="true"
          style={{
            left: s.left,
            width: '2px',
            height: '160px',
            borderRadius: '2px',
            background: 'linear-gradient(180deg, transparent, #21e6ff, transparent)',
            filter: 'blur(0.5px)',
            opacity: 0.5,
            animationName: 'nn-streak',
            animationTimingFunction: 'linear',
            animationIterationCount: 'infinite',
            animationDuration: s.dur,
            animationDelay: s.delay,
          }}
        />
      ))}

      {/* Faint scanline */}
      <div
        className="pointer-events-none absolute inset-0 z-[2] opacity-40 motion-reduce:hidden"
        aria-hidden="true"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent 0 2px, rgba(10,4,32,0.4) 3px, transparent 4px)',
        }}
      />

      {/* Glass card */}
      <div
        className="relative z-[5] rounded-2xl border border-nn-purple/25"
        style={{
          background:
            'linear-gradient(180deg, rgba(20,8,48,0.55), rgba(10,4,32,0.35))',
          boxShadow:
            '0 0 60px rgba(122,61,255,0.18), inset 0 1px 0 rgba(177,77,255,0.18)',
          backdropFilter: 'blur(2px)',
        }}
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-6 border-b border-nn-purple/25 text-center">
          <div
            className="text-[0.8125rem] tracking-eyebrow-lg text-nn-cyan-lite"
            style={{ textShadow: '0 0 12px rgba(33,230,255,0.6)' }}
          >
            {data.periodLabel}
          </div>
          <h2
            className="mt-1.5 font-orbitron font-extrabold text-4xl sm:text-6xl leading-none tracking-wide motion-safe:animate-nn-flicker"
            style={{
              backgroundImage: 'linear-gradient(180deg, #fff 0%, #ff7ac4 60%, #ff2d95 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              filter:
                'drop-shadow(0 0 18px rgba(255,45,149,0.65)) drop-shadow(0 0 4px rgba(255,255,255,0.5))',
            }}
          >
            {formatPrizeHeadline(data.prizePool)} LEADERBOARD
          </h2>
          <div className="mt-2 text-[0.9375rem] tracking-eyebrow-md text-white/55 uppercase">
            Code{' '}
            <span className="text-nn-cyan" style={{ textShadow: '0 0 10px rgba(33,230,255,0.6)' }}>
              {data.referralCode}
            </span>{' '}
            on{' '}
            <span className="text-nn-cyan" style={{ textShadow: '0 0 10px rgba(33,230,255,0.6)' }}>
              {data.brand}
            </span>
          </div>

          {/* Countdown — neon split-flap tiles (reuses FlipTile) */}
          {remaining.isOver ? (
            <div
              className="mt-6 font-orbitron font-extrabold text-3xl sm:text-4xl uppercase text-nn-pink"
              style={{ textShadow: '0 0 16px rgba(255,45,149,0.8)' }}
            >
              LEADERBOARD OVER
            </div>
          ) : (
            <div className="mt-6 flex justify-center gap-3">
              {[
                ['Days', remaining.days],
                ['Hrs', remaining.hours],
                ['Min', remaining.minutes],
                ['Sec', remaining.seconds],
              ].map(([label, value]) => (
                <div key={label} className="text-center">
                  <FlipTile
                    value={pad2(value)}
                    widthClass="min-w-[56px] sm:min-w-[80px] py-2.5"
                    className="border rounded-xl"
                    style={{
                      borderColor: 'rgba(255,45,149,0.5)',
                      background:
                        'linear-gradient(180deg, rgba(40,12,70,0.7), rgba(16,6,40,0.7))',
                      boxShadow:
                        '0 0 18px rgba(255,45,149,0.3), inset 0 0 14px rgba(177,77,255,0.18)',
                    }}
                    textClass="font-orbitron font-bold text-2xl sm:text-4xl tabular-nums text-nn-pink-lite"
                    seamColor="rgba(255,45,149,0.35)"
                    nudge="translateY(0.02em)"
                  />
                  <div className="mt-2 text-[0.6875rem] tracking-eyebrow-md text-white/35 uppercase">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Podium */}
        <NeonPodium players={players} animatedWagered={animatedWagered} />

        {/* Table header */}
        <div className="grid grid-cols-[74px_minmax(0,1fr)_auto_auto] gap-4 px-4 sm:px-6 pt-4 pb-2 text-[0.6875rem] tracking-eyebrow uppercase text-white/30">
          <span>Pos</span>
          <span>Player</span>
          <span className="text-right">Wagered</span>
          <span className="w-24 text-right">Prize</span>
        </div>

        {/* Table (4–20) — gradient bars + gap-to-climb */}
        <div className="relative">
          {rest.map((p, idx) => {
            // overallIndex = position in the FULL sorted list (rest starts at 4th),
            // used for the gap-to-climb neighbor lookup. The bar `transitionDelay`
            // below intentionally uses the LOCAL idx so the stagger starts at the
            // first visible row (delay 0ms) — do not unify these two indices.
            const overallIndex = idx + 3;
            const climb = gapToClimb(data.players, overallIndex);
            const d = deltaInfo(p);
            // min 7% so the pink→violet→cyan gradient bar always shows its stops.
            const pct =
              leaderWagered > 0
                ? Math.max(7, Math.min(100, (p.wagered / leaderWagered) * 100))
                : 0;
            return (
              <div
                key={p.id}
                className="group grid grid-cols-[74px_minmax(0,1fr)_auto_auto] gap-4 items-center px-4 sm:px-6 py-3 border-t border-nn-purple/15 relative transition-colors hover:bg-nn-purple/[0.08]"
              >
                <span className="flex items-center gap-2 font-orbitron font-bold text-sm text-nn-pink-lite">
                  {formatPosition(p.position)}
                  <span className={`text-[0.5rem] ${d.cls}`} aria-hidden="true">
                    {d.glyph}
                  </span>
                </span>

                <div className="min-w-0">
                  <div className="truncate text-base font-semibold text-white">{p.maskedUsername}</div>
                  <div className="mt-1.5 h-1.5 rounded bg-nn-purple/10 overflow-hidden">
                    <div
                      className="h-full rounded transition-[width] duration-700 ease-out motion-reduce:transition-none motion-reduce:duration-0"
                      style={{
                        width: mounted ? `${pct}%` : '0%',
                        transitionDelay: `${idx * 60}ms`,
                        background: 'linear-gradient(90deg, #ff2d95, #7a3dff 55%, #21e6ff)',
                        boxShadow: '0 0 12px rgba(255,45,149,0.6)',
                      }}
                    />
                  </div>
                  {climb > 0 && (
                    <div className="pointer-events-none absolute left-[90px] -bottom-0.5 hidden sm:block text-[0.6875rem] text-nn-cyan opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                      +{formatUSD(climb)} to climb
                    </div>
                  )}
                </div>

                <span className="text-right text-base font-bold tabular-nums text-white">
                  {formatUSD(p.wagered)}
                </span>
                <span
                  className="w-24 text-right text-sm font-bold tabular-nums text-nn-pink-lite"
                  style={{ textShadow: '0 0 8px rgba(255,45,149,0.4)' }}
                >
                  {p.prize > 0 ? formatUSD(p.prize) : '—'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Last-updated */}
        <div className="px-4 sm:px-6 py-4 border-t border-nn-purple/25 text-center text-[0.6875rem] tracking-eyebrow-md uppercase text-white/40 tabular-nums">
          Signal updated {freshness(now, data.lastUpdatedAt)}
        </div>
      </div>
    </div>
  );
}
