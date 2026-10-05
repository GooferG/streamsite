import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

jest.mock('../contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({ currentUser: null, isStaff: false, logout: jest.fn() }),
}));
jest.mock('../contexts/TwitchAuthContext', () => ({
  TwitchAuthProvider: ({ children }) => children,
  useTwitchAuth: () => ({ twitchUser: null, loading: false, loginWithTwitch: jest.fn(), logout: jest.fn() }),
}));
jest.mock('../contexts/ControlRoomContext', () => ({
  ControlRoomProvider: ({ children }) => children,
  useControlRoom: () => ({ enabled: false, giveaway: null, panelActions: { toggle: jest.fn(), open: jest.fn() } }),
}));
jest.mock('../hooks/useSchedule', () => ({ useSchedule: () => ({ schedule: [] }) }));
jest.mock('../utils/twitchApi', () => ({
  dropTwitchToken: jest.fn(),
  getTwitchAccessToken: () => Promise.reject(new Error('offline')),
}));
jest.mock('../utils/introMode', () => ({
  introModeFor: () => 'none',
  readIntroFlags: () => ({}),
  markPowered: jest.fn(),
  markSessionPlayed: jest.fn(),
}));
jest.mock('../components/controlRoom/StaffLayer', () => () => null);
jest.mock('../components/GrainOverlay', () => () => null);
jest.mock('../components/SiteFooter', () => () => null);
jest.mock('../components/camera/CameraProvider', () => ({ children }) => children);
// Home notes #main's class as it first mounts, before any effect can change it.
let mockMainAtMount = null;
jest.mock('../pages/HomePage', () => {
  const { useLayoutEffect } = require('react');
  return function MockHome() {
    useLayoutEffect(() => {
      const main = global.document.getElementById('main');
      mockMainAtMount = main ? main.className : null;
    }, []);
    return <p>home page</p>;
  };
});
jest.mock('../pages/GambaPage', () => () => null);
jest.mock('../routes/loaders', () => ({
  PAGE_LOADERS: {
    schedule: () => Promise.resolve({ default: () => null }),
    vods: () => Promise.resolve({ default: () => <p>vods page</p> }),
    about: () => Promise.resolve({ default: () => null }),
    gaming: () => Promise.resolve({ default: () => null }),
    store: () => Promise.resolve({ default: () => null }),
    giveaway: () => Promise.resolve({ default: () => null }),
  },
}));

// Only the known noise: the failing Twitch poll logs its error and two debug lines.
const KNOWN = /Error initializing Twitch API|App\.js Debug/;
beforeEach(() => {
  for (const method of ['error', 'log']) {
    const real = console[method];
    jest.spyOn(console, method).mockImplementation((...args) => {
      if (!KNOWN.test(String(args[0]))) real(...args);
    });
  }
});
afterEach(() => jest.restoreAllMocks());

test('home has no bar: a Menu button stands in, and it is the first thing to tab to', async () => {
  render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);
  expect(await screen.findByText('home page')).toBeTruthy();
  expect(screen.queryByRole('navigation', { name: 'Site' })).toBeNull();
  const menu = screen.getByRole('button', { name: /^Menu/ });
  expect(document.body.querySelector('a[href], button:not([disabled])')).toBe(menu);
});

test('every other page keeps the bar and has no home button', async () => {
  render(<MemoryRouter initialEntries={['/vods']}><App /></MemoryRouter>);
  expect(await screen.findByText('vods page')).toBeTruthy();
  expect(screen.getByRole('navigation', { name: 'Site' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: /^Menu/ })).toBeNull();
});

test('with no intro the page is up from its first paint, with no fade from black', async () => {
  mockMainAtMount = null;
  render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);
  expect(await screen.findByText('home page')).toBeTruthy();
  expect(mockMainAtMount).toContain('opacity-100');
  expect(mockMainAtMount).not.toContain('opacity-0');
});

