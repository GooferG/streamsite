import { GAMBA_ITEM, NAV_ITEMS, activePageId, currentFor } from '../navItems';

test('eight pages with codes 01-08, Gamba is 04', () => {
  expect(NAV_ITEMS.map((i) => `${i.code} ${i.label} ${i.path}`)).toEqual([
    '01 Home /',
    '02 Schedule /schedule',
    '03 Vods /vods',
    '04 Gamba /gamba',
    '05 Gaming /gaming',
    '06 Store /store',
    '07 Giveaway /giveaway',
    '08 About /about',
  ]);
  expect(GAMBA_ITEM.code).toBe('04');
});

test('activePageId reads the first path segment', () => {
  expect(activePageId('/')).toBe('home');
  expect(activePageId('/gamba/hunts')).toBe('gamba');
  expect(activePageId('/admin/giveaways')).toBe('admin');
});

test('currentFor: page on its own path, true inside its section', () => {
  expect(currentFor(GAMBA_ITEM, '/gamba')).toBe('page');
  expect(currentFor(GAMBA_ITEM, '/gamba/hunts')).toBe('true');
  expect(currentFor(GAMBA_ITEM, '/schedule')).toBeUndefined();
  expect(currentFor(NAV_ITEMS[0], '/')).toBe('page');
});
