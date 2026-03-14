const API_KEY = 'Vxqf1SnCumEuSoo4ucj6CYtzqUTypMjt2kCS0sQWkfHnrNFmsV';
const BASE_URL = 'https://slotslaunch.com/api';

// In-memory cache keyed by path + query string
const cache = {};
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour — games don't change often

const ALLOWED_PATHS = ['games', 'providers', 'types', 'themes'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { path, ...rest } = req.query;
  if (!path || !ALLOWED_PATHS.includes(path)) {
    return res.status(400).json({ error: `Invalid path. Use: ${ALLOWED_PATHS.join(', ')}` });
  }

  // Build upstream query string, passing all remaining params through
  const upstreamParams = new URLSearchParams(rest).toString();
  const upstreamUrl = `${BASE_URL}/${path}${upstreamParams ? '?' + upstreamParams : ''}`;
  const cacheKey = path + (upstreamParams ? '|' + upstreamParams : '');

  // Serve from cache if still fresh
  const cached = cache[cacheKey];
  if (cached && Date.now() < cached.expiresAt) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(cached.data);
  }

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        Accept: 'application/json',
      },
    });

    const data = await upstream.json();

    if (upstream.ok) {
      cache[cacheKey] = { data, expiresAt: Date.now() + CACHE_TTL_MS };
    }

    res.setHeader('X-Cache', 'MISS');
    return res.status(upstream.status).json(data);
  } catch (error) {
    console.error('slots proxy error:', error);
    // Return stale cache on network failure rather than hard error
    if (cached) {
      res.setHeader('X-Cache', 'STALE');
      return res.status(200).json(cached.data);
    }
    return res.status(500).json({ error: 'Proxy error' });
  }
}
