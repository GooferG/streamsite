import { formatUSD, formatPosition } from './format';
import TrendArrow from './TrendArrow';
import WagerDropChip from './WagerDropChip';
import TiltCard from './TiltCard';

const TIERS = {
  runnerUp: {
    eyebrow: "── THIS MONTH'S RUNNER-UP ──",
    border: 'border-amber-rust/40',
    accent: 'text-amber-rust',
    positionGlow: 'text-amber-rust/15',
    glow: 'bg-amber-rust/12',
  },
  third: {
    eyebrow: '── NOT FAR BEHIND ──',
    border: 'border-white/15',
    accent: 'text-white-body',
    positionGlow: 'text-white/10',
    glow: 'bg-white/5',
  },
};

export default function PodiumCard({ player, tier }) {
  if (!player) return null;
  const palette = TIERS[tier] || TIERS.third;

  return (
    <TiltCard maxTiltDeg={5} scale={1.015} glareOpacity={0.25}>
      <div
        className={`relative overflow-hidden border ${palette.border} bg-zinc-card/60 h-full`}
      >
        <div
          className={`pointer-events-none absolute -top-20 -right-20 w-60 h-60 rounded-full ${palette.glow} blur-3xl motion-reduce:hidden`}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-screen motion-reduce:hidden"
          aria-hidden="true"
          style={{
            backgroundImage:
              'repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(255,255,255,0.6) 2px, rgba(255,255,255,0.6) 3px)',
          }}
        />

        <div className="relative p-4 sm:p-5 flex flex-col gap-3 sm:min-h-[11rem]">
          <div className="text-[10px] font-bold tracking-eyebrow-lg text-white/55 font-mono">
            {palette.eyebrow}
          </div>

          <div className="flex items-baseline gap-2.5 flex-wrap">
            <div className="relative">
              <span
                className={`absolute -top-1 -left-0.5 text-2xl sm:text-4xl font-extrabold tabular-nums font-mono ${palette.positionGlow} leading-none select-none`}
                aria-hidden="true"
              >
                {formatPosition(player.position)}
              </span>
              <span
                className={`relative text-2xl sm:text-4xl font-extrabold tabular-nums font-mono ${palette.accent} leading-none`}
                style={{ transform: 'translate(1px, -1px)' }}
              >
                {formatPosition(player.position)}
              </span>
            </div>
            <h3 className="font-display text-xl sm:text-3xl tracking-tight text-white-body leading-[0.95] break-all uppercase">
              {player.maskedUsername}
            </h3>
            <WagerDropChip delta={player.delta} />
          </div>

          <div>
            <div className="text-[10px] font-bold tracking-eyebrow-lg text-white/55 font-mono mb-0.5">
              WAGERED
            </div>
            <div
              className={`text-lg sm:text-2xl font-extrabold tabular-nums font-mono ${palette.accent} leading-none`}
            >
              {formatUSD(player.wagered)}
            </div>
          </div>

          <div className="mt-auto pt-2.5 border-t border-white/8 flex items-end justify-between gap-3">
            <div>
              <div
                className={`text-[10px] font-bold tracking-eyebrow-lg font-mono ${palette.accent}`}
                style={{ opacity: 0.8 }}
              >
                PRIZE
              </div>
              <div
                className={`text-base sm:text-xl font-extrabold tabular-nums font-mono leading-none ${palette.accent}`}
              >
                {formatUSD(player.prize)}
              </div>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold tracking-eyebrow-lg font-mono text-white/65 pb-0.5">
              <TrendArrow
                current={player.position}
                previous={player.previousPosition}
              />
              <span aria-hidden="true">
                POS {formatPosition(player.position)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </TiltCard>
  );
}
