import { fireEvent, render, screen } from '@testing-library/react';
import { WindowFront, WindowOutside, moonBox, useWindowState } from '../RoomWindow';
import { moonPath, moonPhase } from '../moon';

const WIN = {
  glass: [70, 10, 20, 40],
  blinds: { src: '/blinds.webp', rect: [69, 8, 22, 30] },
  cord: [90, 20, 1, 15],
  skyline: { src: '/sky.webp', rect: [70, 38, 20, 12] },
};
const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
const ECLIPSE = Date.UTC(2000, 0, 21, 4, 40); // a full moon (the total lunar eclipse of January 2000)

function Window({ theme = null, now = ECLIPSE, witch }) {
  const state = useWindowState();
  return (
    <div>
      <WindowOutside win={WIN} state={state} now={now} theme={theme} witch={witch} />
      <WindowFront win={WIN} state={state} theme={theme} aspect={16 / 9} />
    </div>
  );
}
const toy = (c, id) => c.querySelector(`[data-toy="${id}"]`);

test('moonPhase: a known new moon, half a month later, and a known full moon', () => {
  expect(moonPhase(NEW_MOON)).toBeCloseTo(0, 5);
  expect(moonPhase(NEW_MOON + 14.765294 * 86400000)).toBeCloseTo(0.5, 3);
  expect(Math.abs(moonPhase(ECLIPSE) - 0.5)).toBeLessThan(0.03);
});

test('moonPath draws new, half and full moons', () => {
  expect(moonPath(0)).toBe('M 50 0 A 50 50 0 0 1 50 100 A 50 50 0 0 0 50 0 Z');
  expect(moonPath(0.25)).toBe('M 50 0 A 50 50 0 0 1 50 100 A 0 50 0 0 0 50 0 Z');
  expect(moonPath(0.5)).toBe('M 50 0 A 50 50 0 0 0 50 100 A 50 50 0 0 0 50 0 Z');
  expect(moonPath(0.75)).toBe('M 50 0 A 50 50 0 0 0 50 100 A 0 50 0 0 0 50 0 Z');
});

test("the outside shows tonight's moon, stars and the skyline, all decorative", () => {
  const { container } = render(<Window />);
  const out = screen.getByTestId('window-outside');
  expect(out.getAttribute('aria-hidden')).toBe('true');
  expect(screen.getByTestId('window-moon').getAttribute('data-phase')).toBe('0.49');
  expect(out.querySelectorAll('.couch-star').length).toBeGreaterThan(5);
  expect(out.querySelector('img').getAttribute('src')).toBe('/sky.webp');
  expect(screen.queryByTestId('window-bats')).toBeNull();
  expect(container.querySelectorAll('[aria-hidden="true"][data-toy]').length).toBe(3);
});

test('tapping the sky sends a shooting star; tapping the moon makes it wink', () => {
  const { container } = render(<Window />);
  fireEvent.pointerDown(toy(container, 'sky'));
  expect(screen.getByTestId('window-shooting')).toBeTruthy();
  fireEvent.pointerDown(toy(container, 'moon'));
  expect(screen.getByTestId('window-moon').getAttribute('class')).toMatch(/animate-couch-blink/);
});

test('the cord rolls the blinds up and down', () => {
  const { container } = render(<Window />);
  fireEvent.pointerDown(toy(container, 'cord'));
  expect(screen.getByTestId('window-blinds').getAttribute('data-up')).toBe('true');
  fireEvent.pointerDown(toy(container, 'cord'));
  expect(screen.getByTestId('window-blinds').getAttribute('data-up')).toBe('false');
});

test('Halloween: a harvest moon, bats, and every third moon tap a witch', () => {
  const { container } = render(<Window theme="halloween" witch="/witch.webp" />);
  expect(screen.getByTestId('window-moon').getAttribute('data-phase')).toBe('0.50');
  expect(screen.getByTestId('window-bats')).toBeTruthy();
  const moon = toy(container, 'moon');
  fireEvent.pointerDown(moon);
  fireEvent.pointerDown(moon);
  expect(screen.queryByTestId('window-witch')).toBeNull();
  fireEvent.pointerDown(moon);
  expect(screen.getByTestId('window-witch').getAttribute('src')).toBe('/witch.webp');
});

test('moonBox is square on screen', () => {
  const [x, y, w, h] = moonBox([70, 10, 20, 40], false, 16 / 9);
  expect(x).toBeCloseTo(82, 5);
  expect(y).toBeCloseTo(28.4, 5);
  expect(w).toBeCloseTo(3.6, 5);
  expect(h).toBeCloseTo((3.6 * 16) / 9, 5);
});

test('no glass, no window', () => {
  function Bare() {
    const state = useWindowState();
    return <WindowOutside win={{}} state={state} now={ECLIPSE} />;
  }
  const { container } = render(<Bare />);
  expect(container.innerHTML).toBe('');
});
