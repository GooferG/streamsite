import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettleModal } from '../AdminHuntsPage';
import { authedFetch } from '../../utils/authedFetch';

jest.mock('../../config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: () => ({}),
  onSnapshot: () => () => {},
  orderBy: () => ({}),
  query: () => ({}),
  limit: () => ({}),
}));
jest.mock('../../utils/authedFetch', () => ({ authedFetch: jest.fn() }));

const ROUND = {
  id: 'r1',
  title: 'Sunday',
  source: 'communityhunts',
  acceptPredictions: true,
  bonusHuntSnapshot: { huntId: 'h1', currency: 'CAD', totalCost: 3103.62, bonusCount: 18 },
};
const reply = (ok, body) => Promise.resolve({ ok, json: () => Promise.resolve(body) });

test('Fill from hunt prefills the final payout', async () => {
  authedFetch.mockReturnValue(reply(true, { ok: true, result: { payout: 1318.8, ended: true } }));
  render(<SettleModal round={ROUND} onClose={() => {}} onSettled={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: /fill from hunt/i }));
  const input = screen.getByLabelText(/actual final payout/i);
  await waitFor(() => expect(input.value).toBe('1318.8'));
  expect(JSON.parse(authedFetch.mock.calls[0][1].body)).toEqual({ action: 'hunt_result', id: 'r1' });
  expect(screen.queryByText(/still live/i)).toBeNull();
});

test('Fill from hunt warns when the hunt is still live', async () => {
  authedFetch.mockReturnValue(reply(true, { ok: true, result: { payout: 200, ended: false } }));
  render(<SettleModal round={ROUND} onClose={() => {}} onSettled={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: /fill from hunt/i }));
  await waitFor(() => expect(screen.getByText(/still live/i)).toBeTruthy());
});

// Review Focus 5: a deleted hunt gives a readable error and leaves the field alone.
test('Fill from hunt on a missing hunt shows a readable error', async () => {
  authedFetch.mockReturnValue(reply(false, { error: 'HUNT_NOT_FOUND' }));
  render(<SettleModal round={ROUND} onClose={() => {}} onSettled={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: /fill from hunt/i }));
  await waitFor(() => expect(screen.getByText(/not found on communityhunts\.gg/i)).toBeTruthy());
  expect(screen.getByLabelText(/actual final payout/i).value).toBe('');
});

// Review Focus 5: an empty payout must not settle at 0.
test('settling with an empty payout is blocked', () => {
  render(<SettleModal round={ROUND} onClose={() => {}} onSettled={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: /reveal winners/i }));
  expect(screen.getByText(/actual payout required/i)).toBeTruthy();
  expect(authedFetch).not.toHaveBeenCalled();
});

test('manual rounds have no Fill from hunt button', () => {
  render(<SettleModal round={{ ...ROUND, source: 'manual', bonusHuntSnapshot: null }} onClose={() => {}} onSettled={() => {}} />);
  expect(screen.queryByRole('button', { name: /fill from hunt/i })).toBeNull();
});
