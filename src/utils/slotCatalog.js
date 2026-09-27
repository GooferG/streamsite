// Normalizes the communityhunts.gg slot catalogue (GET /api/slots) into the
// shape Slot Picker and SlotAutocomplete use. communityhunts sends provider
// slugs and free-form volatility; this is the one place that turns them into
// display names and the picker's low / medium / high buckets.

// Same provider under two slugs upstream.
const PROVIDER_ALIASES = {
  'play-n-go': 'playn-go',
  'hacksaw-gaming': 'hacksaw',
  'ace-roll': 'aceroll',
  'kitsune-studios': 'kitsune',
  'clutch-gaming': 'clutch',
};

// Display names where title-casing the slug gets it wrong.
const PROVIDER_NAMES = {
  'playn-go': "Play'n GO",
  bgaming: 'BGaming',
  netent: 'NetEnt',
  pgsoft: 'PG Soft',
  isoftbet: 'iSoftBet',
  nolimit: 'Nolimit City',
  'elk-studios': 'ELK Studios',
  '1spin4win': '1spin4win',
  avatarux: 'AvatarUX',
  gameart: 'GameArt',
  onetouch: 'OneTouch',
  'peter-sons': 'Peter & Sons',
  hacksaw: 'Hacksaw Gaming',
  relax: 'Relax Gaming',
  truelab: 'TrueLab',
  nownow: 'NowNow',
  blueprint: 'Blueprint Gaming',
  fantasma: 'Fantasma Games',
  aceroll: 'Ace Roll',
  kitsune: 'Kitsune Studios',
  clutch: 'Clutch Gaming',
};

const VOLATILITY_BUCKETS = {
  low: 'low',
  'medium-low': 'low',
  'low-medium': 'low',
  medium: 'medium',
  med: 'medium',
  'medium-high': 'medium',
  high: 'high',
  'very-high': 'high',
  extreme: 'high',
};

export function canonicalProvider(slug) {
  const s = String(slug || '').trim().toLowerCase();
  if (!s) return 'unknown';
  return PROVIDER_ALIASES[s] || s;
}

export function providerDisplayName(slug) {
  const canonical = canonicalProvider(slug);
  if (canonical === 'unknown') return null;
  if (PROVIDER_NAMES[canonical]) return PROVIDER_NAMES[canonical];
  return canonical
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function volatilityBucket(v) {
  if (v == null) return null;
  const key = String(v).trim().toLowerCase().replace(/\s+/g, '-');
  return VOLATILITY_BUCKETS[key] || null;
}

export function isMegaways(name) {
  return /megaways/i.test(String(name || ''));
}

// communityhunts sends Rainbet art URLs percent-encoded ("1%20Reel…").
// Consumers (AdminGiveawaysPage.saveSlot) encodeURI() the thumbnail, so hand
// them the unencoded form, like the old static list. Malformed escapes stay raw.
export function decodeThumb(url) {
  if (!url) return null;
  try {
    return decodeURI(url);
  } catch {
    return url;
  }
}

const finiteOrNull = (n) => (typeof n === 'number' && Number.isFinite(n) ? n : null);

export function normalizeSlot(row) {
  const id = row.rainbetSlug || row.slug || row.name;
  return {
    id,
    slug: id,
    name: row.name,
    provider: providerDisplayName(row.provider),
    providerSlug: canonicalProvider(row.provider),
    thumbnail: decodeThumb(row.thumb),
    rtp: finiteOrNull(row.rtp),
    volatility: volatilityBucket(row.volatility),
    bonusBuy: row.bonusBuy === true,
    megaways: isMegaways(row.name),
    maxWin: finiteOrNull(row.maxWin),
  };
}

export function normalizeCatalog(rows) {
  if (!Array.isArray(rows)) return [];
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    if (!row || !row.name) continue;
    const slot = normalizeSlot(row);
    if (seen.has(slot.id)) continue;
    seen.add(slot.id);
    out.push(slot);
  }
  return out;
}

export function providersFrom(slots) {
  const bySlug = new Map();
  for (const s of slots || []) {
    if (!s.provider || s.providerSlug === 'unknown' || bySlug.has(s.providerSlug)) continue;
    bySlug.set(s.providerSlug, { name: s.provider, slug: s.providerSlug });
  }
  return Array.from(bySlug.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
  );
}
