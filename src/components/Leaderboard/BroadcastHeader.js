import { useCountdown } from '../../hooks/useCountdown';
import { useBtcPrice } from '../../hooks/useBtcPrice';

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

function formatBtcUsd(usd) {
  if (typeof usd !== 'number') return null;
  return `$${Math.round(usd).toLocaleString('en-US')}`;
}

function btcSlotsCommentary(change24h) {
  if (typeof change24h !== 'number') return 'BITCOIN STATUS UNCLEAR · CONSULT THE STREAM';
  if (change24h >= 5) return 'BITCOIN MOONING — SLOTS DEFINITELY ON';
  if (change24h >= 2) return 'BITCOIN TRENDING UP — SLOTS MIGHT BE ON';
  if (change24h > -2) return 'BITCOIN FLAT — SLOTS ALSO FLAT';
  if (change24h > -5) return 'BITCOIN TANKING — SLOTS COULD BE OFF';
  return 'BITCOIN COLLAPSING — DO NOT GAMBLE TODAY';
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
  const btc = useBtcPrice();
  const btcPriceText = formatBtcUsd(btc.usd);
  const btcUp = typeof btc.change24h === 'number' && btc.change24h >= 0;
  const btcChangeText =
    typeof btc.change24h === 'number'
      ? `${btcUp ? '▲' : '▼'}${Math.abs(btc.change24h).toFixed(2)}%`
      : null;
  const btcCommentary = btc.loading ? null : btcSlotsCommentary(btc.change24h);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-3 gap-x-6 px-4 sm:px-6 py-5 border-b border-white/8">
      <div className="space-y-1">
        <div className="text-[10px] font-bold tracking-eyebrow-lg text-white/65 font-mono">
          STANDINGS · {weekLabel}
        </div>
        <div className="text-[10px] font-bold tracking-eyebrow-md text-white/45 font-mono tabular-nums">
          LAST UPDATED · {formatRelativeAge(age)}
        </div>
        {btcPriceText && (
          <div className="pt-2 mt-2 border-t border-white/8 space-y-0.5">
            <div className="text-[10px] font-bold tracking-eyebrow-md font-mono tabular-nums">
              <span className="text-white/55">BTC</span>{' '}
              <span className="text-white-body">{btcPriceText}</span>{' '}
              {btcChangeText && (
                <span className={btcUp ? 'text-phosphor' : 'text-red-destructive'}>
                  {btcChangeText}
                </span>
              )}
            </div>
            {btcCommentary && (
              <div className="text-[9px] font-bold tracking-eyebrow-sm text-white/40 font-mono italic">
                {btcCommentary}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="text-center">
        <div className="text-[10px] font-bold tracking-eyebrow-lg text-white/50 font-mono">
          {periodLabel}
        </div>
        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-none mt-1 uppercase">
          <span
            className="relative text-phosphor"
            style={{
              textShadow:
                '0 0 18px rgba(31,243,154,0.6), 0 0 4px rgba(31,243,154,0.9)',
            }}
          >
            {formatPrizeHeadline(prizePool)}
            <span
              aria-hidden="true"
              className="absolute left-[1.5px] top-0 text-[#ff3b6b] mix-blend-screen opacity-40"
            >
              {formatPrizeHeadline(prizePool)}
            </span>
          </span>{' '}
          <span className="text-white-body">MONTHLY LEADERBOARD</span>
        </h1>
      </div>

      <div className="sm:text-right space-y-1">
        <div className="text-[10px] font-bold tracking-eyebrow-lg text-white/65 font-mono">
          {remaining.isOver ? 'STATUS' : 'T-MINUS'}
        </div>
        {remaining.isOver ? (
          <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-sm border border-red-destructive/35 bg-black/55 sm:ml-auto" style={{ boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.7)' }}>
            <span
              className="inline-block w-2 h-2 rounded-full bg-red-destructive animate-pulse motion-reduce:animate-none"
              style={{ boxShadow: '0 0 8px rgba(239,68,68,0.9)' }}
              aria-hidden="true"
            />
            <span
              className="text-base sm:text-lg font-extrabold tracking-eyebrow-sm font-mono text-red-destructive leading-none"
              style={{ textShadow: '0 0 10px rgba(239,68,68,0.7), 0 0 2px rgba(239,68,68,0.9)' }}
            >
              LEADERBOARD OVER
            </span>
          </div>
        ) : (
          <div className="flex items-start gap-1 sm:justify-end">
            {[
              ['DAY', remaining.days],
              ['HR', remaining.hours],
              ['MIN', remaining.minutes],
              ['SEC', remaining.seconds],
            ].map(([label, value], i) => (
              <div key={label} className="flex items-start gap-1">
                {i > 0 && (
                  <span
                    className="text-lg sm:text-2xl font-extrabold font-mono text-phosphor/70 leading-[1.1] animate-pulse motion-reduce:animate-none"
                    style={{ textShadow: '0 0 8px rgba(31,243,154,0.7)' }}
                    aria-hidden="true"
                  >
                    :
                  </span>
                )}
                <div className="flex flex-col items-center">
                  <span
                    className="px-1.5 py-0.5 rounded-sm border border-phosphor/25 bg-black/55 text-xl sm:text-2xl lg:text-3xl font-extrabold tabular-nums font-mono text-phosphor leading-none"
                    style={{
                      textShadow:
                        '0 0 10px rgba(31,243,154,0.7), 0 0 2px rgba(31,243,154,0.9)',
                      boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.7)',
                    }}
                  >
                    {pad2(value)}
                  </span>
                  <span className="mt-1 text-[8px] tracking-eyebrow-sm text-white/40 font-mono">
                    {label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
