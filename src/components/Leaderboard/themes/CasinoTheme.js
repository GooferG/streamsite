import { useCountdown } from '../../../hooks/useCountdown';
import { formatUSD, formatPosition, formatPrizeHeadline } from '../format';

const MEDALS = ['🥇', '🥈', '🥉'];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function freshness(now, lastUpdatedAt) {
  const ms = Math.max(0, now - lastUpdatedAt);
  if (ms < 60_000) return `${Math.floor(ms / 1000)}S AGO`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}M AGO`;
  return `${Math.floor(ms / 3_600_000)}H AGO`;
}

function PodiumSpot({ player, rank }) {
  if (!player) return null;
  // Center column (1st) sits taller; flanks drop down.
  const lift = ['sm:-mt-4', 'sm:mt-6', 'sm:mt-10'];
  return (
    <div
      className={`relative flex flex-col items-center text-center px-4 py-5 border border-amber-rust/30 bg-gradient-to-b from-amber-rust/12 to-transparent ${lift[rank]}`}
    >
      <div className="text-3xl leading-none" aria-hidden="true">
        {MEDALS[rank]}
      </div>
      <div className="mt-2 text-[11px] font-bold tracking-eyebrow text-amber-rust uppercase font-mono">
        {formatPosition(player.position)}
      </div>
      <div className="mt-1 text-lg font-extrabold text-white-body uppercase tracking-tight break-all">
        {player.maskedUsername}
      </div>
      <div className="mt-2 text-lg font-extrabold tabular-nums font-mono text-amber-rust">
        {formatUSD(player.wagered)}
      </div>
      <div className="mt-1 text-[11px] font-bold tabular-nums font-mono text-white/50">
        PRIZE {formatUSD(player.prize)}
      </div>
    </div>
  );
}

// Casino-classic register: podium for the top 3, ranked list below. Leans into
// the gold/medal look the house brand normally avoids — intentional, because
// this theme exists to demo that style on request. Renders the full info
// contract; no signature motion (motion lives in broadcast + neon).
export default function CasinoTheme({ data, now }) {
  const remaining = useCountdown(data.endsAt);
  const [first, second, third, ...rest] = data.players;
  const list = rest.slice(0, 17);

  return (
    <div
      data-theme="casino"
      className="border border-amber-rust/25 bg-zinc-broadcast/60"
    >
      {/* Header: prize headline + period + code/brand + countdown */}
      <div className="px-4 sm:px-6 py-6 border-b border-amber-rust/20 text-center">
        <div className="text-[11px] font-bold tracking-eyebrow-lg text-amber-rust/80 uppercase font-mono">
          {data.periodLabel}
        </div>
        <h2 className="mt-1 font-display text-4xl sm:text-5xl tracking-tight uppercase leading-none">
          <span className="text-amber-rust">{formatPrizeHeadline(data.prizePool)}</span>{' '}
          <span className="text-white-body">PRIZE POOL</span>
        </h2>
        <div className="mt-3 text-[11px] font-bold tracking-eyebrow-sm uppercase font-mono text-white/60">
          JOIN CODE{' '}
          <span className="text-amber-rust">{data.referralCode}</span>{' '}
          ON{' '}
          <span className="text-amber-rust">{data.brand}</span>
        </div>

        {/* Countdown — big flip-style tiles to hype the deadline */}
        {remaining.isOver ? (
          <div className="mt-5 font-display text-3xl sm:text-4xl tracking-tight uppercase text-red-destructive">
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
                <span className="min-w-[2.2ch] px-2 py-1 border border-amber-rust/40 bg-gradient-to-b from-amber-rust/15 to-transparent text-3xl sm:text-5xl font-extrabold tabular-nums font-mono text-amber-rust leading-none">
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

      {/* Podium — visual order 2nd, 1st, 3rd */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-4 sm:px-6 py-7">
        <div className="sm:order-1"><PodiumSpot player={second} rank={1} /></div>
        <div className="sm:order-2"><PodiumSpot player={first} rank={0} /></div>
        <div className="sm:order-3"><PodiumSpot player={third} rank={2} /></div>
      </div>

      {/* Ranked list (positions 4+) */}
      <div className="divide-y divide-amber-rust/10 border-t border-amber-rust/15">
        {list.map((p) => (
          <div
            key={p.id}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-4 px-4 sm:px-6 py-3"
          >
            <span className="w-12 text-sm font-bold tabular-nums font-mono text-amber-rust/70">
              {formatPosition(p.position)}
            </span>
            <span className="min-w-0 truncate text-sm font-bold text-white-body">
              {p.maskedUsername}
            </span>
            <span className="text-sm sm:text-base font-bold tabular-nums font-mono text-white-body text-right">
              {formatUSD(p.wagered)}
            </span>
            <span className="w-20 sm:w-24 text-right text-sm font-bold tabular-nums font-mono text-amber-rust">
              {p.prize > 0 ? formatUSD(p.prize) : '—'}
            </span>
          </div>
        ))}
      </div>

      {/* Last-updated freshness */}
      <div className="px-4 sm:px-6 py-3 border-t border-amber-rust/15 text-center text-[10px] font-bold tracking-eyebrow-md uppercase font-mono text-white/40 tabular-nums">
        STANDINGS UPDATED {freshness(now, data.lastUpdatedAt)}
      </div>
    </div>
  );
}
