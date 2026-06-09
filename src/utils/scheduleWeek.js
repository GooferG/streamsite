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
