import { gateFrame, BOOT_MS, GATE_MS } from '../crtTimeline';

test('power-on starts as a bright dot on a black tube', () => {
  const f = gateFrame(0);
  expect(f.dot).toBe(1);
  expect(f.backing).toBe(1);
  expect(f.stat).toBe(0);
});

test('static is at full strength with the beam gone just before the signal locks', () => {
  const f = gateFrame(BOOT_MS - 1);
  expect(f.stat).toBeCloseTo(1);
  expect(f.dot).toBe(0);
  expect(f.line).toBe(0);
  expect(f.backing).toBe(1);
  expect(f.locking).toBe(false);
});

test('signal lock begins once the boot finishes', () => {
  expect(gateFrame(BOOT_MS).locking).toBe(true);
});

test('the tube thins out while the signal locks', () => {
  const mid = gateFrame(BOOT_MS + (GATE_MS - BOOT_MS) / 2);
  expect(mid.backing).toBeGreaterThan(0);
  expect(mid.backing).toBeLessThan(1);
  expect(mid.stat).toBeLessThan(1);
});

test('the sequence ends fully transparent so nothing is left covering the page', () => {
  const f = gateFrame(GATE_MS);
  expect(f.backing).toBe(0);
  expect(f.stat).toBe(0);
  expect(f.done).toBe(true);
});
