import { getSlotCatalog } from './_lib/communityHunts.js';

// Slot catalogue for Slot Picker and the slot search box, re-served from the
// communityhunts.gg /slots endpoint (the Rainbet list, re-synced nightly).
// The rows change at most daily, so cache hard: 6h in memory per instance,
// a day on the CDN, and serve the last good copy if communityhunts is down.
//
// GET /api/slots -> { slots: Row[] }

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_CONTROL = 'public, s-maxage=86400, stale-while-revalidate=604800';

let cache = null; // { data, expiresAt }; expired entries stay as the stale fallback

export function __resetCacheForTests() {
  cache = null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.COMMUNITYHUNTS_API_KEY) {
    console.error('slots: COMMUNITYHUNTS_API_KEY is not set.');
    return res.status(503).json({ error: 'NOT_CONFIGURED' });
  }

  if (cache && Date.now() < cache.expiresAt) {
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('Cache-Control', CACHE_CONTROL);
    return res.status(200).json(cache.data);
  }

  try {
    const data = { slots: await getSlotCatalog() };
    cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', CACHE_CONTROL);
    return res.status(200).json(data);
  } catch (err) {
    if (cache) {
      res.setHeader('X-Cache', 'STALE');
      return res.status(200).json(cache.data);
    }
    console.error('slots proxy error:', (err && err.code) || (err && err.message));
    return res.status(502).json({ error: 'UPSTREAM_UNAVAILABLE' });
  }
}
