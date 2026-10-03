import { act, render, screen } from '@testing-library/react';
import Monitor from '../Monitor';
import { SWITCH_MS } from '../useChannelSwitch';

function setReducedMotion(on) {
  window.matchMedia = jest.fn((query) => ({
    matches: on && query.includes('reduce'),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
}

const PROPS = {
  tint: 'signal',
  status: 'live',
  channel: 'CH 02 · Hunts',
  clock: { long: 'THU OCT 1 · 9:58 PM', short: '9:58 PM' },
  readout: { label: 'CH 02 · Entries open', tone: 'signal' },
  chyron: { tag: 'Open', tone: 'signal', items: ['Predictions open', '6 guesses in'] },
};

afterEach(() => {
  delete window.matchMedia;
  jest.useRealTimers();
});

test('renders the screen, readout and a ticker whose copy is hidden from screen readers', () => {
  render(<Monitor {...PROPS} channelKey="open"><p>screen body</p></Monitor>);
  expect(screen.getByText('screen body')).toBeTruthy();
  expect(screen.getByText('CH 02 · Entries open')).toBeTruthy();
  expect(screen.getByText('Live')).toBeTruthy();
  const copies = screen.getAllByText('Predictions open');
  expect(copies).toHaveLength(2);
  expect(copies.filter((el) => el.closest('[aria-hidden="true"]'))).toHaveLength(1);
});

test('knobs and the wordmark are set dressing', () => {
  render(<Monitor {...PROPS} channelKey="open" />);
  expect(screen.getByText('VOL').closest('[aria-hidden="true"]')).toBeTruthy();
  expect(screen.getByText('Goofer·vision').closest('[aria-hidden="true"]')).toBeTruthy();
});

test('the static plays on a channel change, never on mount, and clears after the burst', () => {
  jest.useFakeTimers();
  setReducedMotion(false);
  const { rerender } = render(<Monitor {...PROPS} channelKey="open" />);
  expect(screen.queryByTestId('onair-static')).toBeNull();
  rerender(<Monitor {...PROPS} channelKey="locked" />);
  expect(screen.getByTestId('onair-static')).toBeTruthy();
  act(() => {
    jest.advanceTimersByTime(SWITCH_MS);
  });
  expect(screen.queryByTestId('onair-static')).toBeNull();
});

test('the first real channel after loading (null key) is quiet', () => {
  setReducedMotion(false);
  const { rerender } = render(<Monitor {...PROPS} channelKey={null} />);
  rerender(<Monitor {...PROPS} channelKey="open" />);
  expect(screen.queryByTestId('onair-static')).toBeNull();
});

test('reduced motion swaps channels without static', () => {
  setReducedMotion(true);
  const { rerender } = render(<Monitor {...PROPS} channelKey="open" />);
  rerender(<Monitor {...PROPS} channelKey="settled" />);
  expect(screen.queryByTestId('onair-static')).toBeNull();
});

test('a replay monitor shows Replay and no ticker when chyron is omitted', () => {
  render(<Monitor {...PROPS} status="replay" chyron={null} channelKey="settled" />);
  expect(screen.getByText('Replay')).toBeTruthy();
  expect(screen.queryByRole('marquee')).toBeNull();
});
