import { formatUSD, formatPosition } from '../format';

// Clean, modern, calm. No motion by design — restraint is the theme. Consumes
// the same { data } the other themes do.
export default function MinimalTheme({ data }) {
  const players = data.players.slice(0, 20);

  return (
    <div data-theme="minimal" className="bg-zinc-card/20 border border-white/8">
      <div className="px-5 sm:px-8 py-7 border-b border-white/8">
        <div className="text-[11px] font-semibold tracking-eyebrow text-white/40 uppercase">
          {data.periodLabel} · {data.weekLabel}
        </div>
        <div className="mt-2 flex items-baseline gap-3">
          <h2 className="text-2xl sm:text-3xl font-semibold text-white-body tracking-tight">
            Leaderboard
          </h2>
          <span className="text-sm font-medium text-white/40 tabular-nums">
            {formatUSD(data.prizePool)} pool
          </span>
        </div>
      </div>

      <div className="divide-y divide-white/6">
        {players.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-5 px-5 sm:px-8 py-4"
          >
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
    </div>
  );
}
