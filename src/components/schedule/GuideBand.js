import Panel from '../onAir/Panel';
import OnAirButton from '../onAir/OnAirButton';
import StatusLight from '../onAir/StatusLight';
import { MONO } from '../onAir/classes';
import { SOCIAL_LINKS } from '../../constants';
import { HOME_ZONE, formatClock, localTimeLabel, untilLabel, zoneName } from '../../utils/scheduleTime';
import ShowArt from './ShowArt';
import { dayName, showTitle, streamerTime } from './scheduleModel';

const LABEL = `${MONO} text-[0.6875rem] tracking-[0.2em]`;
const TITLE = 'text-[1.5rem] font-extrabold leading-none tracking-[-0.025em] sm:text-[1.875rem]';
const FIGURE = 'text-[1.875rem] font-extrabold leading-[0.85] tracking-[-0.03em] sm:text-[3.75rem]';
// The dark promo carries its own label (Signal dark).
const HEADINGS = { next: 'Up next', live: 'On now', dark: null, loading: 'Standby' };

const thumbnail = (url) => (url ? url.replace('{width}', '640').replace('{height}', '360') : null);

function FollowLink({ variant = 'ghost', children = 'Follow on Twitch', className = '' }) {
  return (
    <OnAirButton
      as="a"
      href={SOCIAL_LINKS.twitch}
      target="_blank"
      rel="noopener noreferrer"
      variant={variant}
      size="sm"
      className={className}
    >
      {children}
    </OnAirButton>
  );
}

function Countdown({ next, now, timeZone }) {
  if (next.phase === 'late') {
    const yours = localTimeLabel(next.start, next.slot.zone, timeZone);
    return (
      <div>
        <p className={FIGURE}>Any minute</p>
        <p className={`${LABEL} mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-onair-ink-4`}>
          <span>
            Was due {formatClock(next.start, next.slot.zone)} {next.slot.zoneLabel}
          </span>
          {yours && <span className="text-onair-ink-2">{yours} your time</span>}
        </p>
      </div>
    );
  }
  if (!next.timeKnown) {
    return (
      <div>
        <p className={FIGURE}>{next.phase === 'today' ? 'Today' : dayName(next.entry.day)}</p>
        <p className={`${LABEL} mt-2.5 text-onair-ink-4`}>{(next.entry.time || '').trim() || 'Time TBA'}</p>
      </div>
    );
  }
  return (
    <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className={`${LABEL} text-onair-ink-4`}>On in</span>
      <span className={`${FIGURE} text-onair-signal tabular-nums`}>{untilLabel(next.start.getTime() - now)}</span>
    </p>
  );
}

function NextPromo({ next, now, cover, timeZone }) {
  const { title, category } = showTitle(next.entry);
  const showTimes = next.timeKnown && next.phase !== 'late';
  const yours = showTimes ? localTimeLabel(next.start, next.slot.zone, timeZone) : null;
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-x-5 sm:grid-cols-[148px_minmax(0,1fr)] sm:gap-x-7">
      <div className="self-start">
        <ShowArt key={cover || 'ident'} cover={cover} word={category || title || 'GG'} />
      </div>
      <div className="min-w-0">
        {category && <p className={`${LABEL} text-onair-signal-light`}>{category}</p>}
        <h2 className={`${TITLE} mt-1.5`}>{title || 'Stream'}</h2>
        <div className="mt-4">
          <Countdown next={next} now={now} timeZone={timeZone} />
        </div>
        {showTimes && (
          <p className={`${MONO} mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[0.6875rem] tracking-[0.18em] text-onair-ink-4`}>
            <span>{streamerTime(next)}</span>
            {yours && <span className="text-onair-ink-2">{yours} your time</span>}
          </p>
        )}
        <FollowLink className="mt-4" />
      </div>
    </div>
  );
}

function LivePromo({ stream, next }) {
  const fallback = next ? showTitle(next.entry) : { title: null, category: null };
  const game = (stream && stream.game_name) || fallback.category;
  const title = (stream && stream.title) || fallback.title || 'Goofer is live';
  return (
    <div className="grid gap-5 sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-7">
      <ShowArt key={(stream && stream.thumbnail_url) || 'ident'} cover={thumbnail(stream && stream.thumbnail_url)} word={game || 'Live'} wide />
      <div className="min-w-0">
        {game && <p className={`${LABEL} text-onair-signal-light`}>{game}</p>}
        <h2 className={`${TITLE} mt-1.5 line-clamp-3`}>{title}</h2>
        <FollowLink variant="viewer" className="mt-5">
          Watch on Twitch
        </FollowLink>
      </div>
    </div>
  );
}

function DarkPromo() {
  return (
    <div className="flex flex-col items-start gap-3">
      <p className={`${LABEL} text-onair-ink-4`}>Signal dark</p>
      <h2 className={TITLE}>Nothing on the schedule this week.</h2>
      <p className="max-w-md text-[0.9375rem] leading-relaxed text-onair-ink-4">
        Follow on Twitch and you'll get the ping when the tower lights back up.
      </p>
      <FollowLink variant="viewer" className="mt-1" />
    </div>
  );
}

// The guide's wordmark. Pure CSS, like the GSN bug.
function GuideBug() {
  return (
    <span aria-hidden="true" className="inline-flex items-center gap-1.5">
      <span className="rounded-onair-tile bg-gradient-to-b from-onair-ink-1 to-onair-ink-3 px-2 py-0.5 text-[0.9375rem] font-extrabold tracking-[-0.02em] text-onair-surface-4 shadow-onair-raised">
        GG
      </span>
      <span className="text-[1.0625rem] font-extrabold tracking-[-0.02em]">Guide</span>
    </span>
  );
}

// The viewer's clock and Goofer's. Phones already show the viewer's time in
// their status bar, so below sm the strip carries Goofer's instead.
function Station({ now, timeZone }) {
  const date = new Date(now);
  const goofers = formatClock(date, HOME_ZONE);
  // "12:00" at full size, "PM" at half beside it, so the clock holds one line.
  const [clock, meridiem] = formatClock(date, timeZone).split(' ');
  const day = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long', month: 'short', day: 'numeric' }).format(date);
  return (
    <Panel className="flex items-center justify-between gap-4 p-4 sm:p-6 lg:flex-col lg:items-stretch lg:justify-between">
      <div className="flex items-center justify-between gap-3">
        <GuideBug />
        <span className={`${LABEL} hidden text-onair-ink-5 lg:inline`}>CH 02</span>
      </div>
      <div className="text-right lg:text-left">
        <p className={`${LABEL} text-onair-ink-4 sm:hidden`}>Goofer's clock</p>
        <p className="mt-1 whitespace-nowrap text-[1.375rem] font-extrabold leading-none tracking-[-0.02em] tabular-nums sm:hidden">
          {goofers} AZ
        </p>
        <p
          data-testid="station-clock"
          className="hidden whitespace-nowrap text-[3.75rem] font-extrabold leading-[0.85] tracking-[-0.03em] tabular-nums sm:block"
        >
          {clock}
          {meridiem && <span className="text-[1.875rem]"> {meridiem}</span>}
        </p>
        <p className={`${LABEL} mt-2.5 hidden text-onair-ink-4 sm:block`}>
          {day} · {zoneName(date, timeZone)}
        </p>
        <p className={`${LABEL} mt-1.5 hidden text-onair-ink-5 sm:block`}>
          {`Goofer's clock ${goofers} AZ`}
        </p>
      </div>
    </Panel>
  );
}

// The top of the guide channel: the promo box (next slot, the stream while
// live, standby while loading or dark) beside the station clock.
// mode: 'loading' | 'next' | 'live' | 'dark'.
export default function GuideBand({ mode, next, now, cover = null, stream = null, timeZone }) {
  const tuned = mode === 'next' || mode === 'live';
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <Panel as="section" aria-label="Now and next" lit={tuned ? 'signal' : null} className="p-5 sm:p-7">
        {HEADINGS[mode] && (
          <div className="mb-4 flex items-center gap-2.5">
            {mode === 'live' && <StatusLight status="live" />}
            <span className={`${LABEL} ${tuned ? 'text-onair-signal' : 'text-onair-ink-5'}`}>{HEADINGS[mode]}</span>
          </div>
        )}
        {mode === 'next' && <NextPromo next={next} now={now} cover={cover} timeZone={timeZone} />}
        {mode === 'live' && <LivePromo stream={stream} next={next} />}
        {mode === 'dark' && <DarkPromo />}
        {mode === 'loading' && <p className={`${LABEL} py-10 text-onair-ink-2`}>Tuning in…</p>}
      </Panel>
      <Station now={now} timeZone={timeZone} />
    </div>
  );
}
