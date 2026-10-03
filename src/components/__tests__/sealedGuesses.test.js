import { render, screen } from '@testing-library/react';
import { onSnapshot } from 'firebase/firestore';
import PredictionWall from '../PredictionWall';
import PredictionNumberLine from '../PredictionNumberLine';

jest.mock('../../config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: () => ({}),
  query: () => ({}),
  orderBy: () => ({}),
  limit: () => ({}),
  onSnapshot: jest.fn(),
}));
let mockIsStaff = false;
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ isStaff: mockIsStaff }),
}));

const ROUND = { id: 'r1', status: 'open', acceptPredictions: true, entryCount: 37, source: 'manual' };

beforeEach(() => {
  mockIsStaff = false;
  onSnapshot.mockImplementation(() => () => {});
});

test('viewers see a face-down wall while open and nothing is queried', () => {
  render(<PredictionWall round={ROUND} />);
  expect(screen.getByText(/37 guesses face down/i)).toBeTruthy();
  expect(onSnapshot).not.toHaveBeenCalled();
});

test('staff see the live wall while open', () => {
  mockIsStaff = true;
  render(<PredictionWall round={ROUND} />);
  expect(onSnapshot).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(/face down/i)).toBeNull();
});

test('the wall subscribes once the round locks', () => {
  render(<PredictionWall round={{ ...ROUND, status: 'locked' }} />);
  expect(onSnapshot).toHaveBeenCalledTimes(1);
});

// Review Focus 4: reopening must stop the listener and reseal the wall.
test('reopening a locked round unsubscribes and reseals', () => {
  const unsub = jest.fn();
  onSnapshot.mockImplementation(() => unsub);
  const { rerender } = render(<PredictionWall round={{ ...ROUND, status: 'locked' }} />);
  rerender(<PredictionWall round={{ ...ROUND, status: 'open' }} />);
  expect(unsub).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/face down/i)).toBeTruthy();
});

test('a permission error falls back to the face-down wall', () => {
  onSnapshot.mockImplementation((q, next, error) => {
    error(new Error('permission-denied'));
    return () => {};
  });
  render(<PredictionWall round={{ ...ROUND, status: 'locked' }} />);
  expect(screen.getByText(/face down/i)).toBeTruthy();
});

test('the number line stays hidden and unqueried while sealed', () => {
  const { container } = render(<PredictionNumberLine round={ROUND} />);
  expect(container.firstChild).toBeNull();
  expect(onSnapshot).not.toHaveBeenCalled();
});
