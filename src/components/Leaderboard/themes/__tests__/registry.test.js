import { THEMES, DEFAULT_THEME_ID } from '../index';

describe('theme registry', () => {
  it('every entry has id, label, and a Component', () => {
    THEMES.forEach((t) => {
      expect(typeof t.id).toBe('string');
      expect(typeof t.label).toBe('string');
      expect(t.Component).toBeTruthy();
    });
  });

  it('theme ids are unique', () => {
    const ids = THEMES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('DEFAULT_THEME_ID exists in THEMES', () => {
    expect(THEMES.some((t) => t.id === DEFAULT_THEME_ID)).toBe(true);
  });

  it('default theme is the first entry (broadcast)', () => {
    expect(THEMES[0].id).toBe(DEFAULT_THEME_ID);
    expect(DEFAULT_THEME_ID).toBe('broadcast');
  });
});
