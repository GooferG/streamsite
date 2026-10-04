import { DAY_INDEX, dayAbbrev } from '../../utils/scheduleWeek';
import {
  HOME_ZONE,
  calendarDay,
  clockMinutes,
  formatClock,
  homeWeekday,
  rollingWeek,
  upNext,
  viewerClock,
} from '../../utils/scheduleTime';

const DAY = 24 * 3600000;
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const clean = (s) => (typeof s === 'string' && s.trim() ? s.trim() : null);

// The admin's form reads "content" as the category and "gameName" as the show
// ("Slots" / "Bonus Hunt Time!"). The show headlines; the category labels it
// unless they say the same thing.
export function showTitle(entry) {
  const game = clean(entry.gameName);
  const content = clean(entry.content);
  const title = game || content;
  const category = game && content && content.toLowerCase() !== game.toLowerCase() ? content : null;
  return { title, category };
}

// "MONDAY" -> "Monday", "FRY-DAY" -> "Fry-day".
export function dayName(day) {
  return day.charAt(0) + day.slice(1).toLowerCase();
}

// "Mon 11:00 AM AZ": the slot on Goofer's clock.
export function streamerTime(next) {
  return `${WEEKDAY_SHORT[DAY_INDEX[next.entry.day]]} ${formatClock(next.start, next.slot.zone)} ${next.slot.zoneLabel}`;
}

// A showing's time on the viewer's clock, plus Goofer's when it differs.
function slotTimes({ start, slot }, timeZone) {
  const theirs = formatClock(start, slot.zone);
  const mine = viewerClock(start, slot.zone, timeZone);
  return mine ? { primary: mine, secondary: `${theirs} ${slot.zoneLabel}` } : { primary: theirs, secondary: null };
}

function badgeFor(state, isNext, next) {
  if (state === 'live') return 'On now';
  if (state === 'aired') return 'Aired';
  if (!isNext) return null;
  return next.phase === 'late' ? 'Running late' : 'Up next';
}

const relativeLabel = (days, entry) => (days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : dayName(entry.day));

// One row per scheduled day, today (in Arizona) first. state: 'live' (today,
// while the channel is live, scheduled or not), 'next' (the slot in the promo),
// 'off', 'aired' (today's slot, already over) or 'later'. Today and Tomorrow
// are the viewer's: a slot's label follows the day it lands on their clock.
export function guideRows({ schedule, now, next, isLive = false, timeZone, liveTitle = null }) {
  const today = homeWeekday(now);
  const homeDay = calendarDay(now, HOME_ZONE);
  const viewerDay = calendarDay(now, timeZone);
  return rollingWeek(schedule, now).map((entry) => {
    const offset = (DAY_INDEX[entry.day] - today + 7) % 7;
    const off = entry.status === 'off';
    const showing = off ? null : upNext([entry], now);
    const isNext = !!next && next.entry === entry;
    let state = 'later';
    if (isLive && offset === 0) state = 'live';
    else if (off) state = 'off';
    else if (isNext && !isLive) state = 'next';
    // Today's slot that has already run shows up next week, a day or more out.
    else if (offset === 0 && showing && showing.start.getTime() - now > DAY) state = 'aired';

    let time = { primary: 'Off air', secondary: null };
    if (off && state === 'live') time = { primary: 'Live now', secondary: null };
    else if (!off) {
      time = showing && showing.timeKnown
        ? slotTimes(showing, timeZone)
        : { primary: clean(entry.time) || 'Time TBA', secondary: null };
    }

    const upcoming = (state === 'next' || state === 'later') && showing && showing.timeKnown;
    const day = upcoming ? calendarDay(showing.start, timeZone) : homeDay + offset;
    const title = showTitle(entry);

    return {
      key: entry.day,
      day: entry.day,
      isToday: offset === 0,
      code: dayAbbrev(entry.day),
      label: relativeLabel(day - viewerDay, entry),
      state,
      badge: badgeFor(state, isNext, next),
      special: entry.status === 'special',
      time,
      showing:
        showing && showing.timeKnown
          ? { start: showing.start, end: showing.end, zone: showing.slot.zone, openEnd: !showing.slot.end }
          : null,
      ...(off && state === 'live' ? { title: liveTitle || 'Live on Twitch', category: null } : title),
    };
  });
}

const DEFAULT_WINDOW = { from: 10 * 60, to: 22 * 60 };
const MIN_SPAN = 6 * 60;

function hourLabel(minutes) {
  const h = (((minutes / 60) % 24) + 24) % 24;
  return `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;
}

// Where everything sits on the guide grid, in percent of the time window. The
// window runs from an hour before the week's earliest start to an hour after
// its latest end, on the viewer's clock, whole hours, six at least.
// blocks are keyed by row; now is the line on today's row, or null outside.
export function gridLayout({ rows, now, timeZone }) {
  const spans = {};
  for (const row of rows) {
    if (!row.showing) continue;
    const { start, end, zone, openEnd } = row.showing;
    const s = clockMinutes(start, zone, timeZone);
    spans[row.key] = { s, e: s + (end - start) / 60000, openEnd };
  }
  const list = Object.values(spans);
  let { from, to } = DEFAULT_WINDOW;
  if (list.length) {
    from = Math.floor((Math.min(...list.map((x) => x.s)) - 60) / 60) * 60;
    to = Math.ceil((Math.max(...list.map((x) => x.e)) + 60) / 60) * 60;
    to = Math.max(to, from + MIN_SPAN);
  }
  const pct = (m) => ((m - from) / (to - from)) * 100;

  const ticks = [];
  for (let m = from; m < to; m += 60) ticks.push({ at: m, left: pct(m), label: hourLabel(m) });

  const blocks = {};
  for (const [key, { s, e, openEnd }] of Object.entries(spans)) {
    blocks[key] = { left: pct(s), width: pct(e) - pct(s), openEnd };
  }

  const nowAt = clockMinutes(new Date(now), HOME_ZONE, timeZone);
  return { from, to, ticks, blocks, now: nowAt >= from && nowAt <= to ? pct(nowAt) : null };
}
