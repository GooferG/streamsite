import { DEFAULT_STORE, STORAGE_KEY, isOpenMode, readStore, sanitizeStore, writeStore } from '../storage';

beforeEach(() => localStorage.clear());
afterEach(() => jest.restoreAllMocks());

test('an empty browser gets the defaults', () => {
  expect(readStore()).toEqual(DEFAULT_STORE);
});

test('round-trips through localStorage', () => {
  const value = { ...DEFAULT_STORE, mode: 'dock', restoreTo: 'dock', rect: { x: 10, y: 80 }, corner: 'bl', tab: 'predict', stage: true, hideLiveBadge: true };
  writeStore(value);
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual(value);
  expect(readStore()).toEqual(value);
});

// Review Focus 1: garbage and stale shapes load the defaults.
test('broken JSON loads the defaults', () => {
  localStorage.setItem(STORAGE_KEY, '{not json');
  expect(readStore()).toEqual(DEFAULT_STORE);
});

test('a stale or hand-edited shape falls back field by field', () => {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ mode: 'maximized', restoreTo: 'pill', rect: { x: '10', y: 5 }, corner: 'middle', tab: 'chat', stage: 'yes', hideLiveBadge: 1 })
  );
  expect(readStore()).toEqual(DEFAULT_STORE);
});

test('keeps the valid fields of a partly valid shape', () => {
  expect(sanitizeStore({ mode: 'pill', rect: { x: 12, y: 90 }, tab: 'predict' })).toEqual({
    ...DEFAULT_STORE,
    mode: 'pill',
    rect: { x: 12, y: 90 },
    tab: 'predict',
  });
});

test('blocked storage never throws', () => {
  jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('quota');
  });
  expect(readStore()).toEqual(DEFAULT_STORE);
  expect(() => writeStore(DEFAULT_STORE)).not.toThrow();
});

test('only float and dock count as open', () => {
  expect(['closed', 'pill', 'float', 'dock'].map(isOpenMode)).toEqual([false, false, true, true]);
});

test('size, dock width and redeem prefs round-trip', () => {
  const value = {
    ...DEFAULT_STORE,
    tab: 'redeem',
    size: { w: 500, h: null },
    dockW: 480,
    redeemSeenAt: 1_700_000_000_000,
    redeemFilter: 'payouts',
  };
  writeStore(value);
  expect(readStore()).toEqual(value);
});

test('sizes outside the limits are pulled back in', () => {
  expect(sanitizeStore({ size: { w: 2000, h: 50 }, dockW: 5000 })).toMatchObject({ size: { w: 720, h: 240 }, dockW: 720 });
  expect(sanitizeStore({ size: { w: 100, h: null }, dockW: 10 })).toMatchObject({ size: { w: 320, h: null }, dockW: 320 });
});

test('broken size and redeem fields fall back', () => {
  expect(sanitizeStore({ size: 'big', dockW: 'wide', redeemSeenAt: -5, redeemFilter: 'payout' })).toEqual(DEFAULT_STORE);
  expect(sanitizeStore({ size: { w: '400', h: 300 } }).size).toBeNull();
  expect(sanitizeStore({ size: { w: 400, h: 'tall' } }).size).toEqual({ w: 400, h: null });
});
