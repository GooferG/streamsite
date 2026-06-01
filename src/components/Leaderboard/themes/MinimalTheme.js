import { useCountdown } from '../../../hooks/useCountdown';
import { formatUSD, formatPosition, formatPrizeHeadline } from '../format';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function freshness(now, lastUpdatedAt) {
  const ms = Math.max(0, now - lastUpdatedAt);
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  return `${Math.floor(ms / 3_600_000)}h ago`;
}

// Clean / modern / calm. Renders the full information contract (prize, period,
// code, countdown, top-3, ranked list, last-updated) but in a quiet, restrained
// register — no motion. Restraint is the theme; the facts are not negotiable.
export default function MinimalTheme({ data, now }) {
  const remaining = useCountdown(data.endsAt);
  const [first, second, third] = data.players;
  const top3 = [first, second, third].filter(Boolean);
  const players = data.players.slice(0, 20);

  return (
    <div data-theme="minimal" className="bg-zinc-card/20 border border-white/8">
      {/* Header: prize headline + period + code/brand + countdown */}
      <div className="px-5 sm:px-8 py-7 border-b border-white/8">
        <div className="text-[11px] font-semibold tracking-eyebrow text-white/40 uppercase">
          {data.periodLabel}
        </div>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white-body">
            {formatPrizeHeadline(data.prizePool)}
          </h2>
          <span className="text-lg sm:text-xl font-medium text-white/55 tracking-tight">
            Leaderboard
          </span>
        </div>

        <div className="mt-4 text-sm text-white/50">
          Play on{' '}
          <span className="font-semibold text-white-body">{data.brand}</span>{' '}
          with code{' '}
          <span className="font-semibold text-white-body tracking-wide">
            {data.referralCode}
          </span>
        </div>

        {/* Countdown — the hype element, given weight even in the calm register */}
        <div className="mt-6">
          {remaining.isOver ? (
            <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-white/70">
              Leaderboard over
            </div>
          ) : (
            <>
              <div className="text-[11px] font-semibold tracking-eyebrow text-white/35 uppercase mb-2">
                Ends in
              </div>
              <div className="flex items-end gap-4 sm:gap-6">
                {[
                  ['Days', remaining.days],
                  ['Hours', remaining.hours],
                  ['Min', remaining.minutes],
                  ['Sec', remaining.seconds],
                ].map(([label, value]) => (
                  <div key={label} className="flex flex-col">
                    <span className="text-4xl sm:text-5xl font-semibold tabular-nums text-white-body leading-none">
                      {pad2(value)}
                    </span>
                    <span className="mt-1.5 text-[10px] font-semibold tracking-eyebrow text-white/30 uppercase">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Top 3 highlight */}
      {top3.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/6 border-b border-white/8">
          {top3.map((p, i) => (
            <div key={p.id} className="px-5 sm:px-6 py-5">
              <div className="text-[11px] font-semibold tracking-eyebrow text-white/35 uppercase">
                {['1st', '2nd', '3rd'][i]}
              </div>
              <div className="mt-1.5 text-base font-medium text-white-body truncate">
                {p.maskedUsername}
              </div>
              <div className="mt-1 text-xl font-semibold tabular-nums text-white-body">
                {formatUSD(p.wagered)}
              </div>
              <div className="mt-0.5 text-sm font-medium tabular-nums text-white/40">
                {formatUSD(p.prize)} prize
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Column header */}
      <div className="flex items-center gap-5 px-5 sm:px-8 pt-5 pb-2 text-[11px] font-semibold tracking-eyebrow text-white/30 uppercase">
        <span className="w-10">#</span>
        <span className="flex-1">Player</span>
        <span>Wagered</span>
        <span className="w-24 text-right">Prize</span>
      </div>

      {/* Ranked list */}
      <div className="divide-y divide-white/6">
        {players.map((p) => (
          <div key={p.id} className="flex items-center gap-5 px-5 sm:px-8 py-4">
            <span className="w-10 text-base font-semibold tabular-nums text-white/35">
              {formatPosition(p.position)}
            </span>
            <span className="flex-1 min-w-0 truncate text-base font-medium text-white-body">
              {p.maskedUsername}
            </span>
            <span className="text-base sm:text-lg font-semibold tabular-nums text-white-body">
              {formatUSD(p.wagered)}
            </span>
            <span className="w-24 text-right text-sm font-medium tabular-nums text-white/45">
              {p.prize > 0 ? formatUSD(p.prize) : '—'}
            </span>
          </div>
        ))}
      </div>

      {/* Last-updated freshness */}
      <div className="px-5 sm:px-8 py-4 border-t border-white/8 text-xs text-white/35 tabular-nums">
        Updated {freshness(now, data.lastUpdatedAt)}
      </div>
    </div>
  );
}
