import { scatterTier, scatterTierKey } from '../scatterTier';

describe('scatterTier', () => {
  it('returns null for a regular bonus', () => {
    expect(scatterTier({})).toBeNull();
    expect(scatterTier({ super: false, fiveScat: false })).toBeNull();
    expect(scatterTier(null)).toBeNull();
  });

  it('returns the super tier', () => {
    const t = scatterTier({ super: true });
    expect(t.key).toBe('super');
    expect(t.full).toBe('SUPER');
    expect(t.short).toBe('SUPER');
    expect(t.tone).toBe('orange');
    expect(t.hidden).toBe(false);
  });

  it('returns the five-scatter tier (not hidden)', () => {
    const t = scatterTier({ fiveScat: true });
    expect(t.key).toBe('five');
    expect(t.full).toBe('5 SCATTER');
    expect(t.short).toBe('5 SCAT');
    expect(t.tone).toBe('gold');
    expect(t.hidden).toBe(false);
  });

  it('returns the hidden five-scatter tier', () => {
    const t = scatterTier({ fiveScat: true, hidden: true });
    expect(t.key).toBe('five');
    expect(t.full).toBe('HIDDEN 5 SCATTER');
    expect(t.short).toBe('HID 5★');
    expect(t.tone).toBe('gold');
    expect(t.hidden).toBe(true);
  });

  it('lets five-scatter win when both legacy flags are set', () => {
    const t = scatterTier({ super: true, fiveScat: true });
    expect(t.key).toBe('five');
  });

  it('ignores hidden on a non-five bonus', () => {
    const t = scatterTier({ super: true, hidden: true });
    expect(t.key).toBe('super');
    expect(t.hidden).toBe(false);
  });
});

describe('scatterTierKey', () => {
  it('returns regular when no tier', () => {
    expect(scatterTierKey({})).toBe('regular');
  });
  it('returns the tier key otherwise', () => {
    expect(scatterTierKey({ super: true })).toBe('super');
    expect(scatterTierKey({ fiveScat: true })).toBe('five');
    expect(scatterTierKey({ fiveScat: true, hidden: true })).toBe('five');
  });
});
