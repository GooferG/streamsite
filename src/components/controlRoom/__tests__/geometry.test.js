import {
  DOCK_W,
  MIN_H,
  clampDockW,
  clampRect,
  clampSize,
  defaultRect,
  gripSide,
  inDockZone,
  nearestCorner,
  originFor,
  pillAnchor,
  resizeFrom,
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

test('the default float position follows the width', () => {
  expect(defaultRect(1440, 500)).toEqual({ x: 924, y: 73 });
});

// Review Focus 3: a size saved on a bigger monitor fits this one.
test('clampSize keeps width and height inside the limits and the window', () => {
  expect(clampSize(null, view)).toEqual({ w: 380, h: null });
  expect(clampSize({ w: 2000, h: 5000 }, view)).toEqual({ w: 720, h: 647 });
  expect(clampSize({ w: 100, h: 10 }, view)).toEqual({ w: 320, h: 240 });
  expect(clampSize({ w: 700, h: null }, { vw: 600, vh: 720 })).toEqual({ w: 568, h: null });
});

test('clampDockW always leaves the page at least 480px', () => {
  expect(clampDockW(null, 1280)).toBe(DOCK_W);
  expect(clampDockW(900, 1280)).toBe(720);
  expect(clampDockW(900, 1000)).toBe(520);
  expect(clampDockW(100, 1280)).toBe(320);
  expect(clampDockW(500, 700)).toBe(320);
});

const START = { x: 884, y: 73, w: 380, h: 400, fixedH: null }; // snapped top-right

test('left handles pin the right edge', () => {
  expect(resizeFrom('l', START, -100, 0, view)).toEqual({ rect: { x: 784, y: 73 }, size: { w: 480, h: null } });
  expect(resizeFrom('l', START, -1000, 0, view)).toEqual({ rect: { x: 544, y: 73 }, size: { w: 720, h: null } });
  expect(resizeFrom('l', START, 500, 0, view)).toEqual({ rect: { x: 944, y: 73 }, size: { w: 320, h: null } });
  expect(resizeFrom('bl', START, -20, 30, view)).toEqual({ rect: { x: 864, y: 73 }, size: { w: 400, h: 430 } });
});

test('right handles stop at the screen edge', () => {
  const left = { ...START, x: 16 };
  expect(resizeFrom('r', left, 100, 0, view)).toEqual({ rect: { x: 16, y: 73 }, size: { w: 480, h: null } });
  expect(resizeFrom('r', { ...START, x: 900, w: 360 }, 200, 0, view).size.w).toBe(380);
  expect(resizeFrom('br', left, 40, 40, view)).toEqual({ rect: { x: 16, y: 73 }, size: { w: 420, h: 440 } });
});

test('the bottom handle sets a height within the limits', () => {
  expect(resizeFrom('b', START, 0, 100, view).size).toEqual({ w: 380, h: 500 });
  expect(resizeFrom('b', START, 0, 5000, view).size.h).toBe(647);
  expect(resizeFrom('b', START, 0, -1000, view).size.h).toBe(MIN_H);
});

test('a width-only resize keeps a height that was already set', () => {
  expect(resizeFrom('l', { ...START, fixedH: 500 }, -20, 0, view).size).toEqual({ w: 400, h: 500 });
});

test('the grip sits in the bottom corner facing the screen centre', () => {
  expect(gripSide({ x: 884, y: 73 }, 380, 1280)).toBe('bl');
  expect(gripSide({ x: 16, y: 73 }, 380, 1280)).toBe('br');
});
