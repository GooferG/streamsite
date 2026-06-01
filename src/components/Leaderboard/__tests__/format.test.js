import {
  formatUSD,
  maskUsername,
  formatPosition,
  formatOrdinalPlace,
} from '../format';

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

describe('formatOrdinalPlace', () => {
  it('uses st/nd/rd for 1/2/3', () => {
    expect(formatOrdinalPlace(1)).toBe('1st place');
    expect(formatOrdinalPlace(2)).toBe('2nd place');
    expect(formatOrdinalPlace(3)).toBe('3rd place');
  });

  it('uses th for 4 through 10', () => {
    expect(formatOrdinalPlace(4)).toBe('4th place');
    expect(formatOrdinalPlace(10)).toBe('10th place');
  });

  it('uses th for the 11/12/13 exception (not st/nd/rd)', () => {
    expect(formatOrdinalPlace(11)).toBe('11th place');
    expect(formatOrdinalPlace(12)).toBe('12th place');
    expect(formatOrdinalPlace(13)).toBe('13th place');
  });

  it('resumes st/nd/rd for 21/22/23', () => {
    expect(formatOrdinalPlace(21)).toBe('21st place');
    expect(formatOrdinalPlace(22)).toBe('22nd place');
    expect(formatOrdinalPlace(23)).toBe('23rd place');
  });

  it('returns empty string for non-positive or invalid input', () => {
    expect(formatOrdinalPlace(0)).toBe('');
    expect(formatOrdinalPlace(-1)).toBe('');
    expect(formatOrdinalPlace(undefined)).toBe('');
  });
});
