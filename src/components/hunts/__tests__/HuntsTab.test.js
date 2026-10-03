import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  expect(screen.getByText('−$375.70')).toBeTruthy();
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

test('suggestions render when the round accepts them', () => {
  const fx = HUNT_FIXTURES.open;
  render(<HuntsTab {...fx} round={{ ...fx.round, acceptSuggestions: true }} onSignIn={() => {}} />);
  expect(screen.getByText('suggest form')).toBeTruthy();
  expect(screen.getByText('suggest list')).toBeTruthy();
});
