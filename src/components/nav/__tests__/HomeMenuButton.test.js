import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomeMenuButton from '../HomeMenuButton';
import { useTwitchAuth } from '../../../contexts/TwitchAuthContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useControlRoom } from '../../../contexts/ControlRoomContext';
import { useSchedule } from '../../../hooks/useSchedule';

jest.mock('../../../contexts/TwitchAuthContext', () => ({ useTwitchAuth: jest.fn() }));
jest.mock('../../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../../contexts/ControlRoomContext', () => ({ useControlRoom: jest.fn() }));
jest.mock('../../../hooks/useSchedule', () => ({ useSchedule: jest.fn() }));

beforeEach(() => {
  useTwitchAuth.mockReturnValue({ twitchUser: null, loading: false, loginWithTwitch: jest.fn(), logout: jest.fn() });
  useAuth.mockReturnValue({ currentUser: null, isStaff: false, logout: jest.fn() });
  useControlRoom.mockReturnValue({ enabled: false, giveaway: null, panelActions: { toggle: jest.fn(), open: jest.fn() } });
  useSchedule.mockReturnValue({ schedule: [] });
  document.body.style.overflow = '';
});

const setup = (props = {}) =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <HomeMenuButton statusReady {...props} />
    </MemoryRouter>
  );
const button = () => screen.getByRole('button', { name: 'Menu' });

test('opens the site sheet; aria-expanded flips and points at the sheet', () => {
  setup();
  const sheet = document.getElementById(button().getAttribute('aria-controls'));
  expect(button().getAttribute('aria-expanded')).toBe('false');
  expect(sheet.hasAttribute('inert')).toBe(true);
  fireEvent.click(button());
  expect(button().getAttribute('aria-expanded')).toBe('true');
  expect(sheet.hasAttribute('inert')).toBe(false);
  expect(within(sheet).getByRole('link', { name: /Schedule/ })).toBeTruthy();
});

test('the sheet is not hidden at lg and covers the full height', () => {
  setup();
  fireEvent.click(button());
  const sheet = document.getElementById(button().getAttribute('aria-controls'));
  expect(sheet.className).not.toContain('lg:hidden');
  expect(sheet.style.top).toBe('0px');
  expect(screen.getByTestId('nav-scrim').className).not.toContain('lg:hidden');
});

test('Escape and Close return focus to the button', () => {
  setup();
  fireEvent.click(button());
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(button().getAttribute('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(button());
  fireEvent.click(button());
  fireEvent.click(screen.getByRole('button', { name: 'Close menu' }));
  expect(document.activeElement).toBe(button());
});

test('the on-air dot shows only when live and the status is ready', () => {
  const live = setup({ isLive: true });
  expect(button().querySelector('[data-led]')).not.toBeNull();
  expect(within(button()).getByText('On air')).toBeTruthy();
  live.unmount();
  const off = setup({ isLive: false });
  expect(button().querySelector('[data-led]')).toBeNull();
  off.unmount();
  setup({ isLive: true, statusReady: false });
  expect(button().querySelector('[data-led]')).toBeNull();
});
