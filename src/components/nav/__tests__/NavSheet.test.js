import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NavSheet from '../NavSheet';
import { useTwitchAuth } from '../../../contexts/TwitchAuthContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useControlRoom } from '../../../contexts/ControlRoomContext';
import { useSchedule } from '../../../hooks/useSchedule';

jest.mock('../../../contexts/TwitchAuthContext', () => ({ useTwitchAuth: jest.fn() }));
jest.mock('../../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../../contexts/ControlRoomContext', () => ({ useControlRoom: jest.fn() }));
jest.mock('../../../hooks/useSchedule', () => ({ useSchedule: jest.fn() }));

const onClose = jest.fn();
const loginWithTwitch = jest.fn();
const panelOpen = jest.fn();

beforeEach(() => {
  useTwitchAuth.mockReturnValue({ twitchUser: null, loading: false, loginWithTwitch, logout: jest.fn() });
  useAuth.mockReturnValue({ logout: jest.fn() });
  useControlRoom.mockReturnValue({ enabled: true, giveaway: null, panelActions: { toggle: jest.fn(), open: panelOpen } });
  useSchedule.mockReturnValue({ schedule: [] });
  document.body.style.overflow = '';
});

function renderSheet(path, props = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <NavSheet id="sheet" open onClose={onClose} isLive={false} viewerCount={null} statusReady isAdmin={false} isStaff={false} {...props} />
    </MemoryRouter>
  );
}

const sheet = () => document.getElementById('sheet');

test('closed: inert and hidden from assistive tech', () => {
  renderSheet('/', { open: false });
  expect(sheet().hasAttribute('inert')).toBe(true);
  expect(sheet().getAttribute('aria-hidden')).toBe('true');
  expect(screen.queryByRole('link', { name: /Schedule/ })).toBeNull();
});

const closeButton = () => within(sheet()).getByRole('button', { name: 'Close menu' });

test('open: focus moves in, scroll locks, Escape and the scrim close it', () => {
  renderSheet('/');
  expect(sheet().hasAttribute('inert')).toBe(false);
  expect(sheet().contains(document.activeElement)).toBe(true);
  expect(document.body.style.overflow).toBe('hidden');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onClose).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByTestId('nav-scrim'));
  expect(onClose).toHaveBeenCalledTimes(2);
});

test('closing restores body scroll', () => {
  const { rerender } = renderSheet('/');
  rerender(
    <MemoryRouter initialEntries={['/']}>
      <NavSheet id="sheet" open={false} onClose={onClose} isLive={false} viewerCount={null} statusReady isAdmin={false} isStaff={false} />
    </MemoryRouter>
  );
  expect(document.body.style.overflow).toBe('');
});

test('channel rows with codes; Gamba goes to the hub and always lists its subchannels', () => {
  renderSheet('/gamba/hunts');
  const s = within(sheet());
  expect(s.getByRole('link', { name: /02\s*Schedule/ }).getAttribute('href')).toBe('/schedule');
  const gamba = s.getByRole('link', { name: /04\s*Gamba/ });
  expect(gamba.getAttribute('href')).toBe('/gamba');
  expect(gamba.getAttribute('aria-current')).toBe('true');
  const hunts = s.getByRole('link', { name: /4-2\s*Hunts/ });
  expect(hunts.getAttribute('aria-current')).toBe('page');
  expect(hunts.textContent).toContain('Now');
  expect(s.getByRole('link', { name: /4-0\s*Hub/ }).getAttribute('href')).toBe('/gamba');
});

test('signed out: Sign in with Twitch at the top', () => {
  renderSheet('/');
  fireEvent.click(within(sheet()).getByRole('button', { name: 'Sign in' }));
  expect(loginWithTwitch).toHaveBeenCalled();
});

test('staff get the operator section; the admin also gets Admin', () => {
  const { unmount } = renderSheet('/', { isStaff: true });
  fireEvent.click(within(sheet()).getByRole('button', { name: /Control room/ }));
  expect(panelOpen).toHaveBeenCalled();
  expect(onClose).toHaveBeenCalled();
  expect(within(sheet()).queryByRole('link', { name: /Admin/ })).toBeNull();
  unmount();
  renderSheet('/', { isStaff: true, isAdmin: true });
  expect(within(sheet()).getByRole('link', { name: /AD\s*Admin/ }).getAttribute('href')).toBe('/admin');
  expect(within(sheet()).getByText('Signed in · Admin')).toBeTruthy();
});

const focusables = () => Array.from(sheet().querySelectorAll('a[href], button:not([disabled])'));

test('Tab and Shift+Tab wrap inside the open sheet', () => {
  renderSheet('/');
  const list = focusables();
  list[list.length - 1].focus();
  fireEvent.keyDown(document, { key: 'Tab' });
  expect(document.activeElement).toBe(list[0]);
  fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
  expect(document.activeElement).toBe(list[list.length - 1]);
});

test('a Close button comes first, takes focus on open and closes the sheet', () => {
  renderSheet('/', { isStaff: true, isAdmin: true });
  const close = closeButton();
  expect(focusables()[0]).toBe(close);
  // Focus lands on Close, never on the admin Sign out (Enter would sign out).
  expect(document.activeElement).toBe(close);
  expect(close.className).toContain('min-h-11');
  expect(close.className).toContain('min-w-11');
  expect(close.querySelector('svg').getAttribute('aria-hidden')).toBe('true');
  fireEvent.click(close);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('Tab from the last element wraps to the Close button', () => {
  renderSheet('/', { isStaff: true, isAdmin: true });
  const list = focusables();
  list[list.length - 1].focus();
  fireEvent.keyDown(document, { key: 'Tab' });
  expect(document.activeElement).toBe(closeButton());
});

test('the channel list is a Channels landmark inside the dialog', () => {
  renderSheet('/');
  const channels = within(sheet()).getByRole('navigation', { name: 'Channels' });
  expect(within(channels).getByRole('link', { name: /02\s*Schedule/ })).toBeTruthy();
  expect(within(channels).getByRole('link', { name: /4-2\s*Hunts/ })).toBeTruthy();
});

test('every row closes the sheet, even the page you are on', () => {
  renderSheet('/gamba/hunts', { isStaff: true, isAdmin: true });
  const s = within(sheet());
  fireEvent.click(s.getByRole('link', { name: /4-2\s*Hunts/ }));
  expect(onClose).toHaveBeenCalledTimes(1);
  fireEvent.click(s.getByRole('link', { name: /01\s*Home/ }));
  expect(onClose).toHaveBeenCalledTimes(2);
  fireEvent.click(s.getByRole('link', { name: /AD\s*Admin/ }));
  expect(onClose).toHaveBeenCalledTimes(3);
});

test('on /gamba only the Hub row is the current page; Gamba is the section', () => {
  renderSheet('/gamba');
  const pages = Array.from(sheet().querySelectorAll('a[aria-current="page"]'));
  expect(pages).toHaveLength(1);
  expect(pages[0].textContent).toMatch(/4-0\s*Hub/);
  expect(within(sheet()).getByRole('link', { name: /04\s*Gamba/ }).getAttribute('aria-current')).toBe('true');
});

test('the Admin row is the page on /admin and the section deeper in', () => {
  const { unmount } = renderSheet('/admin', { isStaff: true, isAdmin: true });
  expect(within(sheet()).getByRole('link', { name: /AD\s*Admin/ }).getAttribute('aria-current')).toBe('page');
  unmount();
  renderSheet('/admin/hunts', { isStaff: true, isAdmin: true });
  expect(within(sheet()).getByRole('link', { name: /AD\s*Admin/ }).getAttribute('aria-current')).toBe('true');
});

test('signed-in viewer: identity block, Account link, Sign out closes the sheet', () => {
  const logout = jest.fn();
  useTwitchAuth.mockReturnValue({
    twitchUser: { displayName: 'Viewer1', profileImage: null },
    loading: false,
    loginWithTwitch,
    logout,
  });
  renderSheet('/');
  const s = within(sheet());
  expect(s.getByText('Viewer1')).toBeTruthy();
  expect(s.getByText('Signed in · Twitch')).toBeTruthy();
  const account = s.getByRole('link', { name: 'Account' });
  expect(account.getAttribute('href')).toBe('/me');
  expect(account.className).toContain('min-h-11');
  fireEvent.click(account);
  expect(onClose).toHaveBeenCalledTimes(1);
  const out = s.getByRole('button', { name: 'Sign out' });
  expect(out.className).toContain('min-h-11');
  fireEvent.click(out);
  expect(logout).toHaveBeenCalled();
  expect(onClose).toHaveBeenCalled();
});

test('top-level rows and the Control room row set at 17px (on the scale)', () => {
  renderSheet('/', { isStaff: true });
  const s = within(sheet());
  const schedule = s.getByRole('link', { name: /02\s*Schedule/ });
  expect(schedule.className).toContain('text-[1.0625rem]');
  expect(schedule.className).not.toContain('text-base');
  const room = s.getByRole('button', { name: /Control room/ });
  expect(room.className).toContain('text-[1.0625rem]');
  expect(room.className).not.toContain('text-base');
});

test('row codes track at 0.15em', () => {
  renderSheet('/');
  const code = within(sheet()).getByText('02');
  expect(code.className).toContain('tracking-[0.15em]');
});
