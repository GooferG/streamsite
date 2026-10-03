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
