import { formatUSD } from './format';
import { useCountdown } from '../../hooks/useCountdown';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatRelativeAge(ms) {
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s AGO`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m AGO`;
  return `${Math.floor(ms / 3_600_000)}h AGO`;
}

export default function BroadcastHeader({
  weekLabel,
  periodLabel,
  prizePool,
  endsAt,
  lastUpdatedAt,
  now,
}) {
  const remaining = useCountdown(endsAt);
  const age = Math.max(0, now - lastUpdatedAt);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-3 gap-x-6 px-4 sm:px-6 py-5 border-b border-white/8">
      <div className="space-y-1">
        <div className="text-[10px] font-bold tracking-eyebrow-lg text-white/65 font-mono">
          STANDINGS · {weekLabel}
        </div>
        <div className="text-[10px] font-bold tracking-eyebrow-md text-white/45 font-mono tabular-nums">
          LAST UPDATED · {formatRelativeAge(age)}
        </div>
      </div>

      <div className="text-center">
        <div className="text-[10px] font-bold tracking-eyebrow-md text-white/50 font-mono">
          *** {periodLabel} STANDINGS ***
        </div>
        <div className="mt-1 text-[11px] font-bold tracking-eyebrow-md text-white/60 font-mono">
          PRIZE POOL · {formatUSD(prizePool)}
        </div>
      </div>

      <div className="sm:text-right space-y-1">
        <div className="text-[10px] font-bold tracking-eyebrow-lg text-white/65 font-mono">
          T-MINUS
        </div>
        <div className="text-base sm:text-lg font-bold tabular-nums font-mono text-white-body">
          {pad2(remaining.days)}d {pad2(remaining.hours)}h{' '}
          {pad2(remaining.minutes)}m {pad2(remaining.seconds)}s
        </div>
      </div>
    </div>
  );
}
