import { MONO } from '../onAir/classes';
import { fitFigure } from '../onAir/fit';
import MoneyFigure, { fitTextFor } from './MoneyFigure';

// Building blocks of an On Air monitor screen, shared by the Hunts monitor and
// the Gamba guide's featured monitor. Screen content is the size container for
// the fitted hero (container-type: inline-size, --hero-share).

const EYEBROW = { signal: 'text-onair-signal', winner: 'text-onair-winner-warm', muted: 'text-onair-ink-4' };
const HERO = { ink: 'text-onair-ink-1', loss: 'text-onair-loss', signal: 'text-onair-signal-light' };

export function Eyebrow({ tone, children }) {
  return (
    <p className={`${MONO} text-[0.6875rem] tracking-[0.3em] [overflow-wrap:anywhere] sm:text-xs ${EYEBROW[tone]}`}>
      {children}
    </p>
  );
}

export function Question({ children }) {
  return <h2 className="text-[1.375rem] font-bold tracking-[-0.01em] text-onair-ink-3 sm:text-3xl">{children}</h2>;
}

// The hero figure fills its share of the screen (2–6rem). A currency code is
// set at half size beside the figure, so "ARS 1,850,000.00" fits a phone.
export function Hero({ text, suffix = null, label, tone = 'ink' }) {
  return (
    <div className="flex min-w-0 max-w-full flex-col items-center gap-1.5">
      <p
        className={`whitespace-nowrap font-extrabold leading-[0.9] tracking-[-0.03em] tabular-nums ${HERO[tone]}`}
        style={{ fontSize: fitFigure(`${fitTextFor(text)}${suffix || ''}`, { min: 2, max: 6 }) }}
      >
        <MoneyFigure text={text} symbolClassName="align-[0.5em] text-[0.45em]" />
        {suffix && <span className="text-[0.58em] text-onair-signal-light">{suffix}</span>}
      </p>
      {label && <p className={`${MONO} text-[0.6875rem] tracking-[0.25em] text-onair-ink-5`}>{label}</p>}
    </div>
  );
}

export function SideStats({ items }) {
  if (!items.length) return null;
  return (
    <>
      <span className="hidden h-[84px] w-px bg-white/10 sm:block" aria-hidden="true" />
      <dl className="flex flex-wrap justify-center gap-x-5 gap-y-2 sm:flex-col sm:items-start sm:gap-2 sm:pb-1">
        {items.map((s) => (
          <div key={s.label} className="flex items-baseline gap-1.5 text-sm text-onair-ink-5">
            <dt>{s.label}</dt>
            <dd className="text-lg font-bold tabular-nums text-onair-ink-1">{s.value}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

export function HeroRow({ hero, side }) {
  return (
    <div className="mt-1 flex w-full flex-col items-center gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-center sm:gap-7">
      {hero}
      <SideStats items={side} />
    </div>
  );
}

export function Chips({ children }) {
  return <div className="mt-1.5 flex flex-wrap justify-center gap-2.5">{children}</div>;
}

export function Stage({ eyebrow, children }) {
  return (
    <div className="flex flex-col items-center gap-3 pb-1.5 pt-6 text-center sm:pt-[30px]">
      {eyebrow}
      {children}
    </div>
  );
}
