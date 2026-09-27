import {
  getLiveHunt,
  getRecentHunts,
  getHunt,
  trimHunt,
  CommunityHuntsError,
} from './_lib/communityHunts.js';

// Public read endpoint behind the Hunts tab. The browser never talks to
// communityhunts.gg directly: this keeps the key server-side and, with a 30s
// cache plus CDN s-maxage, keeps us well under the Bean community's shared
// 300 reads/min.
//
// GET ?view=overview        -> { live, recent }
// GET ?view=hunt&id=<id>    -> { hunt }

const CACHE_TTL_MS = 30 * 1000;
const CACHE_CONTROL = 'public, s-maxage=30, stale-while-revalidate=60';
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

// key -> { data, expiresAt }. Expired entries stay as the stale fallback.
const cache = new Map();

export function __resetCacheForTests() {
  cache.clear();
}

async function load(view, id) {
  if (view === 'overview') {
    const [live, recent] = await Promise.all([getLiveHunt(), getRecentHunts(10)]);
    return { live: trimHunt(live), recent: recent.map(trimHunt) };
  }
  return { hunt: trimHunt(await getHunt(id)) };
}

// view=hunt only serves GooferG's own hunts: ids from the (cached) overview.
// Anything else 404s without an upstream read, so random ids can't drain the
// Bean community's shared rate limit or proxy other owners' hunts.
async function ownerHuntIds() {
  const entry = cache.get('overview');
  let data = entry && entry.data;
  if (!entry || Date.now() >= entry.expiresAt) {
    try {
      data = await load('overview');
      cache.set('overview', { data, expiresAt: Date.now() + CACHE_TTL_MS });
    } catch (err) {
      if (!data) throw err; // no stale overview to fall back on
    }
  }
  const ids = new Set();
  if (data.live && data.live.id) ids.add(data.live.id);
  for (const h of data.recent || []) if (h && h.id) ids.add(h.id);
  return ids;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const view = req.query && req.query.view;
  const id = req.query && req.query.id;
  if (view !== 'overview' && view !== 'hunt') {
    return res.status(400).json({ error: 'INVALID_VIEW' });
  }
  if (view === 'hunt' && !ID_RE.test(String(id || ''))) {
    return res.status(400).json({ error: 'INVALID_ID' });
  }
  if (!process.env.COMMUNITYHUNTS_API_KEY) {
    console.error('communityhunts: COMMUNITYHUNTS_API_KEY is not set.');
    return res.status(503).json({ error: 'NOT_CONFIGURED' });
  }

  const key = view === 'hunt' ? `hunt:${id}` : 'overview';
  const cached = cache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('Cache-Control', CACHE_CONTROL);
    return res.status(200).json(cached.data);
  }

  try {
    if (view === 'hunt' && !(await ownerHuntIds()).has(id)) {
      return res.status(404).json({ error: 'NOT_FOUND' });
    }
    const data = await load(view, id);
    cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', CACHE_CONTROL);
    return res.status(200).json(data);
  } catch (err) {
    if (err instanceof CommunityHuntsError && err.status === 404) {
      return res.status(404).json({ error: 'NOT_FOUND' });
    }
    if (cached) {
      res.setHeader('X-Cache', 'STALE');
      return res.status(200).json(cached.data);
    }
    console.error('communityhunts proxy error:', (err && err.code) || (err && err.message));
    return res.status(502).json({ error: 'UPSTREAM_UNAVAILABLE' });
  }
}
