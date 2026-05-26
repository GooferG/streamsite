export default function TrendArrow({ current, previous, className = '' }) {
  let symbol = '─';
  let label = 'no change';
  let toneClass = 'text-white/40';

  if (previous > current) {
    symbol = '▲';
    label = 'up';
    toneClass = 'text-emerald-signal';
  } else if (previous < current) {
    symbol = '▼';
    label = 'down';
    toneClass = 'text-white-muted';
  }

  return (
    <span
      className={`inline-block tabular-nums font-mono ${toneClass} ${className}`}
      aria-label={label}
    >
      {symbol}
    </span>
  );
}
