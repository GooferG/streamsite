import { render, screen, fireEvent } from '@testing-library/react';
import AdminHuntsPage from '../AdminHuntsPage';
import { authedFetch } from '../../utils/authedFetch';

// Fixtures by Firestore path: collections (odd segment count) hold arrays of
// rows, docs (even segment count) hold one object. Missing paths are empty.
const mockDocs = {};

jest.mock('../../config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: (_db, ...parts) => parts.join('/'),
  doc: (_db, ...parts) => parts.join('/'),
  query: (ref) => ref,
  orderBy: () => null,
  limit: () => null,
  onSnapshot: (path, next) => {
    const value = mockDocs[path];
    if (path.split('/').length % 2 === 1) {
      next({ docs: (value || []).map((row) => ({ id: row.id, data: () => row })) });
    } else {
      next({ exists: () => !!value, data: () => value });
    }
    return () => {};
  },
}));
jest.mock('../../utils/authedFetch', () => ({ authedFetch: jest.fn() }));

const at = (ms) => ({ toMillis: () => ms, toDate: () => new Date(ms) });
const TIERS = [
  { place: 1, tickets: 100, prize: { kind: 'cash', amount: 10 } },
  { place: 2, tickets: 50, prize: null },
];
const OPEN = {
  id: 'r2',
  title: 'Friday',
  status: 'open',
  source: 'manual',
  manualTotalCost: 500,
  acceptPredictions: true,
  rewards: { tiers: TIERS },
  announce: true,
  announced: { opened: at(1), locked: null, results: null },
  entryCount: 2,
  createdAt: at(2000),
};
const PAST = {
  id: 'r1',
  title: 'Last week',
  status: 'settled',
  source: 'manual',
  manualTotalCost: 400,
  acceptPredictions: true,
  rewards: { tiers: TIERS },
  announce: false,
  actual: { payout: 1000 },
  winners: [
    {
      place: 1,
      twitchId: 'a',
      displayName: 'viewerA',
      payoutGuess: 990,
      diff: 10,
      prize: { tickets: 100, kind: 'cash', amount: 10, label: '$10' },
      redemptionId: 'red1',
    },
  ],
  createdAt: at(1000),
};

beforeEach(() => {
  Object.keys(mockDocs).forEach((k) => delete mockDocs[k]);
});

test('the current round leads the page and blocks a new round while open', () => {
  mockDocs.hunts = [OPEN, PAST];
  mockDocs['hunts/r2/entries'] = [
    { id: 'b', twitchId: 'b', displayName: 'viewerB', payoutGuess: 1500, editCount: 2 },
    { id: 'a', twitchId: 'a', displayName: 'viewerA', payoutGuess: 900, editCount: 1 },
  ];
  render(<AdminHuntsPage />);
  expect(screen.getByText('Friday')).toBeTruthy();
  expect(screen.getByRole('button', { name: /new round/i }).disabled).toBe(true);
  expect(screen.getByText(/settle or delete the current round first/i)).toBeTruthy();
  expect(screen.getByText(/100t \+ \$10 cash/)).toBeTruthy();
  const rows = screen.getAllByRole('row').slice(1).map((r) => r.textContent);
  expect(rows[0]).toMatch(/viewerA/);
  expect(rows[1]).toMatch(/viewerB/);
});

test('Lock & settle locks the round, then opens the settle window', async () => {
  mockDocs.hunts = [OPEN];
  authedFetch.mockReturnValue(
    Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, announce: { posted: true } }) })
  );
  render(<AdminHuntsPage />);
  fireEvent.click(screen.getByRole('button', { name: /lock & settle/i }));
  expect(await screen.findByLabelText(/actual final payout/i)).toBeTruthy();
  expect(JSON.parse(authedFetch.mock.calls[0][1].body)).toEqual({ action: 'lock', id: 'r2' });
});

test('opening a past round shows its results read-only', () => {
  mockDocs.hunts = [OPEN, PAST];
  mockDocs['redemptions/red1'] = { status: 'pending' };
  render(<AdminHuntsPage />);
  fireEvent.click(screen.getByRole('button', { name: /last week/i }));
  expect(screen.getByText(/\+100 credited/)).toBeTruthy();
  expect(screen.getByText('pending')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /lock entries/i })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /back to current round/i }));
  expect(screen.getByRole('button', { name: /lock entries/i })).toBeTruthy();
});

test('with no active round, New round is enabled', () => {
  mockDocs.hunts = [PAST];
  render(<AdminHuntsPage />);
  expect(screen.getByRole('button', { name: /new round/i }).disabled).toBe(false);
});
