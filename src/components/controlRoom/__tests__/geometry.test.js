import {
  clampRect,
  defaultRect,
  inDockZone,
  nearestCorner,
  originFor,
  pillAnchor,
  shouldUndock,
  snapToCorner,
} from '../geometry';

const size = { w: 380, h: 400 };
const view = { vw: 1280, vh: 720 };

test('floats top-right under the nav by default', () => {
  expect(defaultRect(1440)).toEqual({ x: 1044, y: 73 });
});

// Review Focus 2: a position saved on a bigger monitor comes back on screen.
test('clamps a saved position that is off screen', () => {
  expect(clampRect({ x: 5000, y: 5000 }, size, view)).toEqual({ x: 1232, y: 684 });
  expect(clampRect({ x: -5000, y: -40 }, size, view)).toEqual({ x: -332, y: 57 });
});

test('snaps within 24px of a corner, and only then', () => {
  expect(snapToCorner({ x: 880, y: 80 }, size, view)).toEqual({ rect: { x: 884, y: 73 }, corner: 'tr' });
  expect(snapToCorner({ x: 30, y: 200 }, size, view)).toEqual({ rect: { x: 30, y: 200 }, corner: null });
});

test('nearest corner goes by the panel centre', () => {
  expect(nearestCorner({ x: 900, y: 500 }, size, view)).toBe('br');
  expect(nearestCorner({ x: 10, y: 60 }, size, view)).toBe('tl');
});

test('dock zone is the last 48px; undock needs a 64px pull', () => {
  expect(inDockZone(1232, 1280)).toBe(true);
  expect(inDockZone(1231, 1280)).toBe(false);
  expect(shouldUndock(1200, 1136)).toBe(false);
  expect(shouldUndock(1200, 1135)).toBe(true);
});

test('the pill clears the LIVE badge on the right and follows the dock', () => {
  expect(pillAnchor('br', 'float')).toEqual({ right: 16, bottom: 104 });
  expect(pillAnchor('tl', 'float')).toEqual({ left: 16, top: 73 });
  expect(pillAnchor('tl', 'dock')).toEqual({ right: 16, bottom: 104 });
  expect(originFor('bl', 'float')).toBe('bottom left');
  expect(originFor('tl', 'dock')).toBe('bottom right');
});
