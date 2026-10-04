import { formatViewerCount } from '../viewers';

test('formats thousands with one decimal and K', () => {
  expect(formatViewerCount(1204)).toBe('1.2K');
  expect(formatViewerCount(1000)).toBe('1.0K');
});

test('plain number below a thousand, null when unknown', () => {
  expect(formatViewerCount(37)).toBe('37');
  expect(formatViewerCount(0)).toBe('0');
  expect(formatViewerCount(null)).toBeNull();
  expect(formatViewerCount(undefined)).toBeNull();
});
