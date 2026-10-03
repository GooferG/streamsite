import {
  localeSeparators,
  parseAmountInput,
  formatAmountInput,
  significantBefore,
  caretAfter,
} from '../amountInput';

const EN = { group: ',', decimal: '.' };
const AR = { group: '.', decimal: ',' };

test('reads the separators of a locale', () => {
  expect(localeSeparators('en-US')).toEqual(EN);
  expect(localeSeparators('es-AR')).toEqual(AR);
});

test('parses typed text into a canonical dot-decimal string', () => {
  expect(parseAmountInput('1,850,000.50', EN)).toBe('1850000.50');
  expect(parseAmountInput('1.850.000,50', AR)).toBe('1850000.50');
  expect(parseAmountInput('', EN)).toBe('');
});

test('the other mark is grouping: an es-AR viewer typing dots gets thousands', () => {
  expect(parseAmountInput('1.850.000', AR)).toBe('1850000');
});

test('keeps two decimals, one decimal mark, and drops junk', () => {
  expect(parseAmountInput('12.345', EN)).toBe('12.34');
  expect(parseAmountInput('1.2.3', EN)).toBe('1.23');
  expect(parseAmountInput('ARS 9a9', EN)).toBe('99');
});

test('a leading decimal mark reads as zero, leading zeros go', () => {
  expect(parseAmountInput('.5', EN)).toBe('0.5');
  expect(parseAmountInput('0007', EN)).toBe('7');
  expect(parseAmountInput('0.', EN)).toBe('0.');
});

test('a thirteenth whole digit is rejected, not trimmed off the end', () => {
  expect(parseAmountInput('123,456,789,012', EN)).toBe('123456789012');
  expect(parseAmountInput('1293,456,789,012', EN)).toBeNull();
});

test('formats the canonical string grouped in the viewer locale', () => {
  expect(formatAmountInput('1850000.50', EN)).toBe('1,850,000.50');
  expect(formatAmountInput('1850000.50', AR)).toBe('1.850.000,50');
  expect(formatAmountInput('1850000.', EN)).toBe('1,850,000.');
  expect(formatAmountInput('999', EN)).toBe('999');
  expect(formatAmountInput('', EN)).toBe('');
});

test('the caret lands after the same digit once grouping is redone', () => {
  // "18,500" with a 0 typed after the 5: the caret sits after that new 0.
  const typed = '18,5000';
  const before = significantBefore(typed, 5, '.');
  const formatted = formatAmountInput(parseAmountInput(typed, EN), EN);
  expect(formatted).toBe('185,000');
  expect(formatted.slice(0, caretAfter(formatted, before, '.'))).toBe('185,0');
});

test('caret helpers handle the edges', () => {
  expect(caretAfter('1,850', 0, '.')).toBe(0);
  expect(caretAfter('1,850', 99, '.')).toBe(5);
  expect(significantBefore('1,850.5', 7, '.')).toBe(6);
});
