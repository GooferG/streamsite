import { FOCUS, MONO } from '../onAir/classes';
import { SOCIAL_LINKS } from '../../constants';
import useNow from '../hunts/useNow';
import { upNext, zoneName } from '../../utils/scheduleTime';
import GuideBand from './GuideBand';
import GuideGrid from './GuideGrid';
import { gridLayout, guideRows } from './scheduleModel';

// The programming guide, composed from raw data (SchedulePage wires the live
// sources; fixtures feed it in dev and tests). `now` freezes the clock and
// `timeZone` stands in for the viewer's; both are for fixtures and tests.
export default function ScheduleFront({
  schedule = [],
  loading = false,
  covers = {},
  isLive = false,
  stream = null,
  stale = false,
  now: frozenNow = null,
  timeZone,
}) {
  const ticking = useNow(15 * 1000, frozenNow == null);
  const now = frozenNow ?? ticking;
  const next = loading ? null : upNext(schedule, now);
  const liveTitle = stream && stream.title;
  const rows = loading ? [] : guideRows({ schedule, now, next, isLive, timeZone, liveTitle });

  let mode = 'next';
  if (loading) mode = 'loading';
  else if (isLive) mode = 'live';
  else if (!next) mode = 'dark';

  const cover = next && next.entry.gameName ? covers[next.entry.gameName] || null : null;

  return (
    <div className="font-onair text-onair-ink-1">
      <header>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className={`${MONO} text-[0.6875rem] font-bold tracking-[0.2em] text-onair-signal`}>CH 02</span>
          <span className={`${MONO} text-[0.6875rem] tracking-[0.2em] text-onair-ink-4`}>Programming guide</span>
          <span className={`${MONO} text-[0.6875rem] tracking-[0.2em] ${isLive ? 'text-onair-signal' : 'text-onair-ink-5'}`}>
            {isLive ? 'On the air now' : 'Schedule subject to change'}
          </span>
        </div>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <h1 className="text-[1.875rem] font-extrabold leading-[0.92] tracking-[-0.035em] sm:text-[3.75rem]">
            This week, on the air.
          </h1>
          <p className="max-w-sm text-[0.9375rem] leading-relaxed text-onair-ink-4">
            Goofer runs on Arizona time. This page runs on yours, so the times below are already converted.
          </p>
        </div>
      </header>

      <div className="mt-6">
        <GuideBand mode={mode} next={next} now={now} cover={cover} stream={stream} timeZone={timeZone} />
      </div>

      {stale && !loading && (
        <p className={`${MONO} mt-4 text-[0.6875rem] tracking-[0.2em] text-onair-ink-4`}>
          Showing the usual week. The live schedule didn't load.
        </p>
      )}

      {!loading && rows.length > 0 && (
        <GuideGrid
          className="mt-10"
          rows={rows}
          layout={gridLayout({ rows, now, timeZone })}
          zone={zoneName(new Date(now), timeZone)}
        />
      )}

      <p className={`${MONO} mt-8 text-[0.6875rem] tracking-[0.2em] text-onair-ink-5`}>
        End of guide ·{' '}
        <a
          href={SOCIAL_LINKS.twitch}
          target="_blank"
          rel="noopener noreferrer"
          className={`text-onair-ink-3 underline-offset-4 hover:text-onair-ink-1 hover:underline ${FOCUS}`}
        >
          Follow on Twitch
        </a>{' '}
        for the go-live ping
      </p>
    </div>
  );
}
