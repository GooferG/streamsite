import { useCountdown } from '../../../hooks/useCountdown';
import { formatUSD, formatPosition, formatPrizeHeadline } from '../format';
import { gapToClimb } from '../gap';
import useCountUp from '../useCountUp';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function freshness(now, lastUpdatedAt) {
  const ms = Math.max(0, now - lastUpdatedAt);
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  return `${Math.floor(ms / 3_600_000)}h ago`;
}

function deltaInfo(player) {
  const d = (player.previousPosition || player.position) - player.position;
  if (d > 0) return { glyph: '▲', cls: 'text-emerald-bright' };
  if (d < 0) return { glyph: '▼', cls: 'text-red-destructive' };
  return { glyph: '–', cls: 'text-white/25' };
}

// Sleek premium-fintech: clean with depth (layered surfaces, soft shadows, one
// confident cool-blue accent used sparingly). Renders the full info contract.
// No ambient motion — restraint is the point (only the leader count-up moves).
export default function MinimalTheme({ data, now }) {
  const remaining = useCountdown(data.endsAt);
  const [first, second, third] = data.players;
  const top3 = [first, second, third].filter(Boolean);
  const players = data.players.slice(0, 20);
  const labels = ['1st', '2nd', '3rd'];
  const animatedWagered = useCountUp(first ? first.wagered : 0, {
    durationMs: 1500,
    delayMs: 200,
  });

  return (
    <div data-theme="minimal" className="font-grotesk text-white-body">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5 px-5 sm:px-8 py-7 border-b border-white/8">
        <div>
          <div className="text-[12px] tracking-eyebrow-md text-white/30 uppercase mb-3">
            {data.periodLabel}
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight leading-none">
            <span className="text-white-body">{formatPrizeHeadline(data.prizePool)}</span>{' '}
            <span className="font-medium text-white/50">Leaderboard</span>
          </h2>
          <div className="mt-4 text-sm text-white/50">
            Play on <span className="font-semibold text-white-body">{data.brand}</span> with code{' '}
            <span className="font-semibold text-mn-acc bg-mn-acc/[0.14] px-2.5 py-0.5 rounded-md">
              {data.referralCode}
            </span>
          </div>
        </div>

        {/* Countdown — large tabular numerals + vertical rules */}
        <div className="text-left sm:text-right">
          {remaining.isOver ? (
            <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-white/70">
              Leaderboard over
            </div>
          ) : (
            <>
              <div className="text-[11px] tracking-eyebrow text-white/30 uppercase mb-3">
                Ends in
              </div>
              <div className="flex items-start gap-4 sm:gap-5">
                {[
                  ['Days', remaining.days],
                  ['Hours', remaining.hours],
                  ['Min', remaining.minutes],
                  ['Sec', remaining.seconds],
                ].map(([label, value], i) => (
                  <div
                    key={label}
                    className={`flex flex-col items-center ${
                      i > 0 ? 'pl-4 sm:pl-5 border-l border-white/8' : ''
                    }`}
                  >
                    <span className="text-4xl sm:text-5xl font-semibold tabular-nums leading-none tracking-tight">
                      {pad2(value)}
                    </span>
                    <span className="mt-2 text-[10px] tracking-eyebrow text-white/30 uppercase">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Top 3 cards */}
      {top3.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 px-5 sm:px-8 py-7">
          {top3.map((p, i) => {
            const lead = i === 0;
            const wag = lead ? animatedWagered : p.wagered;
            return (
              <div
                key={p.id}
                className={`group relative rounded-2xl p-5 sm:p-6 border transition-transform duration-200 motion-safe:hover:-translate-y-[3px] ${
                  lead ? 'border-mn-acc/40' : 'border-white/8'
                }`}
                style={{
                  background: 'linear-gradient(180deg, #16161a, #101013)',
                  boxShadow: lead
                    ? 'inset 0 1px 0 rgba(255,255,255,0.04), 0 0 0 1px rgba(143,179,255,0.18), 0 20px 50px -24px rgba(91,128,216,0.6)'
                    : 'inset 0 1px 0 rgba(255,255,255,0.03), 0 12px 30px -18px rgba(0,0,0,0.8)',
                }}
              >
                {lead && (
                  <span
                    aria-hidden="true"
                    className="absolute left-6 right-6 top-0 h-0.5 rounded"
                    style={{ background: 'linear-gradient(90deg, #8fb3ff, transparent)' }}
                  />
                )}
                <div className="flex items-center justify-between mb-4">
                  <span
                    className={`text-[12px] tracking-eyebrow uppercase ${
                      lead ? 'text-mn-acc' : 'text-white/30'
                    }`}
                  >
                    {labels[i]} place
                  </span>
                  <span className="text-[11px] font-semibold text-white/40 border border-white/8 rounded-full px-2.5 py-0.5">
                    {formatPosition(p.position)}
                  </span>
                </div>
                <div className="text-xl font-semibold truncate">{p.maskedUsername}</div>
                <div
                  className={`mt-3.5 text-2xl sm:text-[32px] font-bold tabular-nums tracking-tight leading-none ${
                    lead ? 'text-mn-acc' : 'text-white-body'
                  }`}
                >
                  {formatUSD(wag)}
                </div>
                <div className="mt-1.5 text-sm text-white/45">{formatUSD(p.prize)} prize</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table header */}
      <div className="grid grid-cols-[64px_minmax(0,1fr)_auto_auto] gap-4 px-5 sm:px-8 pb-3.5 text-[11px] tracking-eyebrow text-white/30 uppercase">
        <span>#</span>
        <span>Player</span>
        <span className="text-right">Wagered</span>
        <span className="w-24 text-right">Prize</span>
      </div>

      {/* Table (all 20) */}
      <div className="rounded-2xl border border-white/8 overflow-hidden" style={{ background: '#101013' }}>
        {players.map((p, i) => {
          const climb = gapToClimb(data.players, i);
          const d = deltaInfo(p);
          return (
            <div
              key={p.id}
              className="group grid grid-cols-[64px_minmax(0,1fr)_auto_auto] gap-4 items-center px-5 sm:px-8 py-4 border-b border-white/8 last:border-b-0 transition-colors hover:bg-white/[0.03]"
            >
              <span className="flex items-center gap-2 text-sm font-semibold tabular-nums text-white/35">
                {formatPosition(p.position)}
                <span className={`text-[8px] ${d.cls}`} aria-hidden="true">
                  {d.glyph}
                </span>
              </span>
              <span className="min-w-0 flex items-center text-base font-medium">
                <span className="truncate">{p.maskedUsername}</span>
                {climb > 0 && (
                  <span className="ml-3 whitespace-nowrap text-[11px] text-mn-acc opacity-0 -translate-x-1.5 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0">
                    +{formatUSD(climb)} to climb
                  </span>
                )}
              </span>
              <span className="text-right text-base sm:text-lg font-semibold tabular-nums">
                {formatUSD(p.wagered)}
              </span>
              <span className="w-24 text-right text-sm font-medium tabular-nums text-white/45">
                {p.prize > 0 ? formatUSD(p.prize) : '—'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Last-updated */}
      <div className="px-5 sm:px-8 py-4 text-xs text-white/35 tabular-nums">
        Updated {freshness(now, data.lastUpdatedAt)}
      </div>
    </div>
  );
}
