/**
 * @jest-environment node
 */
import { buildSlotIndex, dice, editDistance, matchSlot, normalizeName, toCatalogSlot } from '../../api/_lib/slotMatch.js';

const ROWS = [
  { rainbetSlug: 'gates-of-olympus', name: 'Gates of Olympus', thumb: 'https://img/goo.png', bonusBuy: true },
  { rainbetSlug: 'gates-of-olympus-1000', name: 'Gates of Olympus 1000', bonusBuy: true },
  { rainbetSlug: 'gates-of-olympus-xmas-1000', name: 'Gates of Olympus Xmas 1000', bonusBuy: true },
  { rainbetSlug: 'sweet-bonanza', name: 'Sweet Bonanza', bonusBuy: true },
  { rainbetSlug: 'sweet-bonanza-1000', name: 'Sweet Bonanza 1000', bonusBuy: true },
  { rainbetSlug: 'sweet-bonanza-xmas', name: 'Sweet Bonanza Xmas', bonusBuy: true },
  { rainbetSlug: 'the-dog-house', name: 'The Dog House', bonusBuy: true },
  { rainbetSlug: 'wanted-dead-or-a-wild', name: 'Wanted Dead or a Wild', bonusBuy: true },
  { rainbetSlug: 'book-of-dead', name: 'Book of Dead', bonusBuy: false },
  { rainbetSlug: 'sugar-rush', name: 'Sugar Rush', bonusBuy: true },
  { rainbetSlug: 'sugar-rush-1000', name: 'Sugar Rush 1000', bonusBuy: true },
  { rainbetSlug: 'fire-and-roses-joker', name: 'Fire & Roses Joker', bonusBuy: true },
  { rainbetSlug: 'pinata-wins', name: 'Piñata Wins', bonusBuy: true },
  { rainbetSlug: 'big-bass-bonanza', name: 'Big Bass Bonanza', bonusBuy: true },
  { rainbetSlug: 'big-bass-splash', name: 'Big Bass Splash', bonusBuy: true },
  { slug: 'no-rainbet-slug', name: 'Fallback Slug', bonusBuy: true },
  { name: '' },
];
const ALIASES = { gates: 'Gates of Olympus', sugar: 'Sugar Rush', wanted: 'Wanted Dead or a Wild', ghost: 'Not In The Catalogue' };
const index = buildSlotIndex(ROWS, ALIASES);
const id = (q) => {
  const m = matchSlot(index, q);
  return m.slot ? `${m.kind}:${m.slot.id}` : m.kind;
};

test('normalizeName', () => {
  expect(normalizeName('  GATES   of   Olympus!! ')).toBe('gates of olympus');
  expect(normalizeName('The Dog House')).toBe('dog house');
  expect(normalizeName('Fire & Roses Joker')).toBe('fire and roses joker');
  expect(normalizeName('Piñata Wins')).toBe('pinata wins');
  expect(normalizeName('🎰🎰🎰')).toBe('');
});

test('editDistance counts a transposition as one edit', () => {
  expect(editDistance('olympus', 'olympus')).toBe(0);
  expect(editDistance('olympsu', 'olympus')).toBe(1);
  expect(editDistance('bonanza', 'bonamza')).toBe(1);
  expect(editDistance('abc', '')).toBe(3);
});

test('dice', () => {
  expect(dice('abc', 'abc')).toBe(1);
  expect(dice('a', 'b')).toBe(0);
  expect(dice('sweetbonanzaa', 'sweetbonanza')).toBeGreaterThan(0.9);
});

test('toCatalogSlot prefers the rainbet slug, then slug, then name; drops nameless rows', () => {
  expect(toCatalogSlot(ROWS[0])).toEqual({ id: 'gates-of-olympus', name: 'Gates of Olympus', thumb: 'https://img/goo.png', bonusBuy: true });
  expect(toCatalogSlot(ROWS[15]).id).toBe('no-rainbet-slug');
  expect(toCatalogSlot({ name: 'Only Name' }).id).toBe('Only Name');
  expect(toCatalogSlot({ name: '' })).toBeNull();
});

test('exact names, the space-free form, & and accents', () => {
  expect(id('Gates of Olympus')).toBe('exact:gates-of-olympus');
  expect(id('GATES   OF olympus!!')).toBe('exact:gates-of-olympus');
  expect(id('doghouse')).toBe('exact:the-dog-house');
  expect(id('fire and roses joker')).toBe('exact:fire-and-roses-joker');
  expect(id('pinata wins')).toBe('exact:pinata-wins');
  expect(id('sweet bonanza')).toBe('exact:sweet-bonanza');
});

test('nicknames; an alias to a missing slot is ignored', () => {
  expect(id('gates')).toBe('alias:gates-of-olympus');
  expect(id('Wanted')).toBe('alias:wanted-dead-or-a-wild');
  expect(id('ghost')).toBe('none');
});

test('partial names: the plain version wins, typos are forgiven', () => {
  expect(id('gates olympus')).toBe('guess:gates-of-olympus');
  expect(id('gates of olympsu')).toBe('guess:gates-of-olympus');
  expect(id('olympus 1000')).toBe('guess:gates-of-olympus-1000');
  expect(id('rush')).toBe('guess:sugar-rush');
  expect(id('olymp xmas')).toBe('guess:gates-of-olympus-xmas-1000');
});

test('a tie is ambiguous and offers up to three, shortest name first', () => {
  const m = matchSlot(index, 'big bass');
  expect(m.kind).toBe('ambiguous');
  expect(m.options.map((s) => s.name)).toEqual(['Big Bass Splash', 'Big Bass Bonanza']);
});

test('fuzzy fallback takes a clear winner', () => {
  expect(id('sweetbonanzaa')).toBe('guess:sweet-bonanza');
});

test('nothing close, emoji-only and empty input are none (never throws)', () => {
  expect(id('zzzz qqqq')).toBe('none');
  expect(id('🎰🎰🎰')).toBe('none');
  expect(id('')).toBe('none');
  expect(id('x'.repeat(300))).toBe('none');
});

test('the matcher does not judge bonus buys (the command does)', () => {
  const m = matchSlot(index, 'book of dead');
  expect(m.kind).toBe('exact');
  expect(m.slot.bonusBuy).toBe(false);
});

test('a word that only starts a one-word name does not beat names containing the exact word', () => {
  const small = buildSlotIndex(
    [
      { rainbetSlug: 'book-of-dead', name: 'Book of Dead', bonusBuy: true },
      { rainbetSlug: 'dead-or-alive', name: 'Dead or Alive', bonusBuy: true },
      { rainbetSlug: 'deadwood', name: 'Deadwood', bonusBuy: true },
    ],
    {},
  );
  const m = matchSlot(small, 'dead');
  expect(m.kind).toBe('ambiguous');
  expect(m.options.map((s) => s.name)).toEqual(['Book of Dead', 'Dead or Alive', 'Deadwood']);
});
