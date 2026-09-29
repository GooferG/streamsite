import { render, screen, fireEvent } from '@testing-library/react';
import PredictTab from '../PredictTab';
import { useControlRoom } from '../../../contexts/ControlRoomContext';

jest.mock('../../../contexts/ControlRoomContext', () => ({ useControlRoom: jest.fn() }));
jest.mock('../../../config/firebase', () => ({ db: {} }));
jest.mock('../../../utils/authedFetch', () => ({ authedFetch: jest.fn() }));
jest.mock('../../admin/predictions/NewRoundModal', () => () =>
  require('react').createElement('p', null, 'new round form')
);

const RESULTS = { dueAt: null, posted: false, posting: false, error: null, retry: jest.fn() };
const OPEN = {
  id: 'r2',
  title: 'Friday hunt',
  status: 'open',
  source: 'manual',
  manualTotalCost: 500,
  acceptPredictions: true,
  rewards: { tiers: [{ place: 1, tickets: 100, prize: null }] },
  announce: true,
  announced: { opened: null, locked: null, results: null },
  entryCount: 212,
};

function show(cr) {
  useControlRoom.mockReturnValue({ activeRound: null, latestRound: null, rounds: [], results: RESULTS, ...cr });
  return render(<PredictTab />);
}

test('no round: says so and offers New round', () => {
  show({});
  expect(screen.getByText('No round running.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /new round/i }));
  expect(screen.getByText('new round form')).toBeTruthy();
});

test('an open round: summary, the lifecycle controls, no New round', () => {
  show({ activeRound: OPEN, latestRound: OPEN, rounds: [OPEN] });
  // RoundControl (the lifecycle controls) also renders the round title in its
  // own header, so the tab shows it twice; getAllByText keeps the same intent
  // (the title is displayed) without an ambiguous getByText match.
  expect(screen.getAllByText('Friday hunt').length).toBeGreaterThan(0);
  expect(screen.getByText('212')).toBeTruthy();
  expect(screen.getByRole('button', { name: /lock entries/i })).toBeTruthy();
  expect(screen.queryByRole('button', { name: /new round/i })).toBeNull();
});

test('a settled latest round lists its winners and offers New round', () => {
  const settled = {
    ...OPEN,
    status: 'settled',
    actual: { payout: 1000 },
    winners: [{ place: 1, twitchId: 'a', displayName: 'viewerA', payoutGuess: 990, diff: 10, prize: null }],
  };
  show({ latestRound: settled, rounds: [settled] });
  expect(screen.getByRole('list', { name: 'Winners' }).textContent).toMatch(/viewerA/);
  expect(screen.getByRole('button', { name: /new round/i })).toBeTruthy();
});
