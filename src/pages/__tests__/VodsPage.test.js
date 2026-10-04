import { fireEvent, render, screen } from '@testing-library/react';
import VodsPage from '../VodsPage';
import { LIVE_TOP_CLIPS, LIVE_VIDEOS } from '../../components/vods/videoStoreFixtures';

jest.mock('../../contexts/TwitchAuthContext', () => ({
  useTwitchAuth: () => ({ twitchUser: { displayName: 'larrymenta' } }),
}));
jest.mock('../../components/vods/useRecentClips', () => ({
  __esModule: true,
  default: () => [],
}));

const renderPage = () =>
  render(<VodsPage videos={LIVE_VIDEOS} clips={LIVE_TOP_CLIPS} loading={false} isLive={false} statusReady />);

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

test("renders App's tapes on the Goofer Video floor, with the viewer's own clips", () => {
  window.history.replaceState(null, '', '/vods');
  renderPage();
  expect(screen.getByRole('heading', { level: 1, name: 'Goofer Video' })).toBeTruthy();
  expect(screen.getAllByRole('button', { name: /^Win Wednesdays/ })).toHaveLength(2);
  expect(screen.getByText('Picked by you')).toBeTruthy();
});

test('opening a tape writes ?tape=, closing clears it', () => {
  window.history.replaceState(null, '', '/vods');
  renderPage();
  fireEvent.click(screen.getAllByRole('button', { name: /^Win Wednesdays/ })[0]);
  expect(new URLSearchParams(window.location.search).get('tape')).toBe('2889109731');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(window.location.search).toBe('');
});

test('a ?tape= link opens the counter', () => {
  window.history.replaceState(null, '', '/vods?tape=2888141530');
  renderPage();
  expect(screen.getByRole('dialog', { name: 'Win Wednesdays' })).toBeTruthy();
});

test('?fixture= renders a fixture outside production', () => {
  window.history.replaceState(null, '', '/vods?fixture=empty');
  renderPage();
  expect(screen.getByRole('heading', { level: 2, name: 'Shelves are empty.' })).toBeTruthy();
});
