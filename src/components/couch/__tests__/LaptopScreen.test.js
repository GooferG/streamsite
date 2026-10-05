import { act, render, screen } from '@testing-library/react';
import LaptopScreen, { WINDOW_MS } from '../LaptopScreen';
import { COUCH_FIXTURES as F } from '../couchFixtures';
import { laptopState } from '../couchModel';

const IDLE = laptopState(F.offair.input);
const HUNT = laptopState(F.hunt.input);
const shown = () => screen.getByTestId('laptop-window').getAttribute('data-window');
const text = () => screen.getByTestId('laptop-window').textContent;
const step = (ms) =>
  act(() => {
    jest.advanceTimersByTime(ms);
  });
// One window at a time, so each can be read on its own.
const only = (id) => ({ ...IDLE, windows: IDLE.windows.filter((w) => w.id === id) });

afterEach(() => {
  delete window.matchMedia;
});

test('the board: the top five as given, wagers like the leaderboard page, the reset in the footer', () => {
  render(<LaptopScreen laptop={only('leaderboard')} />);
  expect(shown()).toBe('leaderboard');
  const rows = screen.getByTestId('laptop-window').querySelectorAll('li');
  expect(Array.from(rows, (li) => li.textContent)).toEqual([
    '1Go***r$1,284,310',
    '2Be***n$906,452',
    '3Sl***z$512,078',
    '4Wi***7$233,940',
    '5Lu***y$118,605',
  ]);
  expect(text()).toContain('BEAN board');
  expect(text()).toContain('Resets in 3d 4h');
});

test('the recap: cost to total, a loss chip and the top three hits, the best one first', () => {
  render(<LaptopScreen laptop={only('recap')} />);
  expect(text()).toContain('Hunt · Oct 1');
  expect(text()).toContain('$600');
  expect(text()).toContain('$412');
  const chip = screen.getByTestId('laptop-result');
  expect(chip.textContent).toBe('▼ $188');
  expect(chip.className).toContain('bg-onair-loss');
  const rows = Array.from(screen.getByTestId('laptop-window').querySelectorAll('li'), (li) => li.textContent);
  expect(rows).toEqual(['Sugar Rush 1000$0.201,240x', 'Wanted Dead or a Wild$0.20310x', 'Gates of Olympus 1000$0.4096.0x']);
});

test('a profit gets the green chip', () => {
  const recap = IDLE.windows.find((w) => w.id === 'recap');
  render(<LaptopScreen laptop={{ ...IDLE, windows: [{ ...recap, won: 900, result: 300 }] }} />);
  const chip = screen.getByTestId('laptop-result');
  expect(chip.textContent).toBe('▲ $300');
  expect(chip.className).toContain('bg-onair-signal');
});

test('the history: one bar per hunt, green paid back and red short, the latest as a big number', () => {
  render(<LaptopScreen laptop={only('history')} />);
  expect(text()).toContain('Last 5 hunts');
  expect(text()).toContain('69%');
  const bars = Array.from(screen.getByTestId('laptop-window').querySelectorAll('[data-bar]'));
  expect(bars.map((b) => b.getAttribute('data-bar'))).toEqual(['h5', 'h6', 'h7', 'h8', 'h9']);
  expect(bars.map((b) => (b.className.includes('bg-onair-signal') ? 'up' : 'down'))).toEqual(['up', 'up', 'down', 'up', 'down']);
  expect(bars[1].style.height).toBe('100%');
  expect(screen.getByTestId('laptop-par').style.bottom).toMatch(/^50\.8/);
});

test('the screensaver: the bouncing GG and the board reset', () => {
  render(<LaptopScreen laptop={only('screensaver')} />);
  expect(screen.getByTestId('laptop-window').textContent).toContain('GG');
  expect(text()).toContain('Board resets in 3d 4h');
  expect(screen.getByTestId('laptop-screen').getAttribute('aria-hidden')).toBe('true');
});

test('the desktop wallpaper is the bug, small in a corner', () => {
  render(<LaptopScreen laptop={only('leaderboard')} bug="/couch/90s/halloween/pumpkin.webp" />);
  expect(screen.getByTestId('laptop-wallpaper').querySelector('img').getAttribute('src')).toBe('/couch/90s/halloween/pumpkin.webp');
});

describe('the cycle', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('a window every seven seconds, in order, wrapping, and it says which', () => {
    const onWindow = jest.fn();
    const { unmount } = render(<LaptopScreen laptop={IDLE} onWindow={onWindow} />);
    expect(shown()).toBe('leaderboard');
    step(WINDOW_MS - 1);
    expect(shown()).toBe('leaderboard');
    step(1);
    expect(shown()).toBe('recap');
    step(WINDOW_MS);
    expect(shown()).toBe('history');
    step(WINDOW_MS);
    expect(shown()).toBe('screensaver');
    step(WINDOW_MS);
    expect(shown()).toBe('leaderboard');
    expect(onWindow.mock.calls.map(([id]) => id)).toEqual(['leaderboard', 'recap', 'history', 'screensaver', 'leaderboard']);
    unmount();
    expect(onWindow).toHaveBeenLastCalledWith(null);
  });

  test('fresh data never restarts the clock', () => {
    const { rerender } = render(<LaptopScreen laptop={IDLE} />);
    step(4000);
    rerender(<LaptopScreen laptop={laptopState(F.offair.input)} />);
    step(WINDOW_MS - 4000);
    expect(shown()).toBe('recap');
  });

  test('a window that loads late joins the rotation without moving the one on screen', () => {
    const late = { ...IDLE, windows: IDLE.windows.filter((w) => w.id !== 'leaderboard') };
    const { rerender } = render(<LaptopScreen laptop={late} />);
    step(WINDOW_MS);
    expect(shown()).toBe('history');
    rerender(<LaptopScreen laptop={IDLE} />);
    expect(shown()).toBe('history');
  });

  test('a window that loads late ahead of the one on screen never replaces it', () => {
    // The hunts answer first; the board (first in the order) a moment later.
    const late = { ...IDLE, windows: IDLE.windows.filter((w) => w.id !== 'leaderboard') };
    const { rerender } = render(<LaptopScreen laptop={late} />);
    expect(shown()).toBe('recap');
    rerender(<LaptopScreen laptop={IDLE} />);
    expect(shown()).toBe('recap');
    step(WINDOW_MS);
    expect(shown()).toBe('history');
  });

  test('a window joining right after the one on screen never holds it past its seven seconds', () => {
    const pick = (...ids) => ({ ...IDLE, windows: IDLE.windows.filter((w) => ids.includes(w.id)) });
    const { rerender } = render(<LaptopScreen laptop={pick('recap', 'screensaver')} />);
    step(4000);
    rerender(<LaptopScreen laptop={pick('recap', 'history', 'screensaver')} />);
    step(WINDOW_MS - 4000);
    expect(shown()).toBe('history');
  });

  test('one window stays put', () => {
    render(<LaptopScreen laptop={only('screensaver')} />);
    for (let i = 0; i < 3; i += 1) step(WINDOW_MS);
    expect(shown()).toBe('screensaver');
  });

  test('a live hunt takes the screen over: no cycling, no window for the door to follow', () => {
    const onWindow = jest.fn();
    render(<LaptopScreen laptop={HUNT} onWindow={onWindow} />);
    expect(shown()).toBe('hunt');
    for (let i = 0; i < 3; i += 1) step(WINDOW_MS);
    expect(shown()).toBe('hunt');
    expect(onWindow.mock.calls.every(([id]) => id === null)).toBe(true);
  });

  test('reduced motion: one window holds, with no animation at all', () => {
    window.matchMedia = jest.fn((query) => ({ matches: query.includes('reduced-motion'), addEventListener() {}, removeEventListener() {} }));
    const onWindow = jest.fn();
    const { container, rerender } = render(<LaptopScreen laptop={IDLE} onWindow={onWindow} />);
    const moving = () => container.innerHTML.match(/animate-|transition/g);
    expect(moving()).toBeNull();
    for (let i = 0; i < 5; i += 1) step(WINDOW_MS);
    expect(shown()).toBe('leaderboard');
    expect(onWindow.mock.calls.map(([id]) => id)).toEqual(['leaderboard']);
    expect(moving()).toBeNull();
    rerender(<LaptopScreen laptop={HUNT} />);
    expect(moving()).toBeNull();
  });

  test('held (its door hovered or focused): the window stays, then gets its full time after', () => {
    const onWindow = jest.fn();
    const { rerender } = render(<LaptopScreen laptop={IDLE} onWindow={onWindow} held />);
    step(4000);
    for (let i = 0; i < 3; i += 1) step(WINDOW_MS);
    expect(shown()).toBe('leaderboard');
    rerender(<LaptopScreen laptop={IDLE} onWindow={onWindow} />);
    step(WINDOW_MS - 1);
    expect(shown()).toBe('leaderboard');
    step(1);
    expect(shown()).toBe('recap');
    expect(onWindow.mock.calls.map(([id]) => id)).toEqual(['leaderboard', 'recap']);
  });
});

test('a live hunt: progress, money back against the cost, the next slot and the last three opened', () => {
  render(<LaptopScreen laptop={HUNT} />);
  expect(text()).toContain('Hunt live');
  expect(screen.getByTestId('laptop-opened').textContent).toBe('14/23');
  expect(text()).toContain('$412');
  expect(text()).toContain('of $600');
  expect(screen.getByTestId('laptop-next').textContent).toBe('NextDensho$0.25');
  const rows = Array.from(screen.getByTestId('laptop-window').querySelectorAll('li'), (li) => li.textContent);
  expect(rows).toEqual(['Sugar Rush 100096.0x', 'Chaos Crew 384.0x', 'Rip City252x']);
  expect(screen.getByTestId('laptop-progress').style.transform).toBe(`scaleX(${14 / 23})`);
});

test('five-digit Canadian money wraps under itself rather than clipping', () => {
  render(<LaptopScreen laptop={laptopState(F.huntcad.input)} />);
  const money = screen.getByTestId('laptop-money');
  expect(money.textContent).toBe('CA$10,300of CA$12,500');
  expect(money.className).toContain('flex-wrap');
  expect(money.innerHTML).not.toContain('truncate');
  expect(screen.getByTestId('laptop-next').textContent).toBe('NextDenshoCA$6.25');
});

test('the start of a hunt reads as nothing back yet, with no cost or next slot to show', () => {
  render(<LaptopScreen laptop={{ mode: 'hunt', opened: 0, total: null, back: 0, cost: null, currency: null, next: null, recent: [] }} />);
  expect(text()).toContain('$0');
  expect(text()).not.toContain('of ');
  expect(screen.queryByTestId('laptop-next')).toBeNull();
  expect(screen.queryByTestId('laptop-progress')).toBeNull();
});

test('a round: the guess count and the call to action, open then locked', () => {
  const { rerender } = render(<LaptopScreen laptop={{ mode: 'open', guesses: 37 }} />);
  expect(shown()).toBe('round');
  expect(text()).toContain('Predictions open');
  expect(text()).toContain('37 guesses');
  expect(text()).toContain('Get your guess in');
  rerender(<LaptopScreen laptop={{ mode: 'locked', guesses: 1 }} />);
  expect(text()).toContain('Predictions locked');
  expect(text()).toContain('1 guess');
  expect(text()).toContain('Guesses locked');
});

test('screen text never goes below 10px', () => {
  for (const laptop of [IDLE, HUNT, { mode: 'open', guesses: 3 }]) {
    const { container, unmount } = render(<LaptopScreen laptop={laptop} />);
    const sized = container.innerHTML.match(/text-\[[^\]]*\]/g) || [];
    expect(sized.length).toBeGreaterThan(0);
    for (const cls of sized) expect(cls).toMatch(/^text-\[max\(10px,[\d.]+cqw\)\]$/);
    unmount();
  }
});

test('every window wears the same chrome: a title bar with three dots', () => {
  for (const laptop of [only('leaderboard'), only('recap'), only('history'), only('screensaver'), HUNT, { mode: 'locked', guesses: 2 }]) {
    const { unmount } = render(<LaptopScreen laptop={laptop} />);
    expect(screen.getByTestId('laptop-titlebar').querySelectorAll('[data-dot]')).toHaveLength(3);
    unmount();
  }
});
