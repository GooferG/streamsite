import {
  clockMinutes,
  formatClock,
  homeWeekday,
  localTimeLabel,
  parseSlotTime,
  rollingWeek,
  untilLabel,
  upNext,
} from '../scheduleTime';

describe('parseSlotTime', () => {
  test.each([
    ['11:00 AM AZ', { hour: 11, minute: 0, end: null, zone: 'America/Phoenix', zoneLabel: 'AZ' }],
    ['5:00 PM EST', { hour: 17, minute: 0, end: null, zone: 'America/New_York', zoneLabel: 'EST' }],
    ['9:30 AM MST', { hour: 9, minute: 30, end: null, zone: 'America/Phoenix', zoneLabel: 'MST' }],
    ['4:20 PM - 9:00 PM EST', { hour: 16, minute: 20, end: { hour: 21, minute: 0 }, zone: 'America/New_York', zoneLabel: 'EST' }],
    ['4:20 PM – 11:00 PM CST', { hour: 16, minute: 20, end: { hour: 23, minute: 0 }, zone: 'America/Chicago', zoneLabel: 'CST' }],
    ['12:00 AM PST', { hour: 0, minute: 0, end: null, zone: 'America/Los_Angeles', zoneLabel: 'PST' }],
    ['12:30 PM AZ', { hour: 12, minute: 30, end: null, zone: 'America/Phoenix', zoneLabel: 'AZ' }],
    ['5:00 pm est', { hour: 17, minute: 0, end: null, zone: 'America/New_York', zoneLabel: 'EST' }],
    ['7 PM', { hour: 19, minute: 0, end: null, zone: 'America/Phoenix', zoneLabel: 'AZ' }],
  ])('reads %p', (text, want) => {
    expect(parseSlotTime(text)).toEqual(want);
  });

  test.each([['OFF'], [''], ['TBD'], ['Evening-ish'], [undefined], [null], ['25:00 PM AZ']])(
    'gives up on %p',
    (text) => {
      expect(parseSlotTime(text)).toBeNull();
    }
  );
});

// The live settings/schedule doc as of 2026-10-04.
const LIVE = [
  { day: 'MONDAY', time: '11:00 AM AZ', status: 'on', content: 'Slots', gameName: 'Bonus Hunt Time!' },
  { day: 'TUESDAY', time: '5:00 PM AZ', status: 'on', content: 'Slots', gameName: 'Freestyle Chilling' },
  { day: 'WEDNESDAY', time: '5:00 PM EST', status: 'off', content: 'Gaming - Contraband Police', gameName: 'Contraband Police' },
  { day: 'THURSDAY', time: '11:00 AM AZ', status: 'on', content: 'Slots', gameName: 'Group Bonus Hunt' },
  { day: 'FRY-DAY', time: '11:00 AM AZ', status: 'on', content: 'Slots', gameName: '5 Scat Hunt' },
  { day: 'SATURDAY', time: '9:30 AM MST', status: 'off', content: '', gameName: '' },
  { day: 'SUNDAY', time: '2:30 PM AZ', status: 'off', content: '', gameName: '' },
];

const at = (iso) => new Date(iso).getTime();
const summary = (next) => next && { day: next.entry.day, start: next.start.toISOString(), phase: next.phase, timeKnown: next.timeKnown };

describe('upNext', () => {
  test('Sunday noon in Arizona: Monday 11 AM AZ is next', () => {
    expect(summary(upNext(LIVE, at('2026-10-04T19:00:00Z')))).toEqual({
      day: 'MONDAY',
      start: '2026-10-05T18:00:00.000Z',
      phase: 'upcoming',
      timeKnown: true,
    });
  });

  test('half an hour past the start with no end time, the slot is running late', () => {
    expect(summary(upNext(LIVE, at('2026-10-05T19:30:00Z')))).toMatchObject({ day: 'MONDAY', phase: 'late' });
  });

  test('three hours past an open-ended start, the guide moves on to Tuesday', () => {
    expect(summary(upNext(LIVE, at('2026-10-05T21:30:00Z')))).toMatchObject({
      day: 'TUESDAY',
      start: '2026-10-07T00:00:00.000Z',
      phase: 'upcoming',
    });
  });

  test('Eastern times follow daylight saving', () => {
    const monday = [{ day: 'MONDAY', time: '5:00 PM EST', status: 'on' }];
    expect(upNext(monday, at('2026-10-04T19:00:00Z')).start.toISOString()).toBe('2026-10-05T21:00:00.000Z');
    expect(upNext(monday, at('2026-12-06T19:00:00Z')).start.toISOString()).toBe('2026-12-07T22:00:00.000Z');
  });

  test('a slot with an end time stays current until it ends, past the three hour grace', () => {
    const wednesday = [{ day: 'WEDNESDAY', time: '4:20 PM - 9:00 PM EST', status: 'regular' }];
    expect(summary(upNext(wednesday, at('2026-10-08T00:30:00Z')))).toMatchObject({
      start: '2026-10-07T20:20:00.000Z',
      phase: 'late',
    });
    expect(summary(upNext(wednesday, at('2026-10-08T01:30:00Z')))).toMatchObject({
      start: '2026-10-14T20:20:00.000Z',
      phase: 'upcoming',
    });
  });

  test('an end before the start runs past midnight', () => {
    const saturday = [{ day: 'SATURDAY', time: '8:00 PM - 2:00 AM AZ', status: 'special' }];
    expect(summary(upNext(saturday, at('2026-10-04T08:00:00Z')))).toMatchObject({
      start: '2026-10-04T03:00:00.000Z',
      phase: 'late',
    });
  });

  test("once this week's only slot is over, next week's comes up", () => {
    const monday = [{ day: 'MONDAY', time: '11:00 AM AZ', status: 'on' }];
    expect(upNext(monday, at('2026-10-05T22:00:00Z')).start.toISOString()).toBe('2026-10-12T18:00:00.000Z');
  });

  test("the day is read in the slot's zone (Sunday evening in Arizona is Monday in UTC)", () => {
    const sunday = [{ day: 'SUNDAY', time: '9:00 PM AZ', status: 'on' }];
    expect(upNext(sunday, at('2026-10-05T03:00:00Z')).start.toISOString()).toBe('2026-10-05T04:00:00.000Z');
  });

  test('FRY-DAY is Friday', () => {
    const fry = [{ day: 'FRY-DAY', time: '11:00 AM AZ', status: 'on' }];
    expect(upNext(fry, at('2026-10-04T19:00:00Z')).start.toISOString()).toBe('2026-10-09T18:00:00.000Z');
  });

  test('a time that does not read keeps its day, without a countdown', () => {
    const tuesday = [{ day: 'TUESDAY', time: 'TBD', status: 'on' }];
    expect(summary(upNext(tuesday, at('2026-10-04T19:00:00Z')))).toEqual({
      day: 'TUESDAY',
      start: '2026-10-06T07:00:00.000Z',
      phase: 'upcoming',
      timeKnown: false,
    });
    expect(summary(upNext(tuesday, at('2026-10-06T20:00:00Z')))).toMatchObject({ day: 'TUESDAY', phase: 'today' });
  });

  test('off days are skipped, and an empty or dark week has nothing next', () => {
    expect(upNext(LIVE.map((e) => ({ ...e, status: 'off' })), at('2026-10-04T19:00:00Z'))).toBeNull();
    expect(upNext([], at('2026-10-04T19:00:00Z'))).toBeNull();
    expect(upNext(undefined, at('2026-10-04T19:00:00Z'))).toBeNull();
  });
});

describe('rollingWeek', () => {
  const days = (now) => rollingWeek(LIVE, at(now)).map((e) => e.day);

  test('starts at today in Arizona and wraps', () => {
    expect(days('2026-10-04T19:00:00Z')).toEqual(['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRY-DAY', 'SATURDAY']);
    expect(days('2026-10-07T19:00:00Z')).toEqual(['WEDNESDAY', 'THURSDAY', 'FRY-DAY', 'SATURDAY', 'SUNDAY', 'MONDAY', 'TUESDAY']);
  });

  test('Sunday evening in Arizona is still Sunday', () => {
    expect(days('2026-10-05T03:00:00Z')[0]).toBe('SUNDAY');
    expect(homeWeekday(at('2026-10-05T03:00:00Z'))).toBe(0);
  });
});

describe('labels', () => {
  test.each([
    [3 * 86400000 + 5 * 3600000 + 20 * 60000, '3d 5h'],
    [17 * 3600000 + 36 * 60000, '17h 36m'],
    [12 * 60000 + 59000, '12m'],
    [30000, '<1m'],
  ])('untilLabel(%p) is %p', (ms, want) => {
    expect(untilLabel(ms)).toBe(want);
  });

  test('formatClock reads the wall clock in a zone', () => {
    expect(formatClock(new Date('2026-10-05T18:00:00Z'), 'America/Phoenix')).toBe('11:00 AM');
  });

  test.each([
    ['2026-10-05T18:00:00Z', 'America/Chicago', '1:00 PM CDT'],
    ['2026-10-06T06:00:00Z', 'America/New_York', 'Tue 2:00 AM EDT'],
    ['2026-10-05T18:00:00Z', 'Europe/London', '7:00 PM GMT+1'],
    ['2026-10-05T18:00:00Z', 'America/Phoenix', null],
    ['2026-12-07T18:00:00Z', 'America/Denver', null],
  ])('a Phoenix slot at %p reads %p for a viewer in %p', (iso, viewerZone, want) => {
    expect(localTimeLabel(new Date(iso), 'America/Phoenix', viewerZone)).toBe(want);
  });
});

describe('clockMinutes', () => {
  // Monday 11 AM in Arizona, counted on the viewer's clock from the midnight
  // that starts Arizona's Monday.
  test.each([
    ['2026-10-05T18:00:00Z', 'America/Chicago', 13 * 60],
    ['2026-10-05T18:00:00Z', 'America/Phoenix', 11 * 60],
    ['2026-10-05T18:00:00Z', 'Asia/Tokyo', 24 * 60 + 3 * 60],
    ['2026-10-05T08:00:00Z', 'Pacific/Honolulu', 22 * 60 - 24 * 60],
  ])('%p reads as minute %p for a viewer in %p', (iso, viewerZone, want) => {
    expect(clockMinutes(new Date(iso), 'America/Phoenix', viewerZone)).toBe(want);
  });
});
