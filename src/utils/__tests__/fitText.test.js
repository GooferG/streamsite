import { fitFontSize } from '../fitText';

function cqi(css) {
  return Number(/([\d.]+)cqi/.exec(css)[1]);
}

test('returns a clamp between the given rem bounds', () => {
  expect(fitFontSize('1,850', { min: 1, max: 2 })).toMatch(/^clamp\(1rem, [\d.]+cqi, 2rem\)$/);
});

test('longer figures get a smaller container-relative size', () => {
  expect(cqi(fitFontSize('1,850,000'))).toBeLessThan(cqi(fitFontSize('1,850')));
  expect(cqi(fitFontSize('185,000,000'))).toBeLessThan(cqi(fitFontSize('1,850,000')));
});

test('separators count narrower than digits', () => {
  expect(cqi(fitFontSize('1,850'))).toBeGreaterThan(cqi(fitFontSize('18500')));
});

test('empty text does not divide by zero', () => {
  expect(fitFontSize('')).toMatch(/^clamp\(/);
});
