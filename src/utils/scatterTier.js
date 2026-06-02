// Derives a single exclusive scatter tier from a bonus's legacy booleans.
// Storage keeps `super` + `fiveScat` (+ additive `hidden`); the tier is derived
// here so all render sites agree and no Firestore migration is needed.
// Five-scatter wins when both legacy flags are set on old data.
export function scatterTier(b) {
  if (b && b.fiveScat) {
    const hidden = !!b.hidden;
    return {
      key: 'five',
      hidden,
      full: hidden ? 'HIDDEN 5 SCATTER' : '5 SCATTER',
      short: hidden ? 'HID 5★' : '5 SCAT',
      tone: 'gold',
    };
  }
  if (b && b.super) {
    return { key: 'super', hidden: false, full: 'SUPER', short: 'SUPER', tone: 'orange' };
  }
  return null;
}

// Convenience: the tier as a plain cycle key, including 'regular'.
export function scatterTierKey(b) {
  const t = scatterTier(b);
  return t ? t.key : 'regular';
}
