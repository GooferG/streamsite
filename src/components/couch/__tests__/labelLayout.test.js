import { resolveLabels } from '../labelLayout';

const bounds = { x: 0, y: 0, w: 1000, h: 600 };
const box = (id, x, y, w = 120, h = 30, objectW = 200) => ({ id, x, y, w, h, objectW });
const apply = (boxes, offsets) =>
  boxes.map((b, i) => ({ x: b.x + offsets[i].dx, y: b.y + offsets[i].dy, w: b.w, h: b.h }));
const overlaps = (a, b, gap = 0) => a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
const anyOverlap = (rects, gap = 0) => rects.some((a, i) => rects.some((b, j) => i < j && overlaps(a, b, gap)));

test('labels that do not touch stay put', () => {
  const boxes = [box('a', 100, 100), box('b', 400, 100), box('c', 100, 300)];
  expect(resolveLabels(boxes, { bounds }).map((o) => [o.dx, o.dy])).toEqual([[0, 0], [0, 0], [0, 0]]);
});

test('offsets come back in input order with ids', () => {
  const boxes = [box('b', 400, 100), box('a', 100, 100)];
  expect(resolveLabels(boxes, { bounds }).map((o) => o.id)).toEqual(['b', 'a']);
});

test('overlapping labels separate with the gap, preferring a sideways move', () => {
  const boxes = [box('a', 100, 100), box('b', 150, 105)];
  const out = resolveLabels(boxes, { bounds, gap: 4 });
  expect(anyOverlap(apply(boxes, out), 4)).toBe(false);
  expect(out[0]).toMatchObject({ dx: 0, dy: 0 });
  expect(out[1].dy).toBe(0);
  expect(out[1].dx).not.toBe(0);
});

test('a sideways move stays within half the object width, then it lifts', () => {
  // identical boxes: a 50px reach cannot clear 120px of label, so b lifts
  const boxes = [box('a', 100, 100, 120, 30, 100), box('b', 100, 100, 120, 30, 100)];
  const out = resolveLabels(boxes, { bounds, gap: 4 });
  expect(anyOverlap(apply(boxes, out), 4)).toBe(false);
  expect(Math.abs(out[1].dx)).toBeLessThanOrEqual(50);
  expect(out[1].dy).toBeLessThan(0);
});

test('never leaves the bounds', () => {
  const boxes = [box('a', 2, 3), box('b', 20, 8), box('c', 870, 3), box('d', 880, 6)];
  const out = resolveLabels(boxes, { bounds, gap: 4 });
  apply(boxes, out).forEach((r) => {
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.x + r.w).toBeLessThanOrEqual(1000);
    expect(r.y).toBeGreaterThanOrEqual(0);
  });
});

test('a label resting outside the sides is pulled in', () => {
  const out = resolveLabels([box('a', -30, 100), box('b', 950, 100)], { bounds });
  expect(out[0].dx).toBe(30);
  expect(out[1].dx).toBe(-70);
});

test('a crowd resolves with no overlaps', () => {
  const boxes = [];
  for (let i = 0; i < 8; i++) boxes.push(box(`k${i}`, 300 + i * 20, 200 + (i % 3) * 6, 140, 30, 160));
  const out = resolveLabels(boxes, { bounds, gap: 4 });
  expect(anyOverlap(apply(boxes, out), 4)).toBe(false);
});

test('stable: input order does not change the result, and re-running repeats it', () => {
  const boxes = [box('a', 100, 100), box('b', 150, 105), box('c', 200, 98)];
  const byId = (list) => Object.fromEntries(resolveLabels(list, { bounds }).map((o) => [o.id, o]));
  expect(byId([...boxes].reverse())).toEqual(byId(boxes));
  expect(byId(boxes)).toEqual(byId(boxes));
});
