import {
  WEEK_ORDER,
  DAY_INDEX,
  dayAbbrev,
  dayDisplay,
  orderByWeek,
  nextScheduledStream,
  nextStreamLabel,
} from '../scheduleWeek';

describe('scheduleWeek', () => {
  test('WEEK_ORDER runs Monday through Sunday', () => {
    expect(WEEK_ORDER).toEqual([
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRY-DAY',
      'SATURDAY',
      'SUNDAY',
    ]);
  });

  test('DAY_INDEX maps days to JS getDay() numbers, incl. FRY-DAY and FRIDAY', () => {
    expect(DAY_INDEX.SUNDAY).toBe(0);
    expect(DAY_INDEX.MONDAY).toBe(1);
    expect(DAY_INDEX.THURSDAY).toBe(4);
    expect(DAY_INDEX['FRY-DAY']).toBe(5);
    expect(DAY_INDEX.FRIDAY).toBe(5);
    expect(DAY_INDEX.SATURDAY).toBe(6);
  });

  test('dayAbbrev abbreviates, with FRY-DAY -> FRI', () => {
    expect(dayAbbrev('MONDAY')).toBe('MON');
    expect(dayAbbrev('FRY-DAY')).toBe('FRI');
    expect(dayAbbrev('SUNDAY')).toBe('SUN');
  });

  test('dayDisplay gives title-case label, FRY-DAY -> Fry', () => {
    expect(dayDisplay('MONDAY')).toBe('Mon');
    expect(dayDisplay('FRY-DAY')).toBe('Fry');
    expect(dayDisplay('SATURDAY')).toBe('Sat');
  });

  test('orderByWeek sorts a schedule into Mon->Sun order', () => {
    const input = [
      { day: 'WEDNESDAY' },
      { day: 'MONDAY' },
      { day: 'SUNDAY' },
    ];
    expect(orderByWeek(input).map((d) => d.day)).toEqual([
      'MONDAY',
      'WEDNESDAY',
      'SUNDAY',
    ]);
  });

  test('orderByWeek returns [] for empty/nullish input', () => {
    expect(orderByWeek([])).toEqual([]);
    expect(orderByWeek(null)).toEqual([]);
    expect(orderByWeek(undefined)).toEqual([]);
  });
});

describe('nextScheduledStream', () => {
  // 3 Oct 2026 is a Saturday.
  const SAT = new Date(2026, 9, 3, 12);
  const entry = (day, status = 'regular', time = '5:00 PM - 11:00 PM EST') => ({ day, status, time });

  test('the fixture date is a Saturday', () => {
    expect(SAT.getDay()).toBe(6);
  });

  test("returns today's stream when today is scheduled", () => {
    const sat = entry('SATURDAY');
    expect(nextScheduledStream([entry('MONDAY'), sat], SAT)).toBe(sat);
  });

  test('skips off days and wraps into next week', () => {
    const mon = entry('MONDAY');
    expect(nextScheduledStream([entry('SATURDAY', 'off'), entry('SUNDAY', 'off'), mon], SAT)).toBe(mon);
  });

  test('matches FRY-DAY six days ahead', () => {
    const fri = entry('FRY-DAY', 'special');
    expect(nextScheduledStream([fri], SAT)).toBe(fri);
  });

  test('null for an empty schedule or a week of days off', () => {
    expect(nextScheduledStream([], SAT)).toBeNull();
    expect(nextScheduledStream(null, SAT)).toBeNull();
    expect(nextScheduledStream([entry('MONDAY', 'off'), entry('SATURDAY', 'off')], SAT)).toBeNull();
  });
});

describe('nextStreamLabel', () => {
  test('day, range start and zone', () => {
    expect(nextStreamLabel({ day: 'MONDAY', time: '5:00 PM - 11:00 PM EST' })).toBe('MON 5:00 PM EST');
  });

  test('no zone when the range has none (AM/PM is not a zone)', () => {
    expect(nextStreamLabel({ day: 'MONDAY', time: '5:00 PM - 11:00 PM' })).toBe('MON 5:00 PM');
  });

  test('a single time that already carries its zone', () => {
    expect(nextStreamLabel({ day: 'THURSDAY', time: '9 PM EST' })).toBe('THU 9 PM EST');
  });

  test('FRY-DAY reads FRI', () => {
    expect(nextStreamLabel({ day: 'FRY-DAY', time: '8:00 PM - 12:00 AM EST' })).toBe('FRI 8:00 PM EST');
  });

  test('day only without a time; null without a stream', () => {
    expect(nextStreamLabel({ day: 'MONDAY', time: '' })).toBe('MON');
    expect(nextStreamLabel({ day: 'MONDAY' })).toBe('MON');
    expect(nextStreamLabel(null)).toBeNull();
  });
});
