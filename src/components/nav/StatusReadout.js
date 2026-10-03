import { Link, useLocation } from 'react-router-dom';
import StatusLight from '../onAir/StatusLight';
import { FOCUS, MONO } from '../onAir/classes';
import { useSchedule } from '../../hooks/useSchedule';
import { nextScheduledStream, nextStreamLabel } from '../../utils/scheduleWeek';
import { formatViewerCount } from '../../utils/viewers';

// The bezel's power LED: set dressing (DESIGN.md §7) that glows only while
// the channel is live.
export function PowerLed({ live }) {
  return (
    <span
      className={`h-[9px] w-[9px] flex-none rounded-full bg-onair-live ${live ? 'shadow-onair-led' : 'opacity-40'}`}
      aria-hidden="true"
      data-led
    />
  );
}

function Tally({ viewerCount, full }) {
  const { pathname } = useLocation();
  // Zero reads as plain LIVE: "LIVE · 0" at stream start helps nobody.
  const count = viewerCount > 0 ? formatViewerCount(viewerCount) : null;
  const label = count ? `Live now, ${Number(viewerCount).toLocaleString('en-US')} watching` : 'Live now';
  const light = (
    <StatusLight status="live">
      Live
      {count && <span className={full ? '' : 'hidden xl:inline'}>&nbsp;· {count}</span>}
    </StatusLight>
  );
  if (pathname === '/') {
    return (
      <span className="inline-flex">
        <span aria-hidden="true">{light}</span>
        <span className="sr-only">{label}</span>
      </span>
    );
  }
  return (
    <Link to="/" aria-label={label} className={`inline-flex rounded-onair-tile ${FOCUS}`}>
      {light}
    </Link>
  );
}

// Its own component so the schedule listener only runs while off air.
function OffAirReadout({ full }) {
  const { schedule } = useSchedule();
  const next = nextStreamLabel(nextScheduledStream(schedule));
  return (
    <Link
      to="/schedule"
      className={`${MONO} inline-flex items-center gap-2 whitespace-nowrap rounded-onair-tile bg-black/[0.35] px-3 py-[7px] text-[0.625rem] font-bold tracking-[0.2em] text-onair-ink-4 shadow-onair-well transition-colors duration-150 hover:text-onair-ink-2 motion-reduce:transition-none ${FOCUS}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-onair-ink-6" aria-hidden="true" />
      Off air
      {next && <span className={full ? '' : 'hidden xl:inline'}>&nbsp;· {next}</span>}
    </Link>
  );
}

// `variant="bar"` follows the nav breakpoints (count and next-stream time from
// xl, the off-air readout from lg); `variant="sheet"` shows everything.
// Nothing renders until the first Twitch poll succeeds (`statusReady`), so the
// nav never claims "off air" without knowing.
export default function StatusReadout({ isLive, viewerCount, statusReady, variant = 'bar' }) {
  if (!statusReady) return null;
  const full = variant === 'sheet';
  if (isLive) return <Tally viewerCount={viewerCount} full={full} />;
  if (full) return <OffAirReadout full />;
  return (
    <span className="hidden lg:inline-flex">
      <OffAirReadout />
    </span>
  );
}
