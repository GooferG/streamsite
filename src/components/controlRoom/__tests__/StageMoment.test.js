import { render, screen, fireEvent, act } from '@testing-library/react';
import StageMoment from '../StageMoment';
import { useControlRoom } from '../../../contexts/ControlRoomContext';

jest.mock('../../../contexts/ControlRoomContext', () => ({ useControlRoom: jest.fn() }));
jest.mock('../../../hooks/useGiveawayFeed', () => ({
  useGiveawayFeed: () => ({ giveaway: null, entries: [], firstMessage: null }),
}));
jest.mock('../../giveaway/RevealStage', () => () => require('react').createElement('p', null, 'reveal stage'));
jest.mock('../../PredictionWinnersReveal', () => () => require('react').createElement('p', null, 'winners reveal'));

const at = (ms) => ({ toMillis: () => ms });
let setDucked;

function show({ giveaway = null, latestRound = null } = {}) {
  setDucked = jest.fn();
  useControlRoom.mockReturnValue({ giveaway, latestRound, setDucked });
  return render(<StageMoment />);
}

const pick = (agoMs) => ({
  id: 'g1',
  status: 'rolling',
  winnerTwitchId: 'tw1',
  rolledAt: at(Date.now() - agoMs),
  winner: { twitchId: 'tw1', displayName: 'SlotGoblin' },
});

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('a fresh pick takes the stage and ducks the panel', () => {
  show({ giveaway: pick(500) });
  expect(screen.getByText('reveal stage')).toBeTruthy();
  expect(setDucked).toHaveBeenLastCalledWith(true);
});

test('a stale pick does nothing', () => {
  show({ giveaway: pick(60_000) });
  expect(screen.queryByText('reveal stage')).toBeNull();
});

test('a fresh settle shows the results card', () => {
  show({ latestRound: { id: 'r1', title: 'Friday hunt', status: 'settled', settledAt: at(Date.now() - 500) } });
  expect(screen.getByText('Prediction results')).toBeTruthy();
  expect(screen.getByText('Friday hunt')).toBeTruthy();
  expect(screen.getByText('winners reveal')).toBeTruthy();
});

test('Escape ends it early and un-ducks the panel', () => {
  show({ giveaway: pick(500) });
  fireEvent.keyDown(window, { key: 'Escape' });
  act(() => {
    jest.advanceTimersByTime(400);
  });
  expect(screen.queryByText('reveal stage')).toBeNull();
  expect(setDucked).toHaveBeenLastCalledWith(false);
});
