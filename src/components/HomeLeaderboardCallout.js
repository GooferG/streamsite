import { useNavigate } from 'react-router-dom';
import { useLeaderboardData } from '../hooks/useLeaderboardData';
import { useCountdown } from '../hooks/useCountdown';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatPrizeHeadline(amount) {
  if (!amount && amount !== 0) return '$0';
  if (amount >= 1000 && amount % 1000 === 0) {
    return `$${(amount / 1000).toLocaleString('en-US')}K`;
  }
  return `$${amount.toLocaleString('en-US')}`;
}

function formatUSD(amount) {
  if (!amount && amount !== 0) return '$0';
  return `$${Math.trunc(amount).toLocaleString('en-US')}`;
}

export default function HomeLeaderboardCallout() {
  const navigate = useNavigate();
  const data = useLeaderboardData();
  const remaining = useCountdown(data.endsAt);
  const leader = data.players[0];
  const runnerUp = data.players[1];
  const lead = leader && runnerUp ? leader.wagered - runnerUp.wagered : 0;

  const handleClick = () => navigate('/gamba/leaderboard');

  return (
    <section className="py-12 px-6 sm:px-10">
      <div className="max-w-7xl mx-auto">
        <button
          type="button"
          onClick={handleClick}
          className="group relative w-full text-left overflow-hidden border border-emerald-signal/30 bg-zinc-card/40 hover:border-emerald-signal/55 transition-colors duration-200 motion-reduce:transition-none"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-screen motion-reduce:hidden"
            aria-hidden="true"
            style={{
              backgroundImage:
                'repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(255,255,255,0.6) 2px, rgba(255,255,255,0.6) 3px)',
            }}
          />
          <div
            className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 rounded-full bg-emerald-signal/12 blur-3xl motion-reduce:hidden"
            aria-hidden="true"
          />

          <div className="pointer-events-none absolute top-3 right-4 flex items-center gap-2 text-[10px] font-bold tracking-eyebrow-lg text-emerald-signal font-mono z-10">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-signal animate-pulse motion-reduce:animate-none"
              aria-hidden="true"
            />
            <span>LIVE</span>
          </div>

          <div className="relative p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-8 items-center">
            <div className="space-y-4">
              <div className="text-[10px] font-bold tracking-eyebrow-lg text-white/55 font-mono">
                NOW SHOWING · CH 01 · {data.periodLabel}
              </div>
              <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-none uppercase">
                <span className="text-emerald-signal">{formatPrizeHeadline(data.prizePool)}</span>{' '}
                <span className="text-white-body">MONTHLY LEADERBOARD</span>
              </h2>
              <p className="text-white/65 text-base sm:text-lg leading-relaxed max-w-xl">
                Play on Rainbet with code{' '}
                <span className="font-bold text-rainbet-blue-bright font-mono tracking-eyebrow-sm">
                  BEAN
                </span>{' '}
                to climb the standings. Top 10 wagerers split the pool every month.
              </p>
              <div className="flex items-center gap-3 pt-2 text-sm font-bold tracking-eyebrow-sm uppercase font-mono text-emerald-bright group-hover:text-emerald-signal transition-colors duration-200 motion-reduce:transition-none">
                <span>View standings</span>
                <span
                  aria-hidden="true"
                  className="inline-block transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none"
                >
                  →
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 lg:border-l lg:border-white/8 lg:pl-8">
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold tracking-eyebrow-lg text-white/55 font-mono">
                  CURRENT LEADER
                </div>
                <div className="font-display text-2xl sm:text-3xl text-white-body tracking-tight uppercase leading-none break-all">
                  {leader ? leader.maskedUsername : '—'}
                </div>
                <div className="text-base sm:text-lg font-bold tabular-nums font-mono text-emerald-signal leading-none">
                  {leader ? formatUSD(leader.wagered) : '$0'}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-[10px] font-bold tracking-eyebrow-lg text-white/55 font-mono">
                  T-MINUS
                </div>
                <div className="text-2xl sm:text-3xl font-bold tabular-nums font-mono text-white-body leading-none">
                  {pad2(remaining.days)}d {pad2(remaining.hours)}h
                </div>
                <div className="text-xs tabular-nums font-mono text-white/55">
                  {pad2(remaining.minutes)}m {pad2(remaining.seconds)}s
                </div>
              </div>

              <div className="col-span-2 pt-3 border-t border-white/8 flex items-baseline justify-between gap-3">
                <div>
                  <div className="text-[10px] font-bold tracking-eyebrow-lg text-white/55 font-mono">
                    LEADING BY
                  </div>
                  <div className="text-base sm:text-lg font-bold tabular-nums font-mono text-white-body">
                    {lead > 0 ? formatUSD(lead) : '—'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold tracking-eyebrow-lg text-emerald-signal/80 font-mono">
                    1ST PRIZE
                  </div>
                  <div className="text-base sm:text-lg font-bold tabular-nums font-mono text-emerald-signal">
                    {leader ? formatUSD(leader.prize) : '$0'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </button>
      </div>
    </section>
  );
}
