import { render } from '@testing-library/react';
import { BALL_R, createDrum, stepDrum } from '../drumPhysics';
import DrumCanvas from '../DrumCanvas';
import DrumRig from '../DrumRig';

beforeEach(() => {
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

const meanY = (drum) => drum.balls.reduce((s, b) => s + b.y, 0) / drum.balls.length;

test('balls never leave the drum and never go NaN', () => {
  const drum = createDrum(40);
  for (let i = 0; i < 600; i += 1) stepDrum(drum, 1 / 60, i % 200 < 100 ? 1 : 0.2);
  for (const b of drum.balls) {
    expect(Number.isFinite(b.x) && Number.isFinite(b.y)).toBe(true);
    expect(Math.hypot(b.x, b.y)).toBeLessThanOrEqual(1 - BALL_R + 1e-6);
  }
});

test('the blower lifts the pile', () => {
  const calm = createDrum(30);
  const blown = createDrum(30);
  for (let i = 0; i < 300; i += 1) {
    stepDrum(calm, 1 / 60, 0);
    stepDrum(blown, 1 / 60, 1);
  }
  expect(meanY(blown)).toBeLessThan(meanY(calm));
});

test('the same seed gives the same drum', () => {
  expect(createDrum(5, { seed: 3 }).balls).toEqual(createDrum(5, { seed: 3 }).balls);
});

test('DrumCanvas: a canvas, and "+N more" past the cap', () => {
  const balls = Array.from({ length: 64 }, (_, i) => ({ id: `b${i}`, slotId: `s${i}` }));
  const { container, getByText } = render(<DrumCanvas balls={balls} maxBalls={60} />);
  expect(container.querySelector('canvas')).toBeTruthy();
  expect(getByText('+4 more')).toBeTruthy();
});

test('DrumCanvas: a plain count works without ball data', () => {
  const { queryByText } = render(<DrumCanvas count={12} />);
  expect(queryByText(/more/)).toBeNull();
});

test('DrumRig: tube and riding ball are optional', () => {
  const { container, rerender } = render(<DrumRig count={3} />);
  expect(container.querySelector('.gb-tube')).toBeNull();
  rerender(<DrumRig count={3} tube riding />);
  expect(container.querySelector('.gb-tube .gb-rise')).toBeTruthy();
});
