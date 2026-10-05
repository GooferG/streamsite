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
jest.mock('../pages/HomePage', () => () => <p>home page</p>);
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

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test('home has no bar: a Menu button stands in, and it is the first thing to tab to', async () => {
  render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);
  expect(await screen.findByText('home page')).toBeTruthy();
  expect(screen.queryByRole('navigation', { name: 'Site' })).toBeNull();
  const menu = screen.getByRole('button', { name: 'Menu' });
  expect(document.body.querySelector('a[href], button:not([disabled])')).toBe(menu);
});

test('every other page keeps the bar and has no home button', async () => {
  render(<MemoryRouter initialEntries={['/vods']}><App /></MemoryRouter>);
  expect(await screen.findByText('vods page')).toBeTruthy();
  expect(screen.getByRole('navigation', { name: 'Site' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Menu' })).toBeNull();
});
