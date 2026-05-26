import { formatUSD, formatPosition } from './format';
import TrendArrow from './TrendArrow';
import WagerDropChip from './WagerDropChip';

export default function LeaderTakeover({ leader, runnerUp }) {
  if (!leader) return null;
  const lead = runnerUp ? leader.wagered - runnerUp.wagered : 0;

  return (
    <div className="relative overflow-hidden border-b border-white/8">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-screen motion-reduce:hidden"
        aria-hidden="true"
        style={{
          backgroundImage:
            'repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(255,255,255,0.6) 2px, rgba(255,255,255,0.6) 3px)',
        }}
      />
      <div
        className="pointer-events-none absolute -inset-12 bg-emerald-signal/10 blur-3xl motion-reduce:hidden"
        aria-hidden="true"
      />

      <div className="relative grid grid-cols-1 sm:grid-cols-[auto_1fr_auto] items-center gap-y-4 gap-x-8 px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-bold tracking-eyebrow-lg text-emerald-signal tabular-nums font-mono">
            {formatPosition(leader.position)}
          </span>
          <TrendArrow current={leader.position} previous={leader.previousPosition} />
        </div>

        <div>
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-white-body break-all">
            {leader.maskedUsername}
            <WagerDropChip delta={leader.delta} />
          </div>
          <div className="mt-1 text-5xl sm:text-6xl md:text-7xl font-extrabold tabular-nums font-mono text-emerald-signal leading-none">
            {formatUSD(leader.wagered)}
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
          </div>
        )}
      </div>
    </div>
  );
}
