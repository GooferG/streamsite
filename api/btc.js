const UPSTREAM =
  'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true';

let cache = null;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

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

  if (cache && Date.now() < cache.expiresAt) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(cache.data);
  }

  try {
    const upstream = await fetch(UPSTREAM);
    const raw = await upstream.json();

    if (!upstream.ok || !raw?.bitcoin) {
      throw new Error('Bad upstream response');
    }

    const data = {
      usd: raw.bitcoin.usd,
      change24h: raw.bitcoin.usd_24h_change,
      fetchedAt: Date.now(),
    };

    cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };

    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(data);
  } catch (error) {
    console.error('btc proxy error:', error);

    if (cache) {
      res.setHeader('X-Cache', 'STALE');
      return res.status(200).json(cache.data);
    }

    return res.status(500).json({ error: 'Proxy error' });
  }
}
