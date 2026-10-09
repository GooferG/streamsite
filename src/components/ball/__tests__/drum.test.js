import { render } from '@testing-library/react';
import { BALL_R, createDrum, stepDrum, syncDrum } from '../drumPhysics';
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

test('syncDrum: survivors stay put, new ids spawn above the pile, removed ids go, order follows ids', () => {
  const drum = createDrum(0);
  syncDrum(drum, ['a', 'b', 'c']);
  for (let i = 0; i < 120; i += 1) stepDrum(drum, 1 / 60, 0);
  const before = { ...drum.byId.get('c') };
  syncDrum(drum, ['c', 'd', 'a']);
  expect(drum.balls.map((b) => b.id)).toEqual(['c', 'd', 'a']);
  expect(drum.byId.has('b')).toBe(false);
  expect(drum.byId.get('c')).toEqual(before);
  expect(drum.byId.get('d').y).toBeLessThan(0);
});

test('DrumRig: positioning is the caller\'s, and no element is both relative and absolute', () => {
  const { container } = render(<DrumRig count={3} tube riding className="absolute left-[7%] w-[30%]" />);
  const root = container.firstChild;
  expect(root.classList.contains('absolute')).toBe(true);
  for (const el of container.querySelectorAll('*')) {
    expect(el.classList.contains('relative') && el.classList.contains('absolute')).toBe(false);
  }
  expect(container.querySelector('canvas').parentElement.classList.contains('h-full')).toBe(true);
  expect(container.querySelector('.gb-stand').classList.contains('aspect-[5/2]')).toBe(true);
  expect(container.querySelector('.gb-base').classList.contains('aspect-[74/9]')).toBe(true);
});

test('DrumCanvas still mode: draws once, and again when a ball arrives', () => {
  const ctx = {
    setTransform: jest.fn(), clearRect: jest.fn(), beginPath: jest.fn(), arc: jest.fn(), fill: jest.fn(),
    save: jest.fn(), restore: jest.fn(), clip: jest.fn(), drawImage: jest.fn(),
    createRadialGradient: jest.fn(() => ({ addColorStop: jest.fn() })),
  };
  HTMLCanvasElement.prototype.getContext.mockReturnValue(ctx);
  const mk = (n) => Array.from({ length: n }, (_, i) => ({ id: `b${i}`, slotId: `s${i}` }));
  const { rerender } = render(<DrumCanvas balls={mk(3)} still />);
  expect(ctx.arc).toHaveBeenCalled();
  ctx.arc.mockClear();
  rerender(<DrumCanvas balls={mk(4)} still />);
  expect(ctx.arc).toHaveBeenCalled();
});

test('DrumRig: tube and riding ball are optional', () => {
  const { container, rerender } = render(<DrumRig count={3} />);
  expect(container.querySelector('.gb-tube')).toBeNull();
  rerender(<DrumRig count={3} tube riding />);
  expect(container.querySelector('.gb-tube .gb-rise')).toBeTruthy();
});
