import { gridLayout, guideRows, showTitle } from '../scheduleModel';
import { upNext } from '../../../utils/scheduleTime';
import { LIVE_SCHEDULE } from '../scheduleFixtures';

const at = (iso) => new Date(iso).getTime();

function rowsAt(iso, { schedule = LIVE_SCHEDULE, timeZone = 'America/Chicago', isLive = false, liveTitle } = {}) {
  const now = at(iso);
  return guideRows({ schedule, now, next: upNext(schedule, now), isLive, timeZone, liveTitle });
}

describe('showTitle', () => {
  test.each([
    [{ content: 'Slots', gameName: 'Bonus Hunt Time!' }, { title: 'Bonus Hunt Time!', category: 'Slots' }],
    [{ content: 'Variety Gaming', gameName: null }, { title: 'Variety Gaming', category: null }],
    [{ content: 'Arc Raiders', gameName: 'arc raiders' }, { title: 'arc raiders', category: null }],
    [{ content: '', gameName: '' }, { title: null, category: null }],
  ])('%p reads as %p', (entry, want) => {
    expect(showTitle(entry)).toEqual(want);
  });
});

describe('guideRows', () => {
  test('Sunday noon in Arizona, viewed from Chicago', () => {
    const rows = rowsAt('2026-10-04T19:00:00Z');
    expect(rows.map((r) => [r.day, r.label, r.state])).toEqual([
      ['SUNDAY', 'Today', 'off'],
      ['MONDAY', 'Tomorrow', 'next'],
      ['TUESDAY', 'Tuesday', 'later'],
      ['WEDNESDAY', 'Wednesday', 'off'],
      ['THURSDAY', 'Thursday', 'later'],
      ['FRY-DAY', 'Fry-day', 'later'],
      ['SATURDAY', 'Saturday', 'off'],
    ]);
    expect(rows[1]).toMatchObject({
      code: 'MON',
      badge: 'Up next',
      time: { primary: '1:00 PM', secondary: '11:00 AM AZ' },
      title: 'Bonus Hunt Time!',
      category: 'Slots',
    });
    expect(rows[0].time).toEqual({ primary: 'Off air', secondary: null });
  });

  test('a viewer in Arizona gets one time per row', () => {
    expect(rowsAt('2026-10-04T19:00:00Z', { timeZone: 'America/Phoenix' })[1].time).toEqual({
      primary: '11:00 AM',
      secondary: null,
    });
  });

  test('a viewer whose clock is on the next day sees that day', () => {
    expect(rowsAt('2026-10-04T19:00:00Z', { timeZone: 'Asia/Tokyo' })[1].time).toEqual({
      primary: 'Tue 3:00 AM',
      secondary: '11:00 AM AZ',
    });
  });

  test("today's slot is marked aired once it's over, and the next one lights", () => {
    const rows = rowsAt('2026-10-05T22:00:00Z');
    expect(rows[0]).toMatchObject({ day: 'MONDAY', label: 'Today', state: 'aired', badge: 'Aired' });
    expect(rows[1]).toMatchObject({ day: 'TUESDAY', state: 'next', badge: 'Up next' });
  });

  test('a slot that is due reads running late, or on now once the channel is live', () => {
    expect(rowsAt('2026-10-05T19:30:00Z')[0].badge).toBe('Running late');
    expect(rowsAt('2026-10-05T19:30:00Z', { isLive: true })[0]).toMatchObject({ state: 'live', badge: 'On now' });
  });

  test("while live, today's row stays on now past the three hour grace, and the next slot is unlit", () => {
    const rows = rowsAt('2026-10-05T21:30:00Z', { isLive: true });
    expect(rows[0]).toMatchObject({ day: 'MONDAY', state: 'live', badge: 'On now' });
    expect(rows[1]).toMatchObject({ day: 'TUESDAY', state: 'later', badge: 'Up next' });
  });

  test('a stream on an off day puts the stream on today', () => {
    const rows = rowsAt('2026-10-04T19:00:00Z', { isLive: true, liveTitle: 'Surprise stream' });
    expect(rows[0]).toMatchObject({ day: 'SUNDAY', state: 'live', badge: 'On now', title: 'Surprise stream' });
    expect(rows[0].time).toEqual({ primary: 'Live now', secondary: null });
  });

  test("today and tomorrow follow the viewer's calendar", () => {
    // 12:30 AM Tuesday in New York is still Monday evening in Arizona.
    const rows = rowsAt('2026-10-06T04:30:00Z', { timeZone: 'America/New_York' });
    expect(rows.map((r) => [r.day, r.label])).toEqual([
      ['MONDAY', 'Monday'],
      ['TUESDAY', 'Today'],
      ['WEDNESDAY', 'Tomorrow'],
      ['THURSDAY', 'Thursday'],
      ['FRY-DAY', 'Fry-day'],
      ['SATURDAY', 'Saturday'],
      ['SUNDAY', 'Sunday'],
    ]);
    expect(rows[0].state).toBe('aired');
  });

  test("a time that doesn't read is shown as typed, a blank one as TBA", () => {
    const schedule = [
      { day: 'TUESDAY', time: 'After lunch', status: 'on', content: 'Slots' },
      { day: 'THURSDAY', time: '', status: 'on', content: 'Slots' },
    ];
    const rows = rowsAt('2026-10-04T19:00:00Z', { schedule });
    expect(rows.map((r) => r.time)).toEqual([
      { primary: 'After lunch', secondary: null },
      { primary: 'Time TBA', secondary: null },
    ]);
  });

  test('special days carry the flag', () => {
    const schedule = [{ day: 'MONDAY', time: '7:00 PM AZ', status: 'special', content: 'Movie night' }];
    expect(rowsAt('2026-10-04T19:00:00Z', { schedule })[0].special).toBe(true);
  });
});

describe('gridLayout', () => {
  function layoutAt(iso, { schedule = LIVE_SCHEDULE, timeZone = 'America/Chicago' } = {}) {
    const now = at(iso);
    const rows = guideRows({ schedule, now, next: upNext(schedule, now), timeZone });
    return gridLayout({ rows, now, timeZone });
  }

  test('the window runs an hour either side of the week, on the viewer clock', () => {
    // Chicago: the 11 AM AZ slots start at 1 PM, Tuesday's open-ended 5 PM AZ
    // runs 7 to 10 PM. So noon to 11 PM.
    const layout = layoutAt('2026-10-04T19:00:00Z');
    expect([layout.from, layout.to]).toEqual([12 * 60, 23 * 60]);
    expect(layout.ticks.map((t) => t.label)).toEqual([
      '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM', '7 PM', '8 PM', '9 PM', '10 PM',
    ]);
    expect(layout.ticks[1].left).toBeCloseTo((60 / 660) * 100);
  });

  test('blocks sit at their start; one without an end runs three hours, open', () => {
    const { blocks } = layoutAt('2026-10-04T19:00:00Z');
    expect(blocks.MONDAY.left).toBeCloseTo((60 / 660) * 100);
    expect(blocks.MONDAY.width).toBeCloseTo((180 / 660) * 100);
    expect(blocks.MONDAY.openEnd).toBe(true);
    expect(blocks.TUESDAY.left).toBeCloseTo((420 / 660) * 100);
    expect(blocks.WEDNESDAY).toBeUndefined();
  });

  test('a typed end time sets the block length', () => {
    const schedule = [{ day: 'WEDNESDAY', time: '4:20 PM - 9:00 PM EST', status: 'on', content: 'Gaming' }];
    const layout = layoutAt('2026-10-04T19:00:00Z', { schedule, timeZone: 'America/New_York' });
    expect([layout.from, layout.to]).toEqual([15 * 60, 22 * 60]);
    expect(layout.blocks.WEDNESDAY.left).toBeCloseTo((80 / 420) * 100);
    expect(layout.blocks.WEDNESDAY.width).toBeCloseTo((280 / 420) * 100);
    expect(layout.blocks.WEDNESDAY.openEnd).toBe(false);
  });

  test('a short week still spans six hours', () => {
    const schedule = [{ day: 'MONDAY', time: '11:00 AM AZ', status: 'on', content: 'Slots' }];
    const layout = layoutAt('2026-10-04T19:00:00Z', { schedule, timeZone: 'America/Phoenix' });
    expect([layout.from, layout.to]).toEqual([10 * 60, 16 * 60]);
  });

  test('with nothing to place, the window is ten to ten', () => {
    const schedule = LIVE_SCHEDULE.map((e) => ({ ...e, status: 'off' }));
    const layout = layoutAt('2026-10-04T19:00:00Z', { schedule });
    expect([layout.from, layout.to]).toEqual([10 * 60, 22 * 60]);
    expect(layout.blocks).toEqual({});
  });

  test('the now line sits on the viewer clock, and only inside the window', () => {
    // Sunday noon in Arizona is 2 PM in Chicago.
    expect(layoutAt('2026-10-04T19:00:00Z').now).toBeCloseTo((120 / 660) * 100);
    // 8 AM in Arizona is before a 10 AM window.
    expect(layoutAt('2026-10-04T15:00:00Z', { timeZone: 'America/Phoenix' }).now).toBeNull();
  });
});
