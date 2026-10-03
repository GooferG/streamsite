import { MONO } from '../onAir/classes';
import { formatMoney, formatMoneyCompact } from '../../utils/money';

// One dot per visible guess on a dotted track, with break-even / so-far /
// actual markers. Only the winner and the viewer glow.
const DOT = {
  winner: 'bg-onair-winner-hot shadow-onair-dot-winner',
  runner: 'bg-onair-ink-3 shadow-onair-dot',
  me: 'bg-onair-viewer-bright shadow-onair-dot-viewer',
  open: 'bg-onair-ink-5 shadow-onair-dot',
  dim: 'bg-onair-ink-7 shadow-onair-dot',
};
const MARK = { signal: 'text-onair-signal', winner: 'text-onair-winner-light', muted: 'text-onair-ink-3' };

function labelShift(pct) {
  if (pct < 8) return 'translateX(0)';
  if (pct > 92) return 'translateX(-100%)';
  return 'translateX(-50%)';
}

export default function HuntMeter({ meter, currency }) {
  const guesses = `${meter.count} ${meter.count === 1 ? 'guess' : 'guesses'}`;
  const summary = [
    ...meter.markers.map((m) => `${m.label} ${formatMoney(m.value, currency)}`),
    `${guesses}${meter.sealed ? ', sealed until entries close' : ''}`,
  ].join('. ');
  return (
    <div
      role="img"
      aria-label={`Guess meter. ${summary}.`}
      className="relative mt-6 rounded-onair-row bg-black/[0.35] px-4 pb-3.5 pt-[18px] shadow-onair-row sm:px-5"
    >
      <div className="relative h-14" aria-hidden="true">
        <div className="absolute inset-x-0 top-[26px] h-1 rounded-full bg-[repeating-linear-gradient(90deg,rgba(255,255,255,.18)_0_2px,transparent_2px_12px)]" />
        {meter.markers.map((m) => (
          <div key={m.key} className={MARK[m.tone]}>
            <div className="absolute bottom-3 top-1.5 -ml-[1.5px] w-[3px] rounded-sm bg-current" style={{ left: `${m.pct}%` }} />
            <div
              className={`${MONO} absolute whitespace-nowrap text-[0.5625rem] tracking-[0.15em] ${m.labelAt === 'bottom' ? 'top-[44px]' : '-top-2.5'}`}
              style={{ left: `${m.pct}%`, transform: labelShift(m.pct) }}
            >
              {m.label}
            </div>
          </div>
        ))}
        {meter.dots.map((d) => (
          <div
            key={d.id}
            title={`${d.name}: ${formatMoney(d.value, currency)}`}
            className={`absolute top-[21px] -ml-[7px] h-[14px] w-[14px] rounded-full sm:top-[18px] sm:-ml-2.5 sm:h-5 sm:w-5 ${DOT[d.tone]}`}
            style={{ left: `${d.pct}%` }}
          />
        ))}
      </div>
      <div className={`${MONO} flex justify-between gap-2 text-[0.625rem] tracking-[0.15em] text-onair-screen-dim`} aria-hidden="true">
        <span>{formatMoneyCompact(meter.lo, currency)}</span>
        <span>
          {guesses}
          {meter.sealed ? ' · sealed' : ''}
        </span>
        <span>{formatMoneyCompact(meter.hi, currency)}</span>
      </div>
    </div>
  );
}
