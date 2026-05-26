import { formatUSD, maskUsername, formatPosition } from '../format';

describe('formatUSD', () => {
  it('formats whole dollars with commas and dollar sign', () => {
    expect(formatUSD(23434853)).toBe('$23,434,853');
  });

  it('returns $0 for zero', () => {
    expect(formatUSD(0)).toBe('$0');
  });

  it('handles small numbers without decimals', () => {
    expect(formatUSD(1500)).toBe('$1,500');
  });

  it('treats null/undefined as $0', () => {
    expect(formatUSD(null)).toBe('$0');
    expect(formatUSD(undefined)).toBe('$0');
  });

  it('formats negative numbers (defensive)', () => {
    expect(formatUSD(-200)).toBe('-$200');
  });
});

describe('maskUsername', () => {
  it('keeps first 2 and last 1 character, masks the middle with ****', () => {
    expect(maskUsername('Neverleavehome')).toBe('Ne****e');
  });

  it('handles short usernames by keeping first char and last char', () => {
    expect(maskUsername('abcd')).toBe('a****d');
  });

  it('returns empty string for empty input', () => {
    expect(maskUsername('')).toBe('');
  });

  it('returns the input unchanged when length is 1', () => {
    expect(maskUsername('x')).toBe('x');
  });
});

describe('formatPosition', () => {
  it('zero-pads to 2 digits and prefixes with P', () => {
    expect(formatPosition(1)).toBe('P01');
    expect(formatPosition(7)).toBe('P07');
    expect(formatPosition(20)).toBe('P20');
  });

  it('does not truncate 3-digit positions', () => {
    expect(formatPosition(100)).toBe('P100');
  });
});
