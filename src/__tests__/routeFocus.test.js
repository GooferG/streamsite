import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { titleFor } from '../routes/pageTitles';

const { SHARE_PAGES } = require('../../scripts/share/pages');

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
// Home links to the tapes; with a flag set it puts focus on a field of its own
// as it mounts, or opens a modal dialog portaled outside #main (like the
// rental counter) and focuses that.
let mockHomeFocuses = false;
let mockHomeModal = false;
jest.mock('../pages/HomePage', () => () => {
  const { Link } = require('react-router-dom');
  const { createPortal } = require('react-dom');
  return (
    <div>
      <Link to="/vods">to the tapes</Link>
      {mockHomeFocuses && <input aria-label="find" autoFocus />}
      {mockHomeModal &&
        createPortal(
          <div role="dialog" aria-modal="true" aria-label="Rental counter">
            <button type="button" autoFocus>
              Put it back
            </button>
          </div>,
          global.document.body
        )}
    </div>
  );
});
jest.mock('../pages/GambaPage', () => () => null);
jest.mock('../routes/loaders', () => {
  const { Link, useNavigate } = require('react-router-dom');
  function Vods() {
    const nav = useNavigate();
    return (
      <div>
        <p>vods page</p>
        <Link to="/">home</Link>
        <button type="button" onClick={() => nav(-1)}>
          back
        </button>
      </div>
    );
  }
  return {
    PAGE_LOADERS: {
      schedule: () => Promise.resolve({ default: () => null }),
      vods: () => Promise.resolve({ default: Vods }),
      about: () => Promise.resolve({ default: () => null }),
      gaming: () => Promise.resolve({ default: () => null }),
      store: () => Promise.resolve({ default: () => null }),
      giveaway: () => Promise.resolve({ default: () => null }),
    },
  };
});

// Only the known noise: the failing Twitch poll logs its error and two debug lines.
const KNOWN = /Error initializing Twitch API|App\.js Debug/;
beforeEach(() => {
  mockHomeFocuses = false;
  mockHomeModal = false;
  window.scrollTo = jest.fn();
  for (const method of ['error', 'log']) {
    const real = console[method];
    jest.spyOn(console, method).mockImplementation((...args) => {
      if (!KNOWN.test(String(args[0]))) real(...args);
    });
  }
});
afterEach(() => jest.restoreAllMocks());

const main = () => document.getElementById('main');

test('a new page takes focus on #main and names the tab', async () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>
  );
  expect(await screen.findByText('to the tapes')).toBeTruthy();
  expect(document.title).toBe('GooferG');
  // The first page load is not a page change.
  expect(document.activeElement).not.toBe(main());
  fireEvent.click(screen.getByText('to the tapes'), { button: 0 });
  expect(document.activeElement).toBe(main());
  expect(await screen.findByText('vods page')).toBeTruthy();
  expect(document.activeElement).toBe(main());
  expect(document.title).toBe('Vods · GooferG');
});

test('Back does not move focus to #main (the page it returns to decides)', async () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>
  );
  fireEvent.click(await screen.findByText('to the tapes'), { button: 0 });
  const back = await screen.findByRole('button', { name: 'back' });
  back.focus();
  await act(async () => {
    fireEvent.click(back);
  });
  expect(await screen.findByText('to the tapes')).toBeTruthy();
  expect(document.activeElement).not.toBe(main());
  expect(document.title).toBe('GooferG');
});

test('a page that puts focus somewhere itself keeps it', async () => {
  render(
    <MemoryRouter initialEntries={['/vods']}>
      <App />
    </MemoryRouter>
  );
  mockHomeFocuses = true;
  fireEvent.click(await screen.findByRole('link', { name: 'home' }), { button: 0 });
  expect(await screen.findByText('to the tapes')).toBeTruthy();
  expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'find' }));
});

test('a modal dialog the new page opened keeps its focus', async () => {
  render(
    <MemoryRouter initialEntries={['/vods']}>
      <App />
    </MemoryRouter>
  );
  mockHomeModal = true;
  fireEvent.click(await screen.findByRole('link', { name: 'home' }), { button: 0 });
  expect(await screen.findByText('to the tapes')).toBeTruthy();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Put it back' }));
});

describe('titleFor', () => {
  test('every page with a share card has the same title in the tab', () => {
    for (const p of SHARE_PAGES) expect(titleFor(p.path)).toBe(p.title);
  });

  test('pages without a card', () => {
    expect(titleFor('/me')).toBe('Account · GooferG');
    expect(titleFor('/terms')).toBe('Terms · GooferG');
    expect(titleFor('/admin')).toBe('Admin · GooferG');
    expect(titleFor('/admin/hunts')).toBe('Admin · GooferG');
    expect(titleFor('/battle/usr_1')).toBe('Bonus Battle · GooferG');
    expect(titleFor('/gamba/hunts/')).toBe('Hunts · GooferG');
    expect(titleFor('/nowhere')).toBe('GooferG');
  });
});
