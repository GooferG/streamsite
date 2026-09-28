import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettleModal } from '../AdminHuntsPage';
import NewRoundModal from '../../components/admin/predictions/NewRoundModal';
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

// Review fix: a round created while no hunt was live snapshots the previous,
// already-ended hunt. Settling must not silently fill that hunt's payout.
test('Fill from hunt warns when the hunt ended before the round opened', async () => {
  authedFetch.mockReturnValue(
    reply(true, { ok: true, result: { payout: 57686.03, ended: true, endedAt: '2026-09-26T22:19:56.312Z' } })
  );
  const round = { ...ROUND, createdAt: { toMillis: () => Date.parse('2026-09-27T10:00:00.000Z') } };
  render(<SettleModal round={round} onClose={() => {}} onSettled={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: /fill from hunt/i }));
  await waitFor(() => expect(screen.getByText(/ended before this round opened/i)).toBeTruthy());
});

test('Fill from hunt does not warn when the hunt ended after the round opened', async () => {
  authedFetch.mockReturnValue(
    reply(true, { ok: true, result: { payout: 1318.8, ended: true, endedAt: '2026-09-27T12:00:00.000Z' } })
  );
  const round = { ...ROUND, createdAt: { toMillis: () => Date.parse('2026-09-27T10:00:00.000Z') } };
  render(<SettleModal round={round} onClose={() => {}} onSettled={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: /fill from hunt/i }));
  const input = screen.getByLabelText(/actual final payout/i);
  await waitFor(() => expect(input.value).toBe('1318.8'));
  expect(screen.queryByText(/ended before this round opened/i)).toBeNull();
});

test('create preview labels a hunt that is not live', async () => {
  authedFetch.mockReturnValue(
    reply(true, {
      ok: true,
      snapshot: { huntId: 'h1', totalCost: 76344.23, currency: 'ARS', bonusCount: 33, status: 'archived', endedAt: '2026-09-26T22:19:56.312Z' },
    })
  );
  render(<NewRoundModal onClose={() => {}} onCreated={() => {}} />);
  await waitFor(() => expect(screen.getByText(/not live/i)).toBeTruthy());
  expect(screen.getByText(/ended sep 26, 2026/i)).toBeTruthy();
});

test('create preview marks a live hunt as live', async () => {
  authedFetch.mockReturnValue(
    reply(true, {
      ok: true,
      snapshot: { huntId: 'h2', totalCost: 500, currency: 'CAD', bonusCount: 4, status: 'live', endedAt: null },
    })
  );
  render(<NewRoundModal onClose={() => {}} onCreated={() => {}} />);
  await waitFor(() => expect(screen.getByText(/your live communityhunts\.gg hunt/i)).toBeTruthy());
  expect(screen.queryByText(/not live/i)).toBeNull();
});

const LAST = {
  acceptPredictions: true,
  rewards: {
    tiers: [
      { place: 1, tickets: 200, prize: { kind: 'cash', amount: 10 } },
      { place: 2, tickets: 75, prize: null },
    ],
  },
};

function mockCreateFlow(createReply = reply(true, { ok: true, id: 'new1', announce: { posted: true } })) {
  authedFetch.mockImplementation((url, init) => {
    const body = JSON.parse(init.body);
    if (body.action === 'preview_hunt') {
      return reply(true, {
        ok: true,
        snapshot: { huntId: 'h2', totalCost: 500, currency: 'CAD', bonusCount: 4, status: 'live', endedAt: null },
      });
    }
    return createReply;
  });
}

const createCall = () =>
  authedFetch.mock.calls.map(([, init]) => JSON.parse(init.body)).find((b) => b.action === 'create');

test('the form starts from the last round rewards', async () => {
  mockCreateFlow();
  render(<NewRoundModal lastRound={LAST} onClose={() => {}} onCreated={() => {}} />);
  await screen.findByText(/your live communityhunts\.gg hunt/i);
  expect(screen.getByLabelText('1st place tickets').value).toBe('200');
  expect(screen.getByLabelText('1st place prize').value).toBe('cash');
  expect(screen.getByLabelText('1st place prize amount').value).toBe('10');
  expect(screen.getByLabelText('2nd place tickets').value).toBe('75');
});

test('create sends each place tickets and prize, and the announce switch', async () => {
  mockCreateFlow();
  const onCreated = jest.fn();
  render(<NewRoundModal onClose={() => {}} onCreated={onCreated} />);
  await screen.findByText(/your live communityhunts\.gg hunt/i);
  fireEvent.change(screen.getByPlaceholderText('Friday night bonus hunt'), { target: { value: 'Friday' } });
  fireEvent.change(screen.getByLabelText('1st place prize'), { target: { value: 'bonus' } });
  fireEvent.change(screen.getByLabelText('1st place prize amount'), { target: { value: '20' } });
  fireEvent.click(screen.getByRole('button', { name: /start round/i }));
  await waitFor(() => expect(onCreated).toHaveBeenCalledWith('new1'));
  const body = createCall();
  expect(body.rewards).toEqual({
    tiers: [
      { place: 1, tickets: 100, prize: { kind: 'bonus', amount: 20 } },
      { place: 2, tickets: 50, prize: null },
    ],
  });
  expect(body.announce).toBe(true);
  expect(body.rewards).not.toHaveProperty('type');
});

// Review Focus 2: a prize without an amount must not silently disappear.
test('a prize without an amount blocks create', async () => {
  mockCreateFlow();
  render(<NewRoundModal onClose={() => {}} onCreated={() => {}} />);
  await screen.findByText(/your live communityhunts\.gg hunt/i);
  fireEvent.change(screen.getByPlaceholderText('Friday night bonus hunt'), { target: { value: 'Friday' } });
  fireEvent.change(screen.getByLabelText('1st place prize'), { target: { value: 'cash' } });
  fireEvent.click(screen.getByRole('button', { name: /start round/i }));
  expect(await screen.findByText(/enter a prize amount for 1st place/i)).toBeTruthy();
  expect(createCall()).toBeUndefined();
});

test('an active round blocks create with a readable error', async () => {
  mockCreateFlow(reply(false, { error: 'ROUND_ACTIVE' }));
  render(<NewRoundModal onClose={() => {}} onCreated={() => {}} />);
  await screen.findByText(/your live communityhunts\.gg hunt/i);
  fireEvent.change(screen.getByPlaceholderText('Friday night bonus hunt'), { target: { value: 'Friday' } });
  fireEvent.click(screen.getByRole('button', { name: /start round/i }));
  expect(await screen.findByText(/settle or delete the current round first/i)).toBeTruthy();
});
