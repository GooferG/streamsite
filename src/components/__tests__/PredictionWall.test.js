import { render, screen, within } from '@testing-library/react';
import { onSnapshot } from 'firebase/firestore';
import PredictionWall from '../PredictionWall';

jest.mock('../../config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: () => ({}),
  query: () => ({}),
  orderBy: () => ({}),
  limit: () => ({}),
  onSnapshot: jest.fn(),
}));
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ isStaff: false }),
}));

const ARS_ROUND = {
  id: 'r1',
  status: 'locked',
  acceptPredictions: true,
  entryCount: 3,
  source: 'communityhunts',
  bonusHuntSnapshot: { currency: 'ARS', totalCost: 150000 },
};

function entry(id, payoutGuess, name = id) {
  return { id, twitchId: id, displayName: name, payoutGuess };
}

function feed(entries) {
  onSnapshot.mockImplementation((q, next) => {
    next({ docs: entries.map((e) => ({ id: e.id, data: () => e })) });
    return () => {};
  });
}

beforeEach(() => {
  onSnapshot.mockReset();
});

test('tiles carry the currency code apart from the figure', () => {
  feed([entry('a', 1850000.4, 'skillsytv')]);
  render(<PredictionWall round={ARS_ROUND} />);
  const tile = screen.getByRole('listitem');
  expect(within(tile).getByText('1,850,000')).toBeTruthy();
  expect(within(tile).getByText('ARS')).toBeTruthy();
  expect(within(tile).getByText('skillsytv')).toBeTruthy();
  expect(within(tile).getByText('001')).toBeTruthy();
});

test('tiles stay in entry order and winners wear their place', () => {
  feed([entry('a', 900000), entry('b', 2122400), entry('c', 3333000)]);
  render(
    <PredictionWall
      round={{
        ...ARS_ROUND,
        status: 'settled',
        winners: [{ place: 1, twitchId: 'b' }, { place: 2, twitchId: 'a' }],
      }}
    />
  );
  const tiles = screen.getAllByRole('listitem');
  expect(tiles.map((t) => within(t).getByText(/^\d{3}$/).textContent)).toEqual(['001', '002', '003']);
  expect(within(tiles[1]).getByText('1ST')).toBeTruthy();
  expect(within(tiles[0]).getByText('2ND')).toBeTruthy();
  expect(within(tiles[2]).queryByText(/1ST|2ND|3RD/)).toBeNull();
});

test('manual rounds keep the $ tag', () => {
  feed([entry('a', 1234.4)]);
  render(<PredictionWall round={{ id: 'r2', status: 'locked', source: 'manual' }} />);
  expect(screen.getByText('$')).toBeTruthy();
  expect(screen.getByText('1,234')).toBeTruthy();
});

test('a sealed board shows face-down tiles, capped', () => {
  render(<PredictionWall round={{ ...ARS_ROUND, status: 'open', entryCount: 37 }} />);
  expect(screen.getByText(/37 guesses face down/i)).toBeTruthy();
  expect(screen.getAllByTestId('face-down-tile')).toHaveLength(10);
  expect(onSnapshot).not.toHaveBeenCalled();
});

test('a sealed board with no guesses reads empty', () => {
  render(<PredictionWall round={{ ...ARS_ROUND, status: 'open', entryCount: 0 }} />);
  expect(screen.getByText(/board empty/i)).toBeTruthy();
  expect(screen.queryAllByTestId('face-down-tile')).toHaveLength(0);
});
