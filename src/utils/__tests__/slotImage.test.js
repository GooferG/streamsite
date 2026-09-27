import { toImageUrl } from '../slotImage';
import { normalizeSlot } from '../slotCatalog';

// Review fix: 209 live catalogue thumbs carry reserved escapes (%26, %2C, %3F,
// %3D, %24). encodeURI() on them double-encodes (%2526) and breaks the giveaway
// overlay art; toImageUrl must leave an already-encoded URL untouched.
test('already-encoded art URLs come back unchanged, reserved escapes included', () => {
  const urls = [
    'https://cdn.rainbet.com/slots/1%20Reel%20-%20Wolf%20%26%20Piggies.png',
    'https://cdn.rainbet.com/slots/Hold%20%26%20Win%2C%20Deluxe%3F.png',
    'https://cdn.rainbet.com/slots/Cash%3DKing%24.png',
    'https://cdn.rainbet.com/slots/gates.png',
  ];
  for (const u of urls) expect(toImageUrl(u)).toBe(u);
});

test('raw spaces (old-style URLs) are encoded', () => {
  expect(toImageUrl('https://cdn.rainbet.com/slots/1 Reel - Aztec Spell.png')).toBe(
    'https://cdn.rainbet.com/slots/1%20Reel%20-%20Aztec%20Spell.png'
  );
});

test('missing or invalid URLs give null', () => {
  expect(toImageUrl(null)).toBeNull();
  expect(toImageUrl('')).toBeNull();
  expect(toImageUrl('not a url')).toBeNull();
});

test('catalogue thumbnail → toImageUrl round-trips to the upstream URL', () => {
  const thumb = 'https://cdn.rainbet.com/slots/3%20Blades%20%26%20Blessings.png';
  const slot = normalizeSlot({ name: '3 Blades & Blessings', provider: 'x', rainbetSlug: 'x-3', thumb });
  expect(slot.thumbnail).toBe(thumb);
  expect(toImageUrl(slot.thumbnail)).toBe(thumb);
});
