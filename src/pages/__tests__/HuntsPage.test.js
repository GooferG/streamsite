import { render, screen, waitFor } from '@testing-library/react';
import { onSnapshot } from 'firebase/firestore';
import HuntsPage from '../HuntsPage';

jest.mock('../../config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: (db, ...path) => ({ path: path.join('/') }),
  doc: (db, ...path) => ({ path: path.join('/') }),
  query: (ref) => ref,
  orderBy: () => ({}),
  limit: () => ({}),
  where: () => ({}),
  onSnapshot: jest.fn(),
}));
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ isStaff: false }) }));
jest.mock('../../contexts/TwitchAuthContext', () => ({
  useTwitchAuth: () => ({ twitchUser: null, loginWithTwitch: () => {} }),
}));

const ARCHIVED = { id: 'h1', status: 'archived', huntType: 'solo', currency: 'ARS', bonusCount: 48, pot: 150000, totalWon: 84221.4, averageMultiple: 20, endedAt: '2026-09-24T23:06:49.441Z' };

function roundSnapshot(round) {
  onSnapshot.mockImplementation((ref, next) => {
    if (ref.path === 'hunts') {
      next(round ? { empty: false, docs: [{ id: round.id, data: () => round }] } : { empty: true, docs: [] });
    }
    return () => {};
  });
}

function overview(body, ok = true) {
  global.fetch = jest.fn(() => Promise.resolve({ ok, status: ok ? 200 : 502, json: () => Promise.resolve(body) }));
}

beforeEach(() => onSnapshot.mockReset());

test('off air shows the last hunt and keeps the promo band', async () => {
  roundSnapshot(null);
  overview({ live: null, recent: [ARCHIVED] });
  render(<HuntsPage />);
  await waitFor(() => expect(screen.getAllByText(/Last hunt/i).length).toBeGreaterThan(0));
  expect(screen.getByLabelText('communityhunts.gg')).toBeTruthy();
});

// API down: the off-air screen and the promo band still render.
test('API failure keeps the off-air screen and the promo band', async () => {
  roundSnapshot(null);
  overview({ error: 'UPSTREAM_UNAVAILABLE' }, false);
  render(<HuntsPage />);
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Nothing on right now' })).toBeTruthy());
  expect(screen.getByLabelText('communityhunts.gg')).toBeTruthy();
});

test('an open round shows sealed rows and never queries entries', async () => {
  roundSnapshot({ id: 'r1', title: 'Sunday hunt', status: 'open', acceptPredictions: true, entryCount: 5, source: 'manual', manualTotalCost: 1000 });
  overview({ live: null, recent: [] });
  render(<HuntsPage />);
  await waitFor(() => expect(screen.getAllByTestId('face-down-row')).toHaveLength(5));
  const paths = onSnapshot.mock.calls.map(([ref]) => ref.path);
  expect(paths).not.toContain('hunts/r1/entries');
  expect(screen.queryByTestId('onair-static')).toBeNull();
});
