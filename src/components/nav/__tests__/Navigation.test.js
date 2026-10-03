import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Navigation from '../Navigation';
import { useTwitchAuth } from '../../../contexts/TwitchAuthContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useControlRoom } from '../../../contexts/ControlRoomContext';
import { useSchedule } from '../../../hooks/useSchedule';

jest.mock('../../../contexts/TwitchAuthContext', () => ({ useTwitchAuth: jest.fn() }));
jest.mock('../../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../../contexts/ControlRoomContext', () => ({ useControlRoom: jest.fn() }));
jest.mock('../../../hooks/useSchedule', () => ({ useSchedule: jest.fn() }));

const VIEWER = { displayName: 'vonbrandt', profileImageUrl: null };

function arm({ twitchUser = null, currentUser = null, isStaff = false } = {}) {
  useTwitchAuth.mockReturnValue({ twitchUser, loading: false, loginWithTwitch: jest.fn(), logout: jest.fn() });
  useAuth.mockReturnValue({ currentUser, isStaff, logout: jest.fn() });
  useControlRoom.mockReturnValue({ enabled: isStaff, giveaway: null, panelActions: { toggle: jest.fn(), open: jest.fn() } });
  useSchedule.mockReturnValue({ schedule: [{ day: 'MONDAY', time: '5:00 PM - 11:00 PM EST', status: 'regular' }] });
}

function renderAt(path, props = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Navigation isLive={false} viewerCount={null} statusReady {...props} />
      <Routes>
        <Route path="/admin" element={<p>admin page</p>} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>
  );
}

const bar = () => screen.getByRole('navigation', { name: 'Site' });
const menuButton = () => screen.getByRole('button', { name: /^(Open|Close) menu$/ });

beforeEach(() => arm());

test('eight coded channels; Home is the current page on /', () => {
  renderAt('/');
  const links = within(bar()).getAllByRole('link').filter((a) => /^0\d/.test(a.textContent));
  expect(links.map((a) => a.textContent)).toEqual([
    '01Home', '02Schedule', '03Vods', '04Gamba', '05Gaming', '06Store', '07Giveaway', '08About',
  ]);
  expect(links[0].getAttribute('aria-current')).toBe('page');
});

test('inside /gamba the Gamba link is the current section', () => {
  renderAt('/gamba/hunts');
  expect(within(bar()).getByRole('link', { name: /^04\s*Gamba$/ }).getAttribute('aria-current')).toBe('true');
});

test('identity: signed out, viewer, staff, admin', () => {
  const { unmount } = renderAt('/');
  expect(within(bar()).getByRole('button', { name: 'Sign in' })).toBeTruthy();
  unmount();

  arm({ twitchUser: VIEWER });
  const second = renderAt('/');
  expect(within(bar()).getByRole('button', { name: 'Account: vonbrandt' })).toBeTruthy();
  expect(within(bar()).queryByRole('button', { name: /Control room/ })).toBeNull();
  second.unmount();

  arm({ twitchUser: VIEWER, isStaff: true });
  const third = renderAt('/');
  expect(within(bar()).getByRole('button', { name: /Control room/ })).toBeTruthy();
  expect(within(bar()).getByRole('button', { name: 'Account: vonbrandt' })).toBeTruthy();
  third.unmount();

  arm({ currentUser: { email: 'luimeneghim@gmail.com' }, isStaff: true });
  renderAt('/');
  expect(within(bar()).getByRole('button', { name: /Control room/ })).toBeTruthy();
  expect(within(bar()).getByRole('button', { name: 'OP: operator menu' })).toBeTruthy();
  expect(within(bar()).queryByRole('button', { name: /Account:/ })).toBeNull();
});

test('no live or off-air status until the first poll succeeds', () => {
  renderAt('/schedule', { statusReady: false, isLive: true, viewerCount: 50 });
  expect(screen.queryByText(/Live/)).toBeNull();
  expect(screen.queryByText(/Off air/)).toBeNull();
  expect(document.querySelector('[data-led]').className).not.toContain('shadow-onair-led');
});

test('live: the LED glows and the tally shows', () => {
  renderAt('/schedule', { isLive: true, viewerCount: 1204 });
  expect(document.querySelector('[data-led]').className).toContain('shadow-onair-led');
  expect(within(bar()).getByRole('link', { name: 'Live now, 1,204 watching' })).toBeTruthy();
});

test('the menu button opens the sheet; navigating closes it and returns focus', () => {
  renderAt('/');
  const sheet = document.getElementById(menuButton().getAttribute('aria-controls'));
  expect(sheet.hasAttribute('inert')).toBe(true);
  fireEvent.click(menuButton());
  expect(menuButton().getAttribute('aria-expanded')).toBe('true');
  expect(sheet.hasAttribute('inert')).toBe(false);
  fireEvent.click(within(sheet).getByRole('link', { name: /02\s*Schedule/ }));
  expect(menuButton().getAttribute('aria-expanded')).toBe('false');
  expect(sheet.hasAttribute('inert')).toBe(true);
  expect(document.activeElement).toBe(menuButton());
  expect(document.body.style.overflow).toBe('');
});

test('five quick clicks on the wordmark open /admin', () => {
  renderAt('/');
  const mark = screen.getByRole('link', { name: 'GooferG home' });
  for (let i = 0; i < 5; i += 1) fireEvent.click(mark);
  expect(screen.getByText('admin page')).toBeTruthy();
});

test('no orange in the nav, for any identity', () => {
  arm({ currentUser: { email: 'luimeneghim@gmail.com' }, isStaff: true });
  const { container } = renderAt('/', { isLive: true, viewerCount: 9 });
  fireEvent.click(menuButton());
  expect(container.innerHTML).not.toMatch(/orange|onair-winner/);
});
