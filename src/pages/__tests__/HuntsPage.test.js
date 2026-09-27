import { render, screen, waitFor } from '@testing-library/react';
import HuntsPage from '../HuntsPage';

jest.mock('../../config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: () => ({}),
  doc: () => ({}),
  onSnapshot: () => () => {},
  orderBy: () => ({}),
  query: () => ({}),
  limit: () => ({}),
  where: () => ({}),
}));
jest.mock('../../contexts/TwitchAuthContext', () => ({
  useTwitchAuth: () => ({ twitchUser: null, loginWithTwitch: () => {} }),
}));

const ARCHIVED = { id: 'h1', status: 'archived', huntType: 'solo', currency: 'ARS', bonusCount: 48, pot: 150000, totalWon: 84221.4, averageMultiple: 20 };

test('shows the latest hunt card and the promo band', async () => {
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ live: null, recent: [ARCHIVED] }) })
  );
  render(<HuntsPage />);
  await waitFor(() => expect(screen.getByText(/latest hunt/i)).toBeTruthy());
  expect(screen.getByLabelText('communityhunts.gg')).toBeTruthy();
  // The card's hunt is not repeated in the archive list.
  expect(screen.queryByText(/hunt archive/i)).toBeNull();
});

// Review Focus 4: API down → promo still renders, no hunt sections.
test('API failure hides hunt sections but keeps the promo band', async () => {
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: false, status: 502, json: () => Promise.resolve({ error: 'UPSTREAM_UNAVAILABLE' }) })
  );
  const { container } = render(<HuntsPage />);
  // Loading spinner first, then it must disappear once the failed fetch settles.
  expect(container.querySelector('.animate-spin')).toBeTruthy();
  await waitFor(() => expect(container.querySelector('.animate-spin')).toBeNull());
  expect(screen.getByLabelText('communityhunts.gg')).toBeTruthy();
  expect(screen.queryByText(/latest hunt/i)).toBeNull();
  expect(screen.queryByText(/live hunt/i)).toBeNull();
});
