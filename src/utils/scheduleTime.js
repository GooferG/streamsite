import { DAY_INDEX } from './scheduleWeek';

// Schedule times are typed free-hand in the admin ("11:00 AM AZ",
// "4:20 PM - 9:00 PM EST"). These read them into real instants so the guide can
// count down and show each viewer their own clock. Anything that doesn't read
// stays as the admin's text.

// Arizona keeps MST all year, so MST is Phoenix rather than Denver.
const ZONES = {
  AZ: 'America/Phoenix',
  MST: 'America/Phoenix',
  MT: 'America/Denver',
  MDT: 'America/Denver',
  ET: 'America/New_York',
  EST: 'America/New_York',
  EDT: 'America/New_York',
  CT: 'America/Chicago',
  CST: 'America/Chicago',
  CDT: 'America/Chicago',
  PT: 'America/Los_Angeles',
  PST: 'America/Los_Angeles',
  PDT: 'America/Los_Angeles',
};

// Goofer streams from Arizona: a time typed without a zone is Arizona time.
export const HOME_ZONE = 'America/Phoenix';
const HOME_LABEL = 'AZ';

const CLOCK = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i;

function readClock(text, fallbackMeridiem) {
  const m = text.match(CLOCK);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = m[2] ? Number(m[2]) : 0;
  const meridiem = (m[3] || fallbackMeridiem || '').toUpperCase();
  if (minute > 59) return null;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (meridiem === 'PM' ? 12 : 0);
  } else if (hour > 23) {
    return null;
  }
  return { hour, minute, meridiem: m[3] ? meridiem : null };
}

// { hour, minute, end: { hour, minute } | null, zone, zoneLabel }, or null.
export function parseSlotTime(text) {
  if (typeof text !== 'string') return null;
  let rest = text.trim();
  let zoneLabel = HOME_LABEL;
  let zone = HOME_ZONE;
  const last = rest.split(/\s+/).pop().toUpperCase();
  if (ZONES[last]) {
    zoneLabel = last;
    zone = ZONES[last];
    rest = rest.slice(0, rest.length - last.length).trim();
  }
  const parts = rest.split(/\s*[-–—]\s*/);
  if (parts.length > 2) return null;
  const endClock = parts[1] != null ? readClock(parts[1]) : null;
  if (parts[1] != null && !endClock) return null;
  // "4:20 - 9:00 PM": the start borrows the end's AM/PM.
  const start = readClock(parts[0], endClock && endClock.meridiem);
  if (!start) return null;
  return {
    hour: start.hour,
    minute: start.minute,
    end: endClock ? { hour: endClock.hour, minute: endClock.minute } : null,
    zone,
    zoneLabel,
  };
}

const HOUR = 3600000;
// With no end time, a slot stays current for three hours after it was due.
const GRACE_MS = 3 * HOUR;
const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const WEEKDAY_NAMES = Object.keys(WEEKDAYS);

const toMs = (now) => (now instanceof Date ? now.getTime() : now);

const formatters = new Map();
function formatter(key, options) {
  if (!formatters.has(key)) formatters.set(key, new Intl.DateTimeFormat('en-US', options));
  return formatters.get(key);
}

function parts(fmt, ms) {
  const out = {};
  for (const { type, value } of fmt.formatToParts(new Date(ms))) out[type] = value;
  return out;
}

// The wall clock in `zone` (undefined: the viewer's own) at instant `ms`.
function wall(ms, zone) {
  const p = parts(
    formatter(`wall:${zone}`, {
      timeZone: zone,
      hourCycle: 'h23',
      weekday: 'short',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    }),
    ms
  );
  return {
    y: Number(p.year),
    m: Number(p.month) - 1,
    d: Number(p.day),
    hour: Number(p.hour) % 24,
    minute: Number(p.minute),
    second: Number(p.second),
    weekday: WEEKDAYS[p.weekday],
  };
}

// The instant `zone`'s clock reads y-m-d hour:minute. Days may overflow the
// month; the second pass settles daylight saving changes.
function zonedInstant(zone, y, m, d, hour, minute) {
  const target = Date.UTC(y, m, d, hour, minute);
  const offset = (ms) => {
    const w = wall(ms, zone);
    return Date.UTC(w.y, w.m, w.d, w.hour, w.minute, w.second) - Math.floor(ms / 1000) * 1000;
  };
  const guess = target - offset(target);
  return target - offset(guess);
}

// This entry's showing that hasn't ended yet: { start, end } in ms. A time
// that doesn't read covers its whole day.
function occurrence(entry, now) {
  const target = DAY_INDEX[entry.day];
  if (target == null) return null;
  const slot = parseSlotTime(entry.time);
  const zone = slot ? slot.zone : HOME_ZONE;
  const today = wall(now, zone);
  const delta = (target - today.weekday + 7) % 7;
  // Last week's showing first: an overnight slot from yesterday may still run.
  for (const days of [delta - 7, delta, delta + 7]) {
    const d = today.d + days;
    let start;
    let end;
    if (!slot) {
      start = zonedInstant(zone, today.y, today.m, d, 0, 0);
      end = zonedInstant(zone, today.y, today.m, d + 1, 0, 0);
    } else {
      start = zonedInstant(zone, today.y, today.m, d, slot.hour, slot.minute);
      end = start + GRACE_MS;
      if (slot.end) {
        end = zonedInstant(zone, today.y, today.m, d, slot.end.hour, slot.end.minute);
        if (end <= start) end = zonedInstant(zone, today.y, today.m, d + 1, slot.end.hour, slot.end.minute);
      }
    }
    if (end > now) return { entry, slot, start, end };
  }
  return null;
}

// The slot the guide leads with: { entry, slot, start, end, phase, timeKnown },
// or null when nothing is on. phase is 'upcoming', 'late' (due, no end yet) or
// 'today' (a time that doesn't read, on its day).
export function upNext(schedule, now) {
  if (!Array.isArray(schedule)) return null;
  const nowMs = toMs(now);
  let best = null;
  for (const entry of schedule) {
    if (!entry || entry.status === 'off') continue;
    const occ = occurrence(entry, nowMs);
    if (occ && (!best || occ.start < best.start)) best = occ;
  }
  if (!best) return null;
  const timeKnown = !!best.slot;
  let phase = 'upcoming';
  if (best.start <= nowMs) phase = timeKnown ? 'late' : 'today';
  return { entry: best.entry, slot: best.slot, start: new Date(best.start), end: new Date(best.end), phase, timeKnown };
}

// Today's weekday in Arizona (0 is Sunday): the schedule's days are Goofer's.
export function homeWeekday(now) {
  return wall(toMs(now), HOME_ZONE).weekday;
}

// The calendar day an instant falls on in `zone`, as a day count. Only the
// difference between two of these means anything.
export function calendarDay(now, zone) {
  const w = wall(toMs(now), zone);
  return Date.UTC(w.y, w.m, w.d) / 86400000;
}

// The week as a TV guide reads it: today (in Arizona) first, then onward.
export function rollingWeek(schedule, now) {
  if (!Array.isArray(schedule)) return [];
  const today = homeWeekday(now);
  const position = (e) => (DAY_INDEX[e.day] - today + 7) % 7;
  return schedule.filter((e) => e && DAY_INDEX[e.day] != null).sort((a, b) => position(a) - position(b));
}

// "3d 5h" / "17h 36m" / "12m" / "<1m"
export function untilLabel(ms) {
  const total = Math.floor(ms / 60000);
  if (total < 1) return '<1m';
  const d = Math.floor(total / 1440);
  const h = Math.floor((total % 1440) / 60);
  const m = total % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}

// "11:00 AM". Newer ICU puts a narrow no-break space before AM/PM.
export function formatClock(date, zone) {
  return formatter(`clock:${zone}`, { timeZone: zone, hour: 'numeric', minute: '2-digit' })
    .format(date)
    .replace(/\s/g, ' ');
}

// The zone's short name at that instant ("CDT", "GMT+1").
export function zoneName(date, zone) {
  return parts(formatter(`zone:${zone}`, { timeZone: zone, timeZoneName: 'short' }), date.getTime()).timeZoneName;
}

// The slot's start on the viewer's clock: "1:00 PM", or "Tue 2:00 AM" when
// their day isn't the slot's. null when both clocks read the same.
export function viewerClock(start, slotZone, viewerZone) {
  const there = wall(start.getTime(), slotZone);
  const here = wall(start.getTime(), viewerZone);
  if (there.d === here.d && there.hour === here.hour && there.minute === here.minute) return null;
  const day = here.weekday !== there.weekday ? `${WEEKDAY_NAMES[here.weekday]} ` : '';
  return `${day}${formatClock(start, viewerZone)}`;
}

// Minutes on the viewer's clock, counted from the midnight that starts the
// slot's day there; a slot that lands on their next day runs past 1440.
export function clockMinutes(date, slotZone, viewerZone) {
  const there = wall(date.getTime(), slotZone);
  const here = wall(date.getTime(), viewerZone);
  const days = (Date.UTC(here.y, here.m, here.d) - Date.UTC(there.y, there.m, there.d)) / 86400000;
  return days * 1440 + here.hour * 60 + here.minute;
}

// viewerClock with the viewer's zone ("1:00 PM CDT", "Tue 2:00 AM EDT").
export function localTimeLabel(start, slotZone, viewerZone) {
  const clock = viewerClock(start, slotZone, viewerZone);
  return clock && `${clock} ${zoneName(start, viewerZone)}`;
}
