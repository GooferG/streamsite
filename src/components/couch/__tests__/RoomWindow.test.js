import { fireEvent, render, screen } from '@testing-library/react';
import { WindowFront, WindowOutside, moonBox, useWindowState } from '../RoomWindow';
import { moonPath, moonPhase } from '../moon';
import { ART_ASPECT, LAYOUT, intersects } from '../couchLayout';

const WIN = {
  glass: [70, 10, 20, 40],
  blinds: { src: '/blinds.webp', rect: [69, 8, 22, 14] },
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
const raise = (c) => fireEvent.pointerDown(toy(c, 'cord'));

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

test('half-closed blinds leave the moon pokeable and shrink the sky to the strip below them', () => {
  const { container } = render(<Window />);
  fireEvent.pointerDown(toy(container, 'moon'));
  expect(screen.getByTestId('window-moon').getAttribute('class')).toMatch(/animate-couch-blink/);
  const strip = toy(container, 'sky');
  expect(strip.style.top).toBe('22%');
  expect(strip.style.height).toBe('28%');
  raise(container);
  expect(toy(container, 'sky').style.top).toBe('10%');
  expect(toy(container, 'sky').style.height).toBe('40%');
});

test('a moon under the blinds is inert until the cord is pulled', () => {
  const covering = { ...WIN, blinds: { src: '/blinds.webp', rect: [69, 8, 22, 42] } };
  function Covered() {
    const state = useWindowState();
    return (
      <div>
        <WindowOutside win={covering} state={state} now={ECLIPSE} />
        <WindowFront win={covering} state={state} aspect={16 / 9} />
      </div>
    );
  }
  const { container } = render(<Covered />);
  expect(toy(container, 'moon').getAttribute('class')).toMatch(/pointer-events-none/);
  fireEvent.pointerDown(toy(container, 'moon'));
  expect(screen.getByTestId('window-moon').getAttribute('class')).not.toMatch(/blink/);
  raise(container);
  expect(toy(container, 'moon').getAttribute('class')).not.toMatch(/pointer-events-none/);
  fireEvent.pointerDown(toy(container, 'moon'));
  expect(screen.getByTestId('window-moon').getAttribute('class')).toMatch(/animate-couch-blink/);
});

test('moonPath crescents and gibbous moons, waxing and waning', () => {
  expect(moonPath(0.1)).toBe('M 50 0 A 50 50 0 0 1 50 100 A 40.45 50 0 0 0 50 0 Z');
  expect(moonPath(0.4)).toBe('M 50 0 A 50 50 0 0 1 50 100 A 40.45 50 0 0 1 50 0 Z');
  expect(moonPath(0.6)).toBe('M 50 0 A 50 50 0 0 0 50 100 A 40.45 50 0 0 0 50 0 Z');
  expect(moonPath(0.9)).toBe('M 50 0 A 50 50 0 0 0 50 100 A 40.45 50 0 0 1 50 0 Z');
});

test('moonPhase: the full moon of 26 October 2026', () => {
  expect(Math.abs(moonPhase(Date.UTC(2026, 9, 26, 4)) - 0.5)).toBeLessThan(0.03);
});

test('the window toys and blinds never overlap a door', () => {
  const win = LAYOUT.window;
  const rects = [win.glass, win.cord, win.blinds && win.blinds.rect, moonBox(win.glass, false, ART_ASPECT, win.blinds && win.blinds.rect), moonBox(win.glass, true, ART_ASPECT, win.blinds && win.blinds.rect)].filter(Boolean);
  for (const r of rects) {
    for (const [id, door] of Object.entries(LAYOUT.doors)) {
      expect([id, intersects(r, door.rect)]).toEqual([id, false]);
    }
  }
});

test('moonBox centres the moon in the glass the blinds leave uncovered', () => {
  const glass = [70, 10, 20, 40];
  const blinds = [69, 8, 22, 14]; // bottom at 22
  const [, y, , h] = moonBox(glass, false, 16 / 9, blinds);
  expect(y).toBeCloseTo(22 + (50 - 22 - h) / 2, 6);
  expect(moonBox(glass, false, 16 / 9)).toEqual(moonBox(glass, false, 16 / 9, null));
  // Blinds that end above the glass leave the default placement.
  expect(moonBox(glass, false, 16 / 9, [69, 0, 22, 5])).toEqual(moonBox(glass, false, 16 / 9));
});

test('a box taller than the strip stays inside the glass', () => {
  const glass = [70, 10, 20, 40];
  const [, y, , h] = moonBox(glass, true, 4, [69, 0, 22, 45]);
  expect(y).toBeGreaterThanOrEqual(10);
  expect(y + h).toBeLessThanOrEqual(50 + 1e-9);
});

test('in the real layout both moons start below the blinds, inside the glass', () => {
  const { glass, blinds } = LAYOUT.window;
  const bottom = blinds.rect[1] + blinds.rect[3];
  for (const harvest of [false, true]) {
    const [x, y, w, h] = moonBox(glass, harvest, ART_ASPECT, blinds.rect);
    expect(y).toBeGreaterThanOrEqual(bottom - 1e-9);
    expect(y).toBeGreaterThanOrEqual(glass[1]);
    expect(y + h).toBeLessThanOrEqual(glass[1] + glass[3] + 1e-9);
    expect(x + w).toBeLessThanOrEqual(glass[0] + glass[2] + 1e-9);
  }
});

test('with the real layout the moon winks without pulling the cord', () => {
  const win = LAYOUT.window;
  function Real() {
    const state = useWindowState();
    return (
      <div>
        <WindowOutside win={win} state={state} now={ECLIPSE} theme={null} />
        <WindowFront win={win} state={state} theme={null} aspect={ART_ASPECT} />
      </div>
    );
  }
  const { container } = render(<Real />);
  expect(toy(container, 'moon').getAttribute('class')).not.toMatch(/pointer-events-none/);
  fireEvent.pointerDown(toy(container, 'moon'));
  expect(screen.getByTestId('window-moon').getAttribute('class')).toMatch(/animate-couch-blink/);
});
