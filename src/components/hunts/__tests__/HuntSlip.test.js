import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import HuntSlip from '../HuntSlip';
import { authedFetch } from '../../../utils/authedFetch';

jest.mock('../../../utils/authedFetch', () => ({
  authedFetch: jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ isNew: true }) })),
}));

const ROUND = {
  id: 'round1',
  title: 'Sunday hunt',
  status: 'open',
  acceptPredictions: true,
  source: 'communityhunts',
  bonusHuntSnapshot: { huntId: 'h2', totalCost: 150000, currency: 'ARS', bonusCount: 40 },
};
const VIEWER = { twitchId: 'viewer1' };

function renderSlip(props) {
  return render(
    <HuntSlip
      mode="open"
      round={ROUND}
      viewer={VIEWER}
      onSignIn={() => {}}
      myEntry={null}
      currency="ARS"
      startCost={150000}
      prize="+500 tickets"
      guessCount={5}
      position={null}
      rank={null}
      {...props}
    />
  );
}

const input = () => screen.getByLabelText('Final payout guess');

// CRA's Jest preset resets mocks before each test, wiping the factory's
// implementation, so re-arm the successful submit here.
beforeEach(() => {
  authedFetch.mockImplementation(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ isNew: true }) }));
});

test('signed out: the right title per mode and a sign-in button', () => {
  const onSignIn = jest.fn();
  renderSlip({ viewer: null, onSignIn });
  expect(screen.getByRole('heading', { name: 'Call the payout' })).toBeTruthy();
  expect(screen.getByText('Closest guess takes +500 tickets.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Sign in with Twitch' }));
  expect(onSignIn).toHaveBeenCalled();
});

test('the guess is grouped while typing and submits as a plain number', async () => {
  renderSlip();
  fireEvent.change(input(), { target: { value: '1850000.5' } });
  expect(input().value).toBe('1,850,000.5');
  expect(screen.getByText('ARS')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Lock it in' }));
  await waitFor(() => expect(authedFetch).toHaveBeenCalledTimes(1));
  expect(authedFetch.mock.calls[0][0]).toBe('/api/predictions/submit');
  expect(JSON.parse(authedFetch.mock.calls[0][1].body)).toEqual({ roundId: 'round1', payoutGuess: 1850000.5 });
  await waitFor(() => expect(screen.getByText('Slip submitted.')).toBeTruthy());
  expect(screen.getByText('Edit again in 30s')).toBeTruthy();
});

test('quick picks spread around the start cost', () => {
  renderSlip();
  fireEvent.click(screen.getByRole('button', { name: /Half back/ }));
  expect(input().value).toBe('75,000');
  fireEvent.click(screen.getByRole('button', { name: /Break-even/ }));
  expect(input().value).toBe('150,000');
  fireEvent.click(screen.getByRole('button', { name: /Double/ }));
  expect(input().value).toBe('300,000');
});

test('an empty slip cannot be locked', () => {
  renderSlip();
  expect(screen.getByRole('button', { name: 'Lock it in' }).disabled).toBe(true);
});

test('server errors are announced', async () => {
  authedFetch.mockImplementationOnce(() => Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'NOT_OPEN' }) }));
  renderSlip();
  fireEvent.change(input(), { target: { value: '2000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lock it in' }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Predictions are closed for this round.'));
});

test('a saved guess shows the locked card; change guess reopens the input', () => {
  renderSlip({ myEntry: { id: 'viewer1', payoutGuess: 2450 } });
  expect(screen.getByRole('heading', { name: "You're on the board" })).toBeTruthy();
  expect(screen.getByText('Locked')).toBeTruthy();
  expect(screen.getByText('Sealed with 4 other guesses. Revealed when entries close.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Change guess' }));
  expect(input().value).toBe('2,450');
  expect(screen.getByRole('button', { name: 'Update guess' })).toBeTruthy();
});

test('locked round: read-only guess with position, no input', () => {
  renderSlip({ mode: 'locked', myEntry: { id: 'viewer1', payoutGuess: 2450 }, position: { below: 2, above: 4 } });
  expect(screen.getByRole('heading', { name: 'Entries closed' })).toBeTruthy();
  expect(screen.getByText('2 guesses below you · 4 above')).toBeTruthy();
  expect(screen.queryByLabelText('Final payout guess')).toBeNull();
});

test('settled: a winner sees their place and prize; others see how far off', () => {
  const settled = { ...ROUND, status: 'settled', actual: { payout: 2046.12 }, winners: [{ place: 1, twitchId: 'viewer1', prize: { tickets: 500 } }] };
  const { unmount } = renderSlip({ mode: 'settled', round: settled, currency: null, myEntry: { id: 'viewer1', payoutGuess: 2122 } });
  expect(screen.getByRole('heading', { name: '1st place!' })).toBeTruthy();
  expect(screen.getByText('+500 tickets')).toBeTruthy();
  unmount();
  renderSlip({
    mode: 'settled',
    round: { ...settled, winners: [] },
    currency: null,
    myEntry: { id: 'viewer1', payoutGuess: 2450 },
    rank: { place: 4, of: 7 },
  });
  expect(screen.getByRole('heading', { name: 'Your result' })).toBeTruthy();
  expect(screen.getByText('Off by $403.88 · 4th of 7')).toBeTruthy();
});

test('off air: no round open', () => {
  renderSlip({ mode: 'offair', round: null });
  expect(screen.getByRole('heading', { name: 'No round open' })).toBeTruthy();
});
