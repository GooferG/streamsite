import { formatMoney } from '../../utils/money';
import { formatMultiplier } from '../../utils/huntFormat';

function MultiplierBar({ value, max }) {
  const n = Number(value);
  const pct = Number.isFinite(n) && max > 0 ? Math.min((n / max) * 100, 100) : 0;
  // Semantic data viz — gradient fill encodes magnitude (intentional).
  const color =
    n >= 100
      ? 'from-emerald-signal to-emerald-bright'
      : n >= 50
        ? 'from-yellow-500 to-yellow-400'
        : 'from-red-destructive to-red-destructive/70';
  return (
    <div className="flex-1 h-1 bg-white/10 overflow-hidden">
      <div className={`h-full bg-gradient-to-r ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// Per-bonus rows. Unopened bonuses (win/multiplier null) render as em dashes.
export default function BonusReel({ bonuses, currency }) {
  const list = Array.isArray(bonuses) ? bonuses : [];
  if (list.length === 0) return null;
  const max = Math.max(1, ...list.map((b) => (Number.isFinite(Number(b.multiplier)) ? Number(b.multiplier) : 0)));
  return (
    <div>
      <p className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/65 mb-3 font-mono">
        Bonus reel · {list.length}
      </p>
      <div className="space-y-1.5">
        {list.map((b, i) => (
          <div key={`${b.slot}-${i}`} className="flex items-center gap-3 px-3 py-2.5 bg-zinc-broadcast/40 border border-white/5">
            {b.thumb ? (
              <img
                src={b.thumb}
                alt=""
                loading="lazy"
                className="w-9 h-9 object-cover flex-shrink-0 bg-white/5 border border-white/10"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            ) : (
              <div className="w-9 h-9 flex-shrink-0 bg-white/5 border border-white/10" aria-hidden="true" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white-body text-sm truncate leading-tight">{b.slot || `Bonus ${i + 1}`}</p>
              <p className="text-[0.625rem] tracking-eyebrow-sm uppercase text-white/65 truncate mt-0.5 font-mono">
                Bet {formatMoney(b.bet, currency)}
              </p>
            </div>
            <div className="w-32 hidden sm:flex items-center">
              <MultiplierBar value={b.multiplier} max={max} />
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-bold text-sm text-white-body tabular-nums">{formatMoney(b.win, currency)}</p>
              <p className="text-[0.625rem] tracking-eyebrow-sm text-white/65 tabular-nums font-mono">
                {formatMultiplier(b.multiplier)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
