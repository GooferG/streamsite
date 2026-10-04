import { Children, useId } from 'react';
import { MONO } from '../onAir/classes';
import { padCount } from './videoStoreModel';

// An aisle of the store (Fresh picks, New releases, Cult classics). Its
// heading is the aisle bar's jump target, so it can take focus; the floor's
// scroll padding keeps it clear of the nav and the bar.
export function Aisle({ id, title, count, children }) {
  return (
    <section aria-labelledby={id} className="mt-14">
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id={id}
          tabIndex={-1}
          className="text-[1.875rem] font-extrabold leading-none tracking-[-0.03em] text-onair-ink-1 outline-none"
        >
          {title}
        </h2>
        <span className={`${MONO} text-[0.6875rem] tracking-[0.2em] text-onair-ink-4`}>{padCount(count)} on the shelf</span>
      </div>
      <div className="mt-6 space-y-10">{children}</div>
    </section>
  );
}

// One shelf: a heading (a week, or a game's paper divider), then the row of
// tapes on a lip. Below md the row scrolls sideways; from md it wraps, and
// each item carries its own stretch of lip so the lip runs under every row.
export function Shelf({ label, divider = false, size = 'box', children }) {
  const headingId = useId();
  const width = size === 'box' ? 'w-[46vw]' : 'w-[64vw]';
  const columns =
    size === 'box'
      ? 'md:grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))]'
      : 'md:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]';
  return (
    <div>
      {divider ? (
        <h3
          id={headingId}
          className="inline-block rounded-onair-label bg-onair-paper px-3 py-1.5 text-[1.0625rem] font-extrabold text-onair-paper-ink shadow-onair-raised"
        >
          {label}
        </h3>
      ) : (
        <h3 id={headingId} className={`${MONO} text-[0.75rem] font-bold tracking-[0.2em] text-onair-ink-3`}>
          {label}
        </h3>
      )}
      <ul
        aria-labelledby={headingId}
        className={`-mx-2 mt-3 flex snap-x snap-mandatory overflow-x-auto pb-2 pt-2 md:grid md:snap-none md:gap-y-6 md:overflow-visible md:pt-0 ${columns}`}
      >
        {Children.map(children, (child) => (
          <li className={`flex shrink-0 snap-start flex-col gap-3 px-2 md:w-auto ${width}`}>
            {child}
            <div
              aria-hidden="true"
              className="-mx-2 mt-auto h-2.5 bg-gradient-to-b from-onair-surface-raised to-onair-surface-4 shadow-onair-card"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
