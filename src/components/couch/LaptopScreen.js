import { MONO } from '../onAir/classes';
import { money, plural, shortUntil } from './couchCopy';
import { SCREEN_CLASS } from './couchLayout';

// The laptop on the coffee table (spec: The laptop). On Air readouts only,
// never casino imagery. It turns on during a hunt but never glows.

function Hunt({ laptop }) {
  const { opened, total, back, currency } = laptop;
  const pct = total ? Math.min(100, (opened / total) * 100) : 0;
  return (
    <div className="flex h-full flex-col justify-center gap-[3cqw] px-[7cqw]">
      <span className={`${MONO} text-[5cqw] tracking-[0.2em] text-onair-signal`}>Hunt live</span>
      <span className="font-onair text-[16cqw] font-extrabold leading-none text-onair-ink-1">
        {opened}
        <span className="text-onair-ink-4">/{total ?? '?'}</span>
      </span>
      {total ? (
        <span className="block h-[3cqw] w-full overflow-hidden rounded-onair-label bg-onair-surface-raised">
          <span className="block h-full bg-onair-signal" style={{ width: `${pct}%` }} />
        </span>
      ) : null}
      <span className={`${MONO} text-[5cqw] tracking-[0.18em] text-onair-ink-3`}>{money(back, currency)} back</span>
    </div>
  );
}

function Round({ laptop }) {
  return (
    <div className="flex h-full flex-col justify-center gap-[3cqw] px-[7cqw]">
      <span className={`${MONO} text-[5cqw] tracking-[0.2em] text-onair-signal`}>
        {laptop.mode === 'open' ? 'Predictions open' : 'Predictions locked'}
      </span>
      <span className="font-onair text-[11cqw] font-extrabold leading-none text-onair-ink-1">
        {plural(laptop.guesses || 0, 'guess', 'guesses')}
      </span>
    </div>
  );
}

function Screensaver({ laptop }) {
  return (
    <>
      <div className="absolute inset-x-[6cqw] bottom-[16cqw] top-[6cqw]">
        <div className="absolute inset-y-0 left-0 w-[24cqw] motion-safe:animate-onair-bounce-x">
          <span className="absolute left-0 top-0 grid h-[10cqw] w-full place-items-center rounded-onair-tile bg-onair-surface-raised font-onair text-[6cqw] font-extrabold text-onair-ink-2 motion-safe:animate-onair-bounce-y">
            GG
          </span>
        </div>
      </div>
      {laptop.resetsIn ? (
        <span className={`${MONO} absolute inset-x-0 bottom-[5cqw] text-center text-[4.5cqw] tracking-[0.18em] text-onair-ink-4`}>
          Board resets in {shortUntil(laptop.resetsIn)}
        </span>
      ) : null}
    </>
  );
}

export default function LaptopScreen({ laptop }) {
  return (
    <div
      className="relative h-full w-full overflow-hidden bg-onair-surface-4"
      style={{ containerType: 'inline-size' }}
      aria-hidden="true"
      data-testid="laptop-screen"
    >
      {laptop.mode === 'hunt' && <Hunt laptop={laptop} />}
      {(laptop.mode === 'open' || laptop.mode === 'locked') && <Round laptop={laptop} />}
      {laptop.mode === 'idle' && <Screensaver laptop={laptop} />}
      <span className={`${SCREEN_CLASS} pointer-events-none absolute inset-0`} />
    </div>
  );
}
