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
                <span className={btcUp ? 'text-emerald-signal' : 'text-red-destructive'}>
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
