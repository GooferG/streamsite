import { Link } from 'react-router-dom';
import { FOCUS, MONO } from '../onAir/classes';
import StatusLight from '../onAir/StatusLight';

// The shop sign (the page's h1) and the OPEN light, which is the page's LIVE
// light: the red tally while Goofer is live, an unlit "After hours" otherwise,
// and nothing until App's first Twitch poll lands.
export default function StoreSign({ isLive, statusReady }) {
  return (
    <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className={`${MONO} text-[0.6875rem] font-bold tracking-[0.2em] text-onair-signal`}>CH 03 · Tape rental</p>
        <h1 className="mt-3 inline-block rounded-onair-card bg-gradient-to-b from-onair-surface-1 to-onair-surface-3 px-6 py-4 text-[1.875rem] font-extrabold leading-[0.9] tracking-[-0.04em] text-onair-paper shadow-onair-card sm:text-[3.75rem]">
          Goofer Video
        </h1>
        <p className="mt-4 max-w-md text-[0.9375rem] leading-relaxed text-onair-ink-4">
          Every stream from the last 60 days, plus the clips chat couldn't let go.
        </p>
      </div>
      {statusReady &&
        (isLive ? (
          <div className="flex items-center gap-3">
            <StatusLight status="live">Open</StatusLight>
            <Link to="/" className={`text-[0.9375rem] font-bold text-onair-ink-1 underline-offset-4 hover:underline ${FOCUS}`}>
              Goofer is live, watch now
            </Link>
          </div>
        ) : (
          <span
            data-testid="after-hours"
            className={`${MONO} self-start rounded-onair-tile bg-white/[0.07] px-3 py-1.5 text-[0.6875rem] font-bold tracking-[0.2em] text-onair-ink-4 lg:self-auto`}
          >
            After hours
          </span>
        ))}
    </header>
  );
}
