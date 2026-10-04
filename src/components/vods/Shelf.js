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

// A paper divider card that opens a game's run of cassettes on the Cult
// classics shelf. It fills its shelf cell like the cassettes beside it.
export function GameDivider({ game, count }) {
  return (
    <div className="flex-1 rounded-onair-tile bg-onair-paper p-3 text-onair-paper-ink shadow-onair-raised">
      <h4 className="break-words text-[1.0625rem] font-extrabold leading-tight">{game}</h4>
      <p className={`${MONO} mt-1 text-[0.625rem] tracking-[0.15em]`}>
        {count} {count === 1 ? 'clip' : 'clips'}
      </p>
    </div>
  );
}

// One shelf: a heading (a week, or "Filed by game"), then the row of tapes on
// a lip. Below md the row scrolls sideways; from md it wraps, and each item
// carries its own stretch of lip so the lip runs under every row.
export function Shelf({ label, size = 'box', children }) {
  const headingId = useId();
  const width = size === 'box' ? 'w-[46vw]' : 'w-[64vw]';
  const columns =
    size === 'box'
      ? 'md:grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))]'
      : 'md:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]';
  return (
    <div>
      <h3 id={headingId} className={`${MONO} text-[0.75rem] font-bold tracking-[0.2em] text-onair-ink-3`}>
        {label}
      </h3>
      {/* Tailwind's preflight removes list markers, and Safari then drops the list semantics. */}
      {/* eslint-disable-next-line jsx-a11y/no-redundant-roles */}
      <ul
        role="list"
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
