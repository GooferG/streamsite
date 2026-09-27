import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatMoney } from '../../utils/money';

// Signed P/L in the hunt's currency. null (potless hunt) renders an em dash.
export default function ProfitBadge({ value, currency }) {
  if (value == null) {
    return <span className="text-white/45 font-bold text-sm tabular-nums">—</span>;
  }
  if (value > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-signal font-bold text-sm tabular-nums">
        <TrendingUp size={13} aria-hidden="true" /> +{formatMoney(value, currency)}
      </span>
    );
  }
  if (value < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-red-destructive font-bold text-sm tabular-nums">
        <TrendingDown size={13} aria-hidden="true" /> {formatMoney(value, currency)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-white/70 font-bold text-sm tabular-nums">
      <Minus size={13} aria-hidden="true" /> {formatMoney(0, currency)}
    </span>
  );
}
