import {
  canonicalProvider,
  providerDisplayName,
  volatilityBucket,
  isMegaways,
  normalizeSlot,
  normalizeCatalog,
  providersFrom,
} from '../slotCatalog';

test('provider display names: overrides, title-case, aliases', () => {
  expect(providerDisplayName('playn-go')).toBe("Play'n GO");
  expect(providerDisplayName('play-n-go')).toBe("Play'n GO");
  expect(providerDisplayName('pgsoft')).toBe('PG Soft');
  expect(providerDisplayName('isoftbet')).toBe('iSoftBet');
  expect(providerDisplayName('nolimit')).toBe('Nolimit City');
  expect(providerDisplayName('hacksaw-gaming')).toBe('Hacksaw Gaming');
  expect(providerDisplayName('pragmatic-play')).toBe('Pragmatic Play');
  expect(providerDisplayName('big-time-gaming')).toBe('Big Time Gaming');
  expect(providerDisplayName('3-oaks')).toBe('3 Oaks');
  expect(providerDisplayName('')).toBeNull();
  expect(providerDisplayName(null)).toBeNull();
  expect(canonicalProvider('kitsune-studios')).toBe('kitsune');
  expect(canonicalProvider(null)).toBe('unknown');
});

test('volatility buckets cover every observed upstream value', () => {
  const cases = {
    high: 'high', 'very-high': 'high', 'very high': 'high', extreme: 'high', High: 'high',
    medium: 'medium', 'medium-high': 'medium', med: 'medium', Medium: 'medium',
    low: 'low', 'medium-low': 'low', 'low-medium': 'low',
    variable: null,
  };
  for (const [input, bucket] of Object.entries(cases)) {
    expect(volatilityBucket(input)).toBe(bucket);
  }
  expect(volatilityBucket(null)).toBeNull();
  expect(volatilityBucket(undefined)).toBeNull();
});

test('megaways is detected from the name', () => {
  expect(isMegaways('Bonanza Megaways')).toBe(true);
  expect(isMegaways('Extra Chilli MEGAWAYS')).toBe(true);
  expect(isMegaways('Gates of Olympus')).toBe(false);
});

test('normalizeSlot maps a catalogue row to the UI shape', () => {
  expect(
    normalizeSlot({
      name: 'Bonanza Megaways', provider: 'big-time-gaming', slug: 'bonanza-megaways',
      rainbetSlug: 'big-time-gaming-bonanza-megaways',
      thumb: 'https://cdn.rainbet.com/slots/Bonanza%20Megaways.png',
      bonusBuy: null, rtp: 96, volatility: 'very-high', maxWin: 12000,
    })
  ).toEqual({
    id: 'big-time-gaming-bonanza-megaways',
    slug: 'big-time-gaming-bonanza-megaways',
    name: 'Bonanza Megaways',
    provider: 'Big Time Gaming',
    providerSlug: 'big-time-gaming',
    thumbnail: 'https://cdn.rainbet.com/slots/Bonanza%20Megaways.png',
    rtp: 96,
    volatility: 'high',
    bonusBuy: false,
    megaways: true,
    maxWin: 12000,
  });
});

test('normalizeCatalog drops unnamed rows and dedupes by id', () => {
  const rows = [
    { name: 'A', provider: 'bgaming', rainbetSlug: 'bgaming-a' },
    { name: 'A again', provider: 'bgaming', rainbetSlug: 'bgaming-a' },
    { name: '', provider: 'bgaming', rainbetSlug: 'bgaming-x' },
    { name: 'B', provider: 'netent', slug: 'b' },
  ];
  const out = normalizeCatalog(rows);
  expect(out.map((s) => s.id)).toEqual(['bgaming-a', 'b']);
  expect(out[0].name).toBe('A');
  expect(normalizeCatalog(null)).toEqual([]);
});

test('providersFrom gives unique, sorted providers with aliases merged', () => {
  const slots = normalizeCatalog([
    { name: 'x1', provider: 'hacksaw', rainbetSlug: '1' },
    { name: 'x2', provider: 'hacksaw-gaming', rainbetSlug: '2' },
    { name: 'x3', provider: 'bgaming', rainbetSlug: '3' },
    { name: 'x4', provider: null, rainbetSlug: '4' },
  ]);
  expect(providersFrom(slots)).toEqual([
    { name: 'BGaming', slug: 'bgaming' },
    { name: 'Hacksaw Gaming', slug: 'hacksaw' },
  ]);
});
