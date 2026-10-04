import { MAX_ZOOM, REST, coverBox, pctRect, toCss, viewRect, zoomTransform } from '../cameraMath';

const mapped = (stage, z, p) => ({ x: stage.x + z.x + z.scale * p.x, y: stage.y + z.y + z.scale * p.y });

test('pctRect turns percent of a box into pixels', () => {
  expect(pctRect({ x: 10, y: 20, width: 200, height: 100 }, [50, 10, 25, 50])).toEqual({ x: 110, y: 30, width: 50, height: 50 });
});

test('zoomTransform centres the target in the view and fills 90% of its tighter side', () => {
  const stage = { x: 0, y: 57, width: 1600, height: 900 };
  const target = pctRect(stage, [40, 30, 20, 25]);
  const view = { x: 0, y: 57, width: 1600, height: 843 };
  const z = zoomTransform(stage, target, view);
  expect(z.scale).toBeCloseTo(0.9 * Math.min(1600 / 320, 843 / 225), 5);
  const centre = mapped(stage, z, { x: target.x - stage.x + target.width / 2, y: target.y - stage.y + target.height / 2 });
  expect(centre.x).toBeCloseTo(800, 5);
  expect(centre.y).toBeCloseTo(57 + 843 / 2, 5);
});

test('zoomTransform never passes the cap', () => {
  const stage = { x: 0, y: 0, width: 1000, height: 600 };
  const z = zoomTransform(stage, { x: 500, y: 300, width: 10, height: 10 }, { x: 0, y: 0, width: 1000, height: 600 });
  expect(z.scale).toBe(MAX_ZOOM);
});

test('toCss writes translate then scale', () => {
  expect(toCss({ scale: 2, x: -10, y: 5.5 })).toBe('translate(-10px, 5.5px) scale(2)');
  expect(toCss(REST)).toBe('translate(0px, 0px) scale(1)');
});

test('coverBox fills a wide container edge to edge without exposing the top', () => {
  expect(coverBox({ width: 1600, height: 800 }, 16 / 9, [51, 43])).toEqual({ width: 1600, height: 900, left: 0, top: 0 });
});

test('coverBox on a tall container centres the focal point horizontally', () => {
  const b = coverBox({ width: 1000, height: 1000 }, 16 / 9, [51, 43]);
  expect(b.height).toBe(1000);
  expect(b.left).toBeCloseTo(500 - 0.51 * b.width, 5);
  expect(b.top).toBe(0);
});

test('coverBox at 21:9 keeps the art covering the container', () => {
  const c = { width: 2100, height: 900 };
  const b = coverBox(c, 16 / 9, [50, 50]);
  expect(b.width).toBe(2100);
  expect(b.top).toBeLessThanOrEqual(0);
  expect(b.top + b.height).toBeGreaterThanOrEqual(c.height);
});

test('viewRect is the window under the nav', () => {
  expect(viewRect({ innerWidth: 1280, innerHeight: 800 }, 57)).toEqual({ x: 0, y: 57, width: 1280, height: 743 });
});
