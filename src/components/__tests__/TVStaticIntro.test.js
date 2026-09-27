import { render, screen, fireEvent, act } from '@testing-library/react';
import TVStaticIntro from '../TVStaticIntro';
import {
  BOOT_MS,
  GATE_MS,
  FLIP_STATIC_MS,
  FLIP_LOCK_MS,
  REDUCED_FADE_MS,
} from '../../utils/crtTimeline';

beforeEach(() => {
  jest.useFakeTimers();
  // jsdom has no WebGL or 2D canvas; the intro falls back to CSS static.
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const handlers = () => ({
  onPowerOn: jest.fn(),
  onReveal: jest.fn(),
  onComplete: jest.fn(),
});

const advance = (ms) => act(() => {
  jest.advanceTimersByTime(ms);
});

const powerButton = () => screen.getByRole('button', { name: /turn on the channel/i });

test('gate waits on standby until pressed', () => {
  const h = handlers();
  render(<TVStaticIntro mode="gate" {...h} />);
  advance(10000);
  expect(powerButton()).toBeTruthy();
  expect(h.onPowerOn).not.toHaveBeenCalled();
  expect(h.onReveal).not.toHaveBeenCalled();
});

test('pressing the gate powers on, reveals the page after the boot, then completes', () => {
  const h = handlers();
  render(<TVStaticIntro mode="gate" {...h} />);
  fireEvent.click(powerButton());
  expect(h.onPowerOn).toHaveBeenCalledTimes(1);

  advance(BOOT_MS - 1);
  expect(h.onReveal).not.toHaveBeenCalled();
  advance(1);
  expect(h.onReveal).toHaveBeenCalledTimes(1);

  advance(GATE_MS - BOOT_MS);
  expect(h.onComplete).toHaveBeenCalledTimes(1);
});

test('any key powers the gate on, and only once', () => {
  const h = handlers();
  render(<TVStaticIntro mode="gate" {...h} />);
  fireEvent.keyDown(window, { key: 'a' });
  fireEvent.keyDown(window, { key: 'Enter' });
  expect(h.onPowerOn).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: /turn on the channel/i })).toBeNull();
});

test('modifier shortcuts do not power the gate on', () => {
  const h = handlers();
  render(<TVStaticIntro mode="gate" {...h} />);
  fireEvent.keyDown(window, { key: 'Shift', shiftKey: true });
  fireEvent.keyDown(window, { key: 'I', ctrlKey: true, shiftKey: true });
  fireEvent.keyDown(window, { key: 'r', metaKey: true });
  expect(h.onPowerOn).not.toHaveBeenCalled();
});

test('flip plays through without a press', () => {
  const h = handlers();
  render(<TVStaticIntro mode="flip" {...h} />);
  expect(screen.queryByRole('button', { name: /turn on the channel/i })).toBeNull();

  advance(FLIP_STATIC_MS);
  expect(h.onReveal).toHaveBeenCalledTimes(1);
  advance(FLIP_LOCK_MS);
  expect(h.onComplete).toHaveBeenCalledTimes(1);
  expect(h.onPowerOn).not.toHaveBeenCalled();
});

test('reduced motion gate goes straight to the page after the press', () => {
  const h = handlers();
  render(<TVStaticIntro mode="gate" reduced {...h} />);
  fireEvent.click(powerButton());
  expect(h.onPowerOn).toHaveBeenCalledTimes(1);
  expect(h.onReveal).toHaveBeenCalledTimes(1);
  advance(REDUCED_FADE_MS);
  expect(h.onComplete).toHaveBeenCalledTimes(1);
});

test('unmounting mid-boot cancels the pending callbacks', () => {
  const h = handlers();
  const { unmount } = render(<TVStaticIntro mode="gate" {...h} />);
  fireEvent.click(powerButton());
  unmount();
  advance(GATE_MS);
  expect(h.onReveal).not.toHaveBeenCalled();
  expect(h.onComplete).not.toHaveBeenCalled();
});
