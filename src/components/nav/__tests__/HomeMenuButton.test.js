import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
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

const setup = (props = {}, entry = '/') =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <HomeMenuButton statusReady {...props} />
    </MemoryRouter>
  );
const button = () => screen.getByRole('button', { name: /^Menu/ });

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
  expect(button().getAttribute('aria-label')).toBe('Menu, on air');
  live.unmount();
  const off = setup({ isLive: false });
  expect(button().querySelector('[data-led]')).toBeNull();
  off.unmount();
  setup({ isLive: true, statusReady: false });
  expect(button().querySelector('[data-led]')).toBeNull();
});

test('inside the TV (live and watching) the button steps out of the way', () => {
  setup({ isLive: true }, { pathname: '/', state: { watch: true } });
  expect(screen.queryByRole('button', { name: /^Menu/ })).toBeNull();
});

test('a watch flag on an off-air channel is stale: the button stays', () => {
  setup({ isLive: false }, { pathname: '/', state: { watch: true } });
  expect(button()).toBeTruthy();
});

test('leaving the TV brings the button back', () => {
  function Leave() {
    const navigate = useNavigate();
    return <button onClick={() => navigate('/', { state: null })}>leave</button>;
  }
  render(
    <MemoryRouter initialEntries={[{ pathname: '/', state: { watch: true } }]}>
      <HomeMenuButton statusReady isLive />
      <Leave />
    </MemoryRouter>
  );
  expect(screen.queryByRole('button', { name: /^Menu/ })).toBeNull();
  fireEvent.click(screen.getByText('leave'));
  expect(button()).toBeTruthy();
});

test('going inside the TV closes the sheet, so it never comes back open', () => {
  function Watch() {
    const navigate = useNavigate();
    return (
      <>
        <button onClick={() => navigate('/', { state: { watch: true } })}>watch</button>
        <button onClick={() => navigate('/', { state: null })}>leave</button>
      </>
    );
  }
  render(
    <MemoryRouter initialEntries={['/']}>
      <HomeMenuButton statusReady isLive />
      <Watch />
    </MemoryRouter>
  );
  fireEvent.click(button());
  expect(button().getAttribute('aria-expanded')).toBe('true');
  fireEvent.click(screen.getByText('watch'));
  expect(screen.queryByRole('button', { name: /^Menu/ })).toBeNull();
  fireEvent.click(screen.getByText('leave'));
  expect(button().getAttribute('aria-expanded')).toBe('false');
  expect(document.getElementById(button().getAttribute('aria-controls')).hasAttribute('inert')).toBe(true);
});

