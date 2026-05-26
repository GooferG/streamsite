import { useCountdown } from '../../hooks/useCountdown';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatRelativeAge(ms) {
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s AGO`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m AGO`;
  return `${Math.floor(ms / 3_600_000)}h AGO`;
}

function formatPrizeHeadline(amount) {
  if (!amount && amount !== 0) return '$0';
  if (amount >= 1000 && amount % 1000 === 0) {
    return `$${(amount / 1000).toLocaleString('en-US')}K`;
  }
  return `$${amount.toLocaleString('en-US')}`;
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
        <div className="text-[10px] font-bold tracking-eyebrow-lg text-white/50 font-mono">
          {periodLabel}
        </div>
        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-none mt-1 uppercase">
          <span className="text-emerald-signal">{formatPrizeHeadline(prizePool)}</span>{' '}
          <span className="text-white-body">MONTHLY LEADERBOARD</span>
        </h1>
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
