// Shared weekday ordering + labelling for the schedule (admin + public).
// Source of truth for week order — both SchedulePage and AdminSchedulePage import this.

export const DAY_INDEX = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  'FRY-DAY': 5,
  FRIDAY: 5,
  SATURDAY: 6,
};

export const WEEK_ORDER = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRY-DAY',
  'SATURDAY',
  'SUNDAY',
];

export function dayAbbrev(day) {
  if (day === 'FRY-DAY') return 'FRI';
  return day.slice(0, 3);
}

// Title-case short label, e.g. MONDAY -> "Mon", FRY-DAY -> "Fry".
export function dayDisplay(day) {
  const abbr = day === 'FRY-DAY' ? 'FRY' : dayAbbrev(day);
  return abbr.charAt(0) + abbr.slice(1).toLowerCase();
}

export function orderByWeek(schedule) {
  if (!schedule || schedule.length === 0) return [];
  return [...schedule].sort(
    (a, b) => WEEK_ORDER.indexOf(a.day) - WEEK_ORDER.indexOf(b.day)
  );
}

// The next scheduled stream from `now` forward (today included), skipping days
// marked off. Null when nothing is scheduled. Shared by the couch and the nav.
export function nextScheduledStream(schedule, now = new Date()) {
  if (!schedule || schedule.length === 0) return null;
  const today = now.getDay();
  for (let i = 0; i < 7; i += 1) {
    const target = (today + i) % 7;
    const stream = schedule.find((s) => DAY_INDEX[s.day] === target && s.status !== 'off');
    if (stream) return stream;
  }
  return null;
}

// "MON 5:00 PM EST" for the nav's off-air readout: the day, the start of the
// time range and the zone the range ends in (AM/PM is not a zone).
export function nextStreamLabel(stream) {
  if (!stream) return null;
  const day = dayAbbrev(stream.day);
  const time = (stream.time || '').trim();
  if (!time) return day;
  // The range may be written with a hyphen, an en dash or an em dash.
  const start = time.split(/\s*[-–—]\s*/)[0];
  const last = time.split(/\s+/).pop();
  const zone = /^[A-Z]{2,4}$/.test(last) && !/^(AM|PM)$/.test(last) ? last : null;
  return zone && !start.endsWith(zone) ? `${day} ${start} ${zone}` : `${day} ${start}`;
}
