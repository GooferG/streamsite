import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BallOverlay from '../BallOverlay';
import useBallRound from '../../hooks/useBallRound';
import useBallsFeed from '../../hooks/useBallsFeed';
import useBallHunt from '../../hooks/useBallHunt';
import useBroadcastSettings from '../../hooks/useBroadcastSettings';

jest.mock('../../hooks/useBallRound', () => jest.fn());
jest.mock('../../hooks/useBallsFeed', () => jest.fn());
jest.mock('../../hooks/useBallHunt', () => jest.fn());
jest.mock('../../hooks/useBroadcastSettings', () => jest.fn());

const at = (ms) => ({ toMillis: () => ms });
const NOW = Date.now(); // only for timestamps far from any window
const base = {
  id: 'r1',
  status: 'open',
  prize: { tickets: 200, prize: { kind: 'cash', amount: 5 } },
  huntId: null,
  rack: [],
};
const BALLS = [
  { id: 'a', status: 'drum', slotId: 's1', slotName: 'One', displayName: 'A' },
  { id: 'b', status: 'drum', slotId: 's2', slotName: 'Two', displayName: 'B' },
];
const drawn = (ms) => ({ drawNo: 1, twitchId: 'c', displayName: 'CoolGuy', slotId: 's3', slotName: 'Gates of Olympus', thumb: null, drawnAt: at(ms), scratched: false });

function show(round, { reveals = 'overlay', hunt = null, url = '/ball-overlay' } = {}) {
  useBallRound.mockReturnValue({ round, error: false });
  useBallsFeed.mockReturnValue({ balls: BALLS, ready: true, error: false });
  useBallHunt.mockReturnValue({ hunt, stale: false, loading: false });
  useBroadcastSettings.mockReturnValue({ reveals, ready: true });
  return render(
    <MemoryRouter initialEntries={[url]}>
      <BallOverlay />
    </MemoryRouter>
  );
}

beforeEach(() => {
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

test('no round: nothing on screen', () => {
  const { container } = show(null);
  expect(container.textContent).toBe('');
});

test('an open round rests in the corner box', () => {
  show(base);
  expect(screen.getByText('2 balls')).toBeTruthy();
  expect(screen.getByText('!slot <slot name>')).toBeTruthy();
});

test('a fresh draw takes over the screen', () => {
  show({ ...base, rack: [drawn(Date.now() - 6000)] });
  expect(screen.getByText('Called in by @CoolGuy · 2 balls left in the drum')).toBeTruthy();
});

test('a draw whose reveal already played never replays (OBS reload)', () => {
  show({ ...base, rack: [drawn(NOW - 60_000)] });
  expect(screen.queryByText(/Called in by/)).toBeNull();
  expect(screen.getByText('2 balls')).toBeTruthy();
});

test('Stage mode: OBS skips the takeover but keeps the corner box', () => {
  show({ ...base, rack: [drawn(Date.now() - 6000)] }, { reveals: 'stage' });
  expect(screen.queryByText(/Called in by/)).toBeNull();
  expect(screen.getByText('2 balls')).toBeTruthy();
});

test('a linked hunt with results shows the live rack', () => {
  show(
    { ...base, huntId: 'h1', rack: [drawn(NOW - 60_000)] },
    { hunt: { bonuses: [{ slot: 'Gates of Olympus', multiplier: 412 }] } }
  );
  // RackBoard splits the multiplier into its own span, so match on textContent.
  expect(screen.getByText((_, el) => el.tagName === 'SPAN' && el.textContent === 'Leader @CoolGuy · 412x')).toBeTruthy();
});

test('a fresh settle plays the winner card', () => {
  show({
    ...base,
    status: 'settled',
    settledAt: at(Date.now() - 2000),
    rack: [drawn(Date.now() - 600_000)],
    winner: { ...drawn(0), multiplier: 412 },
  });
  expect(screen.getByText("Tonight's winning ball")).toBeTruthy();
});

test('the corner follows ?pos', () => {
  const { container } = show(base, { url: '/ball-overlay?pos=tr' });
  expect(container.querySelector('.right-8.top-8')).toBeTruthy();
});

describe('a moment that has just ended', () => {
  const T = 1_900_000_000_000;
  let nowSpy;
  beforeEach(() => {
    nowSpy = jest.spyOn(Date, 'now').mockReturnValue(T);
  });
  afterEach(() => {
    nowSpy.mockRestore();
  });

  function again(view, round) {
    useBallRound.mockReturnValue({ round, error: false });
    view.rerender(
      <MemoryRouter initialEntries={['/ball-overlay']}>
        <BallOverlay />
      </MemoryRouter>
    );
  }

  test('the draw takeover gives way to the corner box (no frozen stale clock)', () => {
    const mk = () => ({ ...base, rack: [drawn(T - 7990)] });
    const view = show(mk());
    expect(screen.getByText(/Called in by/)).toBeTruthy();
    for (const later of [T + 20, T + 60_000]) {
      nowSpy.mockReturnValue(later);
      again(view, mk());
      expect(screen.queryByText(/Called in by/)).toBeNull();
      expect(screen.getByText('2 balls')).toBeTruthy();
    }
  });

  test('the winner card goes away after its hold', () => {
    const mk = () => ({ ...base, status: 'settled', settledAt: at(T - 11_990), rack: [drawn(T - 600_000)], winner: { ...drawn(0), multiplier: 412 } });
    const view = show(mk());
    expect(screen.getByText("Tonight's winning ball")).toBeTruthy();
    nowSpy.mockReturnValue(T + 3_600_000);
    again(view, mk());
    expect(screen.queryByText("Tonight's winning ball")).toBeNull();
  });
});
