import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import HuntsTab from '../HuntsTab';
import { HUNT_FIXTURES } from '../huntFixtures';
import { __resetHuntCacheForTests } from '../useHunt';

jest.mock('../../../config/firebase', () => ({ db: {}, auth: {} }));
// createElement via require: JSX inside a jest.mock factory trips the hoisting
// guard on the injected JSX runtime import.
jest.mock('../../SuggestionSubmit', () => function MockSuggestionSubmit() {
  return require('react').createElement('p', null, 'suggest form');
});
jest.mock('../../SuggestionList', () => function MockSuggestionList() {
  return require('react').createElement('p', null, 'suggest list');
});

beforeEach(() => {
  __resetHuntCacheForTests();
  global.fetch = jest.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({}) }));
});

// Smoke test over every dev fixture: each state renders its key copy and never NaN.
test.each([
  ['open', /Predictions open/i, 'Guesses so far'],
  ['open-staff', /Predictions open/i, 'Guesses so far'],
  ['locked', /Opening bonuses/i, 'Guesses so far'],
  ['settled', /And the closest guess is/i, "Tonight's lineup"],
])('%s fixture renders cleanly', (key, eyebrow, lineup) => {
  const { container } = render(<HuntsTab {...HUNT_FIXTURES[key]} onSignIn={() => {}} />);
  expect(screen.getAllByText(eyebrow).length).toBeGreaterThan(0);
  expect(screen.getByRole('heading', { name: lineup })).toBeTruthy();
  expect(container.textContent).not.toMatch(/NaN|Infinity/);
});

test('the open fixture matches the handoff figures', () => {
  render(<HuntsTab {...HUNT_FIXTURES['open-staff']} onSignIn={() => {}} />);
  expect(screen.getByText('109.1')).toBeTruthy();
  expect(screen.getAllByText('$22.20').length).toBeGreaterThan(0);
});

test('the settled fixture crowns Xilentdrifter and shows the hunt result', () => {
  render(<HuntsTab {...HUNT_FIXTURES.settled} onSignIn={() => {}} />);
  expect(screen.getAllByText('Xilentdrifter').length).toBeGreaterThan(0);
  expect(screen.getByText((_, el) => el.tagName === 'DD' && el.textContent === '−$375.70')).toBeTruthy();
  expect(screen.getByText('Runner-up')).toBeTruthy();
});

test('off air with no round hides the lineup and offers sign-in', () => {
  render(<HuntsTab {...HUNT_FIXTURES.offair} onSignIn={() => {}} />);
  expect(screen.queryByRole('heading', { name: 'Guesses so far' })).toBeNull();
  expect(screen.getAllByText(/Last hunt/i).length).toBeGreaterThan(0);
  expect(screen.getByRole('button', { name: 'Sign in with Twitch' })).toBeTruthy();
});

test('loading shows the tuning screen and no slip', () => {
  render(<HuntsTab {...HUNT_FIXTURES.offair} round={undefined} onSignIn={() => {}} />);
  expect(screen.getByText(/Tuning signal|Warming the tubes|Acquiring feed/)).toBeTruthy();
  expect(screen.queryByRole('region', { name: 'Prediction slip' })).toBeNull();
});

test('choosing a past episode swaps the recap, and back returns to tonight', async () => {
  render(<HuntsTab {...HUNT_FIXTURES.settled} onSignIn={() => {}} />);
  fireEvent.click(screen.getAllByRole('button', { pressed: false }).find((b) => /hunt/i.test(b.textContent) && /SEP/.test(b.textContent)));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Back to tonight' })).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: 'Back to tonight' }));
  expect(screen.getByRole('heading', { name: 'Hunt recap' })).toBeTruthy();
});

// Review: a hunt still running is not a past episode.
test('the live hunt never shows up under past episodes', () => {
  const fx = HUNT_FIXTURES.settled;
  const live = { id: 'fx-live', status: 'live', huntType: 'streamer', currency: null, pot: 500, totalWon: 120, bonuses: [] };
  render(<HuntsTab {...fx} live={live} recent={[live, ...fx.recent]} onSignIn={() => {}} />);
  const episodes = screen.getByRole('region', { name: 'Past episodes' });
  expect(within(episodes).queryByText('Streamer hunt')).toBeNull();
});

// Review: until entries arrive, the board stays face down instead of "no guesses".
test('while revealed entries load, the lineup stays face down with the round count', () => {
  const fx = HUNT_FIXTURES.locked;
  render(<HuntsTab {...fx} entries={[]} entriesLoading onSignIn={() => {}} />);
  expect(screen.queryByText('No guesses this round.')).toBeNull();
  expect(screen.getAllByTestId('face-down-row').length).toBeGreaterThan(0);
  expect(screen.getByText((_, el) => el.tagName === 'SPAN' && el.textContent === '7 guesses')).toBeTruthy();
});

test('a failed round read shows no signal, not an idle channel', () => {
  render(<HuntsTab {...HUNT_FIXTURES.offair} roundError onSignIn={() => {}} />);
  expect(screen.getByRole('heading', { name: 'No signal' })).toBeTruthy();
  expect(screen.queryByText(/Last hunt/i)).toBeNull();
});

// a11y: entries closing and results are announced once, never on first load.
test('mode changes are announced politely, first load is silent', () => {
  const { rerender } = render(<HuntsTab {...HUNT_FIXTURES.open} onSignIn={() => {}} />);
  const announcer = screen.getByTestId('hunt-announcer');
  expect(announcer.getAttribute('aria-live')).toBe('polite');
  expect(announcer.textContent).toBe('');
  rerender(<HuntsTab {...HUNT_FIXTURES.locked} onSignIn={() => {}} />);
  expect(announcer.textContent).toBe('Entries closed. Results land when the last bonus opens.');
  rerender(<HuntsTab {...HUNT_FIXTURES.settled} onSignIn={() => {}} />);
  expect(announcer.textContent).toBe('Results are in. Xilentdrifter wins.');
});

// a11y: the recap swap moves focus to the recap, and back again.
test('choosing an episode and going back both land focus on the recap heading', async () => {
  render(<HuntsTab {...HUNT_FIXTURES.settled} onSignIn={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: /Solo hunt/ }));
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { name: /Solo hunt · SEP 24/ })));
  fireEvent.click(screen.getByRole('button', { name: 'Back to tonight' }));
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Hunt recap' })));
});

// a11y: on phones the slip is second in reading order, not after the lineup.
test('below lg the slip comes right after the monitor in the DOM', () => {
  render(<HuntsTab {...HUNT_FIXTURES.open} onSignIn={() => {}} />);
  const slip = screen.getByRole('region', { name: 'Prediction slip' });
  const lineup = screen.getByRole('heading', { name: 'Guesses so far' });
  expect(slip.compareDocumentPosition(lineup) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test('suggestions render when the round accepts them', () => {
  const fx = HUNT_FIXTURES.open;
  render(<HuntsTab {...fx} round={{ ...fx.round, acceptSuggestions: true }} onSignIn={() => {}} />);
  expect(screen.getByText('suggest form')).toBeTruthy();
  expect(screen.getByText('suggest list')).toBeTruthy();
});
