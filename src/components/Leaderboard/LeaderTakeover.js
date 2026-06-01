import { formatUSD, formatPosition } from './format';
import TrendArrow from './TrendArrow';
import WagerDropChip from './WagerDropChip';
import TiltCard from './TiltCard';
import useCountUp from './useCountUp';

export default function LeaderTakeover({ leader, runnerUp }) {
  const animatedWagered = useCountUp(leader?.wagered, { durationMs: 1600, delayMs: 250 });
  if (!leader) return null;
  const lead = runnerUp ? leader.wagered - runnerUp.wagered : 0;

  return (
    <TiltCard maxTiltDeg={10} scale={1.02} glareOpacity={0.35} className="h-full">
      <div className="relative overflow-hidden border border-phosphor/40 bg-zinc-card/60 h-full">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-screen motion-reduce:hidden"
          aria-hidden="true"
          style={{
            backgroundImage:
              'repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(255,255,255,0.6) 2px, rgba(255,255,255,0.6) 3px)',
          }}
        />
        <div
          className="pointer-events-none absolute -top-32 -right-32 w-96 h-96 rounded-full bg-phosphor/15 blur-3xl motion-reduce:hidden"
          aria-hidden="true"
        />

        <div className="pointer-events-none absolute top-3 right-4 flex items-center gap-2 text-[10px] font-bold tracking-eyebrow-lg text-phosphor font-mono z-10">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full bg-phosphor animate-pulse motion-reduce:animate-none"
            aria-hidden="true"
          />
          <span>LIVE</span>
        </div>

        <div className="relative p-5 sm:p-7 lg:p-8 flex flex-col gap-5 sm:gap-6 min-h-[22rem] sm:min-h-[24rem]">
          <div className="text-[10px] sm:text-[11px] font-bold tracking-eyebrow-lg text-white/55 font-mono">
            ── THIS MONTH&apos;S LEADER ──
          </div>

          <div className="relative">
            <span
              className="absolute -top-2 -left-1 text-[4.5rem] sm:text-[6rem] lg:text-[6.5rem] font-extrabold tabular-nums font-mono text-phosphor/15 leading-none select-none"
              aria-hidden="true"
            >
              {formatPosition(leader.position)}
            </span>
            <span
              className="relative text-[4.5rem] sm:text-[6rem] lg:text-[6.5rem] font-extrabold tabular-nums font-mono text-phosphor leading-none"
              style={{ transform: 'translate(2px, -2px)' }}
            >
              {formatPosition(leader.position)}
            </span>
          </div>

          <div className="flex items-baseline gap-3 flex-wrap">
            <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl tracking-tight text-white-body leading-[0.9] break-all uppercase">
              {leader.maskedUsername}
            </h2>
            <WagerDropChip delta={leader.delta} />
          </div>

          <div>
            <div className="text-[10px] font-bold tracking-eyebrow-lg text-white/55 font-mono mb-1">
              TOTAL WAGERED
            </div>
            <div className="text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold tabular-nums font-mono text-phosphor leading-none">
              {formatUSD(animatedWagered)}
            </div>
          </div>

          <div className="mt-auto pt-4 border-t border-white/8 grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6">
            <div>
              <div className="text-[10px] font-bold tracking-eyebrow-lg text-phosphor/80 font-mono">
                PRIZE
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold tabular-nums font-mono text-phosphor leading-none">
                {formatUSD(leader.prize)}
              </div>
            </div>
            {lead > 0 && (
              <div className="sm:text-right">
                <div className="text-[10px] font-bold tracking-eyebrow-lg text-white/55 font-mono">
                  LEADING BY
                </div>
                <div className="text-lg sm:text-xl font-bold tabular-nums font-mono text-white-body">
                  {formatUSD(lead)}
                </div>
                <div className="mt-2 flex items-center gap-2 sm:justify-end text-[11px] font-bold tracking-eyebrow-lg font-mono text-white/65">
                  <TrendArrow
                    current={leader.position}
                    previous={leader.previousPosition}
                  />
                  <span aria-hidden="true">POS {formatPosition(leader.position)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </TiltCard>
  );
}
