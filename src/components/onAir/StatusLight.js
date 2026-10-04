import { MONO } from './classes';

// The studio tally: LIVE (red, glowing, pulsing dot) or REPLAY (raised grey).
// Shared by the Monitor header and the site nav. `children` replaces the
// label, e.g. "Live · 1.2K".
export default function StatusLight({ status, children, className = '' }) {
  if (status === 'live') {
    return (
      <span
        className={`${MONO} inline-flex items-center gap-[7px] whitespace-nowrap rounded-onair-tile bg-onair-live px-3 py-1.5 text-[0.6875rem] font-bold tracking-[0.2em] text-white-body shadow-onair-live ${className}`}
      >
        <span className="h-[7px] w-[7px] rounded-full bg-white-body motion-safe:animate-onair-pulse" aria-hidden="true" />
        {children ?? 'Live'}
      </span>
    );
  }
  if (status === 'replay') {
    return (
      <span
        className={`${MONO} inline-flex items-center whitespace-nowrap rounded-onair-tile bg-onair-surface-raised px-3 py-1.5 text-[0.6875rem] font-bold tracking-[0.2em] text-onair-ink-2 ${className}`}
      >
        {children ?? 'Replay'}
      </span>
    );
  }
  return null;
}
