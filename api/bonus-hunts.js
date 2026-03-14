const API_KEY = 'bnt_b493e9020cf2ecb1e4a8043cb1ea1941a8555a1fa2c90e62f411b6cdb0aba14c';
const BASE_URL = 'https://bonushunt.gg';

// In-memory cache: { [path]: { data, expiresAt } }
const cache = {};
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // path param allows: /api/bonus-hunts?path=hunts or ?path=hunt/someId
  const { path } = req.query;
  if (!path) {
    return res.status(400).json({ error: 'Missing path param' });
  }

  // Serve from cache if still fresh
  const cached = cache[path];
  if (cached && Date.now() < cached.expiresAt) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(cached.data);
  }

  try {
    const upstream = await fetch(`${BASE_URL}/api/public/${path}`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    const data = await upstream.json();

    if (upstream.ok) {
      cache[path] = { data, expiresAt: Date.now() + CACHE_TTL_MS };
    }

    res.setHeader('X-Cache', 'MISS');
    return res.status(upstream.status).json(data);
  } catch (error) {
    console.error('bonus-hunts proxy error:', error);

    // If we have stale cache, return it rather than failing
    if (cached) {
      res.setHeader('X-Cache', 'STALE');
      return res.status(200).json(cached.data);
    }

    return res.status(500).json({ error: 'Proxy error' });
  }
}
