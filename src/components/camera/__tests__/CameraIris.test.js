import { irisFrame } from '../CameraIris';

// r: a hole that clears the window (phone, 1080p, a big DPR-2 screen).
const RADII = [470, 1144, 2400];
const OPENNESS = [1, 0.5, 0.1, 0.02, 0.005, 0.001];

test('at every scale the bars stand inside the square\'s black ring: never in the hole, never past the square', () => {
  for (const r of RADII) {
    for (const s of OPENNESS) {
      const { hole, half, bars } = irisFrame(r, s);
      expect(bars).toBeGreaterThan(hole);
      expect(bars).toBeLessThan(half);
    }
  }
});

test('open, the hole is the full radius and the bars sit past it, off the window', () => {
  const { hole, bars } = irisFrame(1144, 1);
  expect(hole).toBe(1144);
  expect(bars).toBeGreaterThan(1144);
});

test('the square is trimmed close to its hole: a side of at most 2.25 hole radii', () => {
  const { hole, half } = irisFrame(1000, 1);
  expect((2 * half) / hole).toBeLessThanOrEqual(2.25);
});
