import { formatMinutes } from '../formatMinutes';

test.each([
  [845, '14h 5m'],
  [60, '1h'],
  [5, '5m'],
  [0, '0m'],
  [null, '0m'],
  ['90', '1h 30m'],
])('%p minutes reads %p', (input, out) => {
  expect(formatMinutes(input)).toBe(out);
});
