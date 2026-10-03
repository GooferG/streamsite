import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PredictionSlip from '../PredictionSlip';
import { doc } from 'firebase/firestore';
import { authedFetch } from '../../utils/authedFetch';

jest.mock('../../config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  onSnapshot: () => () => {},
}));
jest.mock('../../contexts/TwitchAuthContext', () => ({
  useTwitchAuth: () => ({ twitchUser: { twitchId: 'viewer1' }, loginWithTwitch: () => {} }),
}));
jest.mock('../../utils/authedFetch', () => ({
  authedFetch: jest.fn(() => Promise.resolve({ ok: true, json: () => ({ isNew: true }) })),
}));

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

const ARS_ROUND = {
  ...ROUND,
  bonusHuntSnapshot: { huntId: 'h2', totalCost: 150000, currency: 'ARS', bonusCount: 40 },
};

function payoutInput() {
  return screen.getByLabelText(/Final payout guess/i);
}

test('the guess is grouped while typing and submits as a plain number', async () => {
  doc.mockReturnValue({});
  authedFetch.mockClear();
  render(<PredictionSlip round={ARS_ROUND} />);
  fireEvent.change(payoutInput(), { target: { value: '1850000.5' } });
  expect(payoutInput().value).toBe('1,850,000.5');
  expect(screen.getByText('ARS')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /Submit slip/i }));
  await waitFor(() => expect(authedFetch).toHaveBeenCalledTimes(1));
  expect(JSON.parse(authedFetch.mock.calls[0][1].body)).toEqual({ roundId: 'round1', payoutGuess: 1850000.5 });
});

test('quick picks spread around the start cost', () => {
  doc.mockReturnValue({});
  render(<PredictionSlip round={ARS_ROUND} />);
  fireEvent.click(screen.getByRole('button', { name: /Half back/i }));
  expect(payoutInput().value).toBe('75,000');
  fireEvent.click(screen.getByRole('button', { name: /Break even/i }));
  expect(payoutInput().value).toBe('150,000');
  fireEvent.click(screen.getByRole('button', { name: /^2×$/ }));
  expect(payoutInput().value).toBe('300,000');
  expect(screen.queryByRole('button', { name: /100×/ })).toBeNull();
});

test('an empty slip cannot be submitted', () => {
  doc.mockReturnValue({});
  render(<PredictionSlip round={ARS_ROUND} />);
  expect(screen.getByRole('button', { name: /Submit slip/i }).disabled).toBe(true);
});
