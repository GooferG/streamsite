import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import StatusReadout, { PowerLed } from '../StatusReadout';
import { useSchedule } from '../../../hooks/useSchedule';

jest.mock('../../../hooks/useSchedule', () => ({ useSchedule: jest.fn() }));

const MONDAY_ONLY = [{ day: 'MONDAY', time: '5:00 PM - 11:00 PM EST', status: 'regular' }];

beforeEach(() => {
  useSchedule.mockReturnValue({ schedule: MONDAY_ONLY });
});

function renderAt(path, props) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <StatusReadout {...props} />
    </MemoryRouter>
  );
}

test('nothing before the first Twitch poll succeeds', () => {
  const { container } = renderAt('/schedule', { isLive: false, viewerCount: null, statusReady: false });
  expect(container.innerHTML).toBe('');
  expect(useSchedule).not.toHaveBeenCalled();
});

test('live: a tally linking to the player with the count from xl', () => {
  renderAt('/schedule', { isLive: true, viewerCount: 1204, statusReady: true });
  const link = screen.getByRole('link', { name: 'Live now, 1,204 watching' });
  expect(link.getAttribute('href')).toBe('/');
  expect(link.textContent).toMatch(/Live\s·\s1\.2K/);
  expect(screen.getByText(/1\.2K/).className).toContain('hidden xl:inline');
  expect(useSchedule).not.toHaveBeenCalled();
});

test('live with zero or unknown viewers reads plain LIVE', () => {
  const { rerender } = renderAt('/schedule', { isLive: true, viewerCount: 0, statusReady: true });
  expect(screen.getByRole('link', { name: 'Live now' }).textContent).toBe('Live');
  rerender(
    <MemoryRouter initialEntries={['/schedule']}>
      <StatusReadout isLive viewerCount={null} statusReady />
    </MemoryRouter>
  );
  expect(screen.getByRole('link', { name: 'Live now' }).textContent).toBe('Live');
});

test('live is a link home, named with the viewer count', () => {
  renderAt('/schedule', { isLive: true, viewerCount: 1204, statusReady: true });
  const link = screen.getByRole('link', { name: 'Live now, 1,204 watching' });
  expect(link.getAttribute('href')).toBe('/');
});

test('off air: the next stream, linking to the schedule, from lg in the bar', () => {
  const { container } = renderAt('/', { isLive: false, viewerCount: null, statusReady: true });
  const link = screen.getByRole('link', { name: /Off air\s·\sMON 5:00 PM EST/ });
  expect(link.getAttribute('href')).toBe('/schedule');
  expect(container.firstChild.className).toContain('hidden lg:inline-flex');
});

test('off air in the bar: the time shows from 2xl and is always in the name', () => {
  renderAt('/', { isLive: false, viewerCount: null, statusReady: true });
  const time = screen.getByText(/MON 5:00 PM EST/);
  // Visually "Off air" below 2xl; screen readers still hear the time.
  expect(time.className).toContain('sr-only 2xl:not-sr-only');
  expect(time.className).not.toMatch(/\bhidden\b/);
  expect(time.className).not.toContain('xl:inline');
});

test('off air in the sheet shows at every width', () => {
  const { container } = renderAt('/', { isLive: false, viewerCount: null, statusReady: true, variant: 'sheet' });
  // No responsive `hidden` class anywhere (aria-hidden on the dot doesn't count).
  expect(container.innerHTML).not.toMatch(/class="[^"]*\bhidden\b/);
});

test('a week of days off reads OFF AIR with no time', () => {
  useSchedule.mockReturnValue({ schedule: [{ day: 'MONDAY', time: '5:00 PM', status: 'off' }] });
  renderAt('/', { isLive: false, viewerCount: null, statusReady: true, variant: 'sheet' });
  expect(screen.getByRole('link', { name: 'Off air' }).textContent).toBe('Off air');
});

test('the power LED is set dressing that glows only live', () => {
  const { container, rerender } = render(<PowerLed live />);
  const led = container.querySelector('[data-led]');
  expect(led.getAttribute('aria-hidden')).toBe('true');
  expect(led.className).toContain('shadow-onair-led');
  rerender(<PowerLed live={false} />);
  expect(container.querySelector('[data-led]').className).not.toContain('shadow-onair-led');
});
