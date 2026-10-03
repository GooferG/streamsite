import { formatMoney, formatMoneyCompact, moneyParts } from '../money';
import { roundCurrency, roundTotalCost } from '../predictionRound';

test('formatMoney without currency keeps the site $ format', () => {
  expect(formatMoney(1318.8)).toBe('$1,318.80');
  expect(formatMoney(-5)).toBe('-$5.00');
  expect(formatMoney(1234.4, null, { decimals: 0 })).toBe('$1,234');
});

test('formatMoney with a currency uses Intl', () => {
  expect(formatMoney(1318.8, 'CAD')).toBe('CA$1,318.80');
  expect(formatMoney(76344.23, 'ARS')).toMatch(/ARS\s?76,344\.23/);
});

test('formatMoney returns an em dash for missing values', () => {
  expect(formatMoney(null)).toBe('—');
  expect(formatMoney(undefined, 'CAD')).toBe('—');
  expect(formatMoney('')).toBe('—');
  expect(formatMoney('abc')).toBe('—');
});

// Review Focus 3: a code Intl rejects must not throw.
test('formatMoney falls back when Intl rejects the currency code', () => {
  expect(formatMoney(1234, 'USDT')).toBe('USDT 1,234.00');
});

test('formatMoneyCompact matches the old number-line format without currency', () => {
  expect(formatMoneyCompact(1234)).toBe('$1.2k');
  expect(formatMoneyCompact(950)).toBe('$950');
  expect(formatMoneyCompact(null)).toBe('—');
  expect(formatMoneyCompact(76344, 'ARS')).toMatch(/ARS\s?76\.3K/);
});

test('moneyParts splits the currency code from the figure', () => {
  expect(moneyParts(1850000, 'ARS', { decimals: 0 })).toEqual({ code: 'ARS', amount: '1,850,000' });
  expect(moneyParts(3103.62, 'CAD')).toEqual({ code: 'CAD', amount: '3,103.62' });
  expect(moneyParts(1234.4, null, { decimals: 0 })).toEqual({ code: '$', amount: '1,234' });
  expect(moneyParts(-5, null, { decimals: 0 })).toEqual({ code: '$', amount: '-5' });
  expect(moneyParts(null, 'ARS')).toEqual({ code: 'ARS', amount: '—' });
});

test('roundCurrency / roundTotalCost read the right source', () => {
  const ch = { source: 'communityhunts', bonusHuntSnapshot: { currency: 'CAD', totalCost: 3103.62 } };
  const manual = { source: 'manual', manualTotalCost: 500 };
  expect(roundCurrency(ch)).toBe('CAD');
  expect(roundTotalCost(ch)).toBe(3103.62);
  expect(roundCurrency(manual)).toBeNull();
  expect(roundTotalCost(manual)).toBe(500);
  expect(roundTotalCost(null)).toBe(0);
  expect(roundTotalCost({ source: 'manual', manualTotalCost: null })).toBe(0);
});
