import { render, screen } from '@testing-library/react';
import PredictionSlip from '../PredictionSlip';
import { doc } from 'firebase/firestore';

jest.mock('../../config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  onSnapshot: () => () => {},
}));
jest.mock('../../contexts/TwitchAuthContext', () => ({
  useTwitchAuth: () => ({ twitchUser: { twitchId: 'viewer1' }, loginWithTwitch: () => {} }),
}));
jest.mock('../../utils/authedFetch', () => ({ authedFetch: () => Promise.resolve({ ok: true, json: () => ({}) }) }));

const ROUND = {
  id: 'round1',
  title: 'Sunday hunt',
  status: 'open',
  acceptPredictions: true,
  source: 'communityhunts',
  bonusHuntSnapshot: { huntId: 'h1', totalCost: 3103.62, currency: 'CAD', bonusCount: 18 },
};

// Regression: entries live under hunts/{id}/entries, not prediction_rounds.
test('subscribes to the viewer entry under hunts/{id}/entries', () => {
  doc.mockReturnValue({});
  render(<PredictionSlip round={ROUND} />);
  expect(doc).toHaveBeenCalledWith({}, 'hunts', 'round1', 'entries', 'viewer1');
});

test('payout-only slip shows cost in the hunt currency and no top-slot picker', () => {
  doc.mockReturnValue({});
  render(<PredictionSlip round={ROUND} />);
  expect(screen.getByText(/Final payout guess/i)).toBeTruthy();
  expect(screen.getByText(/Cost CA\$3,103\.62/)).toBeTruthy();
  expect(screen.queryByText(/Top slot pick/i)).toBeNull();
});
