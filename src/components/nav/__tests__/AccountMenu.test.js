import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AccountMenu from '../AccountMenu';
import { useTwitchAuth } from '../../../contexts/TwitchAuthContext';

jest.mock('../../../contexts/TwitchAuthContext', () => ({ useTwitchAuth: jest.fn() }));

const loginWithTwitch = jest.fn();
const logout = jest.fn();

function arm(over) {
  useTwitchAuth.mockReturnValue({ twitchUser: null, loading: false, loginWithTwitch, logout, ...over });
}

const renderMenu = () => render(<MemoryRouter><AccountMenu /></MemoryRouter>);

beforeEach(() => arm({}));

test('nothing while Twitch auth is loading', () => {
  arm({ loading: true });
  const { container } = renderMenu();
  expect(container.innerHTML).toBe('');
});

test('signed out: the On Air viewer Sign in button', () => {
  renderMenu();
  const btn = screen.getByRole('button', { name: 'Sign in' });
  expect(btn.className).toContain('from-onair-viewer');
  fireEvent.click(btn);
  expect(loginWithTwitch).toHaveBeenCalled();
});

test('signed in: avatar menu with account, store and sign out', () => {
  arm({ twitchUser: { displayName: 'vonbrandt', profileImageUrl: null } });
  renderMenu();
  const trigger = screen.getByRole('button', { name: 'Account: vonbrandt' });
  expect(trigger.textContent).toBe('V');
  // The initial is decoration: the button's label already names the viewer.
  expect(trigger.querySelector('span').getAttribute('aria-hidden')).toBe('true');
  fireEvent.click(trigger);
  expect(screen.getByRole('link', { name: /My account/ }).getAttribute('href')).toBe('/me');
  expect(screen.getByRole('link', { name: /Store/ }).getAttribute('href')).toBe('/store');
  fireEvent.click(screen.getByRole('button', { name: /Sign out/ }));
  expect(logout).toHaveBeenCalled();
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
});
