import { act, render, screen } from '@testing-library/react';
import StageMoment from '../StageMoment';
import { useControlRoom } from '../../../contexts/ControlRoomContext';
import { useGiveawayFeed } from '../../../hooks/useGiveawayFeed';

jest.mock('../../../contexts/ControlRoomContext', () => ({ useControlRoom: jest.fn() }));
jest.mock('../../../hooks/useGiveawayFeed', () => ({ useGiveawayFeed: jest.fn() }));

const at = (ms) => ({ toMillis: () => ms });
const entry = (ms) => ({ drawNo: 1, twitchId: 'c', displayName: 'CoolGuy', slotName: 'Gates of Olympus', thumb: null, drawnAt: at(ms), scratched: false });

function show(ballRound) {
  useControlRoom.mockReturnValue({ giveaway: null, latestRound: null, ballRound, setDucked: jest.fn() });
  return render(<StageMoment />);
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  useGiveawayFeed.mockReturnValue({ giveaway: null, entries: [], firstMessage: null });
});

test('a fresh draw plays the takeover on Stage', () => {
  show({ id: 'r1', status: 'open', rack: [entry(Date.now() - 6000)] });
  expect(screen.getByText('Called in by @CoolGuy')).toBeTruthy();
});

test('an old draw never plays', () => {
  const { container } = show({ id: 'r1', status: 'open', rack: [entry(Date.now() - 60_000)] });
  expect(container.textContent).toBe('');
});

test('a fresh settle plays the winner card', () => {
  show({
    id: 'r1',
    status: 'settled',
    settledAt: at(Date.now() - 1000),
    prize: { tickets: 200, prize: null },
    rack: [entry(Date.now() - 600_000)],
    winner: { ...entry(0), multiplier: 412 },
  });
  expect(screen.getByText("Tonight's winning ball")).toBeTruthy();
});

test('a draw scratched while it plays leaves the stage', () => {
  const round = { id: 'r1', status: 'open', rack: [entry(Date.now() - 6000)] };
  useControlRoom.mockReturnValue({ giveaway: null, latestRound: null, ballRound: round, setDucked: jest.fn() });
  const view = render(<StageMoment />);
  expect(screen.getByText('Called in by @CoolGuy')).toBeTruthy();
  const scratched = { ...round, rack: [{ ...round.rack[0], scratched: true }] };
  useControlRoom.mockReturnValue({ giveaway: null, latestRound: null, ballRound: scratched, setDucked: jest.fn() });
  view.rerender(<StageMoment />);
  act(() => jest.advanceTimersByTime(1000));
  expect(screen.queryByText('Called in by @CoolGuy')).toBeNull();
});
afterEach(() => jest.useRealTimers());
