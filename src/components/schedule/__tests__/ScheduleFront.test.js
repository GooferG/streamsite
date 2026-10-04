import { render, screen, within } from '@testing-library/react';
import ScheduleFront from '../ScheduleFront';
import { LIVE_SCHEDULE } from '../scheduleFixtures';

const at = (iso) => new Date(iso).getTime();
const SUNDAY_NOON_AZ = at('2026-10-04T19:00:00Z');
const MONDAY_LATE = at('2026-10-05T19:30:00Z');

function renderFront(props = {}) {
  return render(
    <ScheduleFront schedule={LIVE_SCHEDULE} now={SUNDAY_NOON_AZ} timeZone="America/Chicago" {...props} />
  );
}

const promo = () => within(screen.getByRole('region', { name: 'Now and next' }));
const guideRows = () => within(screen.getByRole('list', { name: 'This week' })).getAllByRole('listitem');

test('the promo counts down to the next slot on both clocks', () => {
  renderFront();
  expect(promo().getByRole('heading', { name: 'Bonus Hunt Time!' })).toBeTruthy();
  expect(promo().getByText('On in')).toBeTruthy();
  expect(promo().getByText('23h 0m')).toBeTruthy();
  expect(promo().getByText('Mon 11:00 AM AZ')).toBeTruthy();
  expect(promo().getByText('1:00 PM CDT your time')).toBeTruthy();
});

test('a viewer in Arizona gets no second clock', () => {
  renderFront({ timeZone: 'America/Phoenix' });
  expect(promo().queryByText(/your time/)).toBeNull();
});

test("the station clock reads the viewer's time and Goofer's", () => {
  renderFront();
  expect(screen.getByTestId('station-clock').textContent).toBe('2:00 PM');
  expect(screen.getByText("Goofer's clock 12:00 PM AZ")).toBeTruthy();
});

test('the grid runs seven days from today, with the next slot lit', () => {
  renderFront();
  const rows = guideRows();
  expect(rows).toHaveLength(7);
  expect(within(rows[0]).getByText('Today')).toBeTruthy();
  expect(within(rows[0]).getByText('Off air')).toBeTruthy();
  expect(within(rows[1]).getByText('Tomorrow')).toBeTruthy();
  expect(within(rows[1]).getByText('Up next')).toBeTruthy();
  expect(within(rows[1]).getByText('1:00 PM')).toBeTruthy();
  expect(rows[1].querySelector('[data-lit="signal"]')).not.toBeNull();
  expect(rows[2].querySelector('[data-lit]')).toBeNull();
});

test("the now line runs on today's row only", () => {
  renderFront();
  const rows = guideRows();
  expect(rows[0].querySelector('[data-now]')).not.toBeNull();
  expect(rows[1].querySelector('[data-now]')).toBeNull();
});

test('without a cover the promo shows the category card', () => {
  renderFront();
  expect(promo().getByTestId('show-ident').textContent).toContain('Slots');
});

test('with a cover the promo shows it', () => {
  renderFront({ covers: { 'Bonus Hunt Time!': 'https://images.igdb.com/cover.jpg' } });
  expect(promo().getByTestId('show-cover').getAttribute('src')).toBe('https://images.igdb.com/cover.jpg');
});

test('past the start and not live, the slot is running late', () => {
  renderFront({ now: MONDAY_LATE });
  expect(promo().getByText('Any minute')).toBeTruthy();
  expect(promo().getByText('Was due 11:00 AM AZ')).toBeTruthy();
  expect(promo().getByText('1:00 PM CDT your time')).toBeTruthy();
  expect(within(guideRows()[0]).getByText('Running late')).toBeTruthy();
});

test('live, the promo carries the Twitch stream and a watch link', () => {
  renderFront({
    now: MONDAY_LATE,
    isLive: true,
    stream: { title: 'Forty bonuses deep', game_name: 'Slots', thumbnail_url: null },
  });
  expect(promo().getByText('Live')).toBeTruthy();
  expect(promo().getByRole('heading', { name: 'Forty bonuses deep' })).toBeTruthy();
  expect(promo().getByRole('link', { name: 'Watch on Twitch' }).getAttribute('href')).toBe('https://twitch.tv/GooferG');
  expect(within(guideRows()[0]).getByText('On now')).toBeTruthy();
});

test('a dark week says so and lights nothing', () => {
  renderFront({ schedule: LIVE_SCHEDULE.map((e) => ({ ...e, status: 'off' })) });
  expect(promo().getByText('Signal dark')).toBeTruthy();
  expect(screen.queryByText('Up next')).toBeNull();
});

test('while loading the promo tunes in and there is no grid', () => {
  renderFront({ loading: true });
  expect(promo().getByText('Tuning in…')).toBeTruthy();
  expect(screen.queryByRole('list', { name: 'This week' })).toBeNull();
});

test("a time that doesn't read has no countdown", () => {
  renderFront({ schedule: [{ day: 'TUESDAY', time: 'After lunch', status: 'on', content: 'Slots', gameName: 'Hunt' }] });
  expect(promo().queryByText('On in')).toBeNull();
  expect(promo().getByText('Tuesday')).toBeTruthy();
  expect(promo().getByText('After lunch')).toBeTruthy();
});

test("a stream that runs past three hours stays on now in the grid", () => {
  renderFront({ now: at('2026-10-05T21:30:00Z'), isLive: true, stream: { title: 'Still going' } });
  const today = within(guideRows()[0]);
  expect(today.getByText('On now')).toBeTruthy();
  expect(today.queryByText('Aired')).toBeNull();
});

test("when the live schedule didn't load, the guide says it is showing the usual week", () => {
  renderFront({ stale: true });
  expect(screen.getByText("Showing the usual week. The live schedule didn't load.")).toBeTruthy();
});
