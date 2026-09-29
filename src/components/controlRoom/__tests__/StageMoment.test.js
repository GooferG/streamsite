import { render, screen, fireEvent, act } from '@testing-library/react';
import StageMoment from '../StageMoment';
import { useControlRoom } from '../../../contexts/ControlRoomContext';
import { useGiveawayFeed } from '../../../hooks/useGiveawayFeed';

jest.mock('../../../contexts/ControlRoomContext', () => ({ useControlRoom: jest.fn() }));
jest.mock('../../../hooks/useGiveawayFeed', () => ({ useGiveawayFeed: jest.fn() }));
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

beforeEach(() => {
  jest.useFakeTimers();
  useGiveawayFeed.mockReturnValue({ giveaway: null, entries: [], firstMessage: null });
});
afterEach(() => jest.useRealTimers());

test('a fresh pick takes the stage and ducks the panel', () => {
  show({ giveaway: pick(500) });
  expect(screen.getByText('reveal stage')).toBeTruthy();
  expect(setDucked).toHaveBeenLastCalledWith(true);
});

// Final review T14: no giveaway running, no overlay feed subscription.
test('follows the overlay feed only while a giveaway is live', () => {
  const view = show();
  expect(useGiveawayFeed).toHaveBeenLastCalledWith({ enabled: false });
  useControlRoom.mockReturnValue({ giveaway: pick(60_000), latestRound: null, setDucked });
  view.rerender(<StageMoment />);
  expect(useGiveawayFeed).toHaveBeenLastCalledWith({ enabled: true });
});

test('a stale pick does nothing', () => {
  show({ giveaway: pick(60_000) });
  expect(screen.queryByText('reveal stage')).toBeNull();
});

test('a reroll while a pick is on stage swaps to the new pick without powering off', () => {
  const view = show({ giveaway: pick(500) });
  expect(screen.getByText('reveal stage')).toBeTruthy();

  useControlRoom.mockReturnValue({
    giveaway: {
      id: 'g1',
      status: 'rolling',
      winnerTwitchId: 'tw2',
      rolledAt: at(Date.now() - 100),
      winner: { twitchId: 'tw2', displayName: 'ReubenTheGoblin' },
    },
    latestRound: null,
    setDucked,
  });
  view.rerender(<StageMoment />);

  expect(screen.getByText('reveal stage')).toBeTruthy();
  expect(screen.getByRole('presentation').className).not.toMatch('cr-stage-out');

  act(() => {
    jest.advanceTimersByTime(400);
  });

  expect(screen.getByText('reveal stage')).toBeTruthy();
  expect(screen.getByRole('presentation').className).not.toMatch('cr-stage-out');
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
