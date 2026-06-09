import {
  WEEK_ORDER,
  DAY_INDEX,
  dayAbbrev,
  dayDisplay,
  orderByWeek,
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
