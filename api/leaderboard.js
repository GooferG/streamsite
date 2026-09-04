// Public leaderboard proxy.
//
// GET /api/leaderboard -> { board, source, cachedAt }
//
// The Rainbet "code BEAN" leaderboard is polled and published by the bean site
// (beantwitch.com). Its tRPC procedure `leaderBoard.getLatest` is public and
// already server-masked (handles like `2A***r`, opaque salted player ids), so
// this proxies that read rather than talking to Rainbet directly — one source
// of truth for standings, period dates and the prize ladder, all maintained in
// bean's admin. Bean recounts every 15 minutes, so a short cache here costs
// nothing in freshness.
//
// `board` is bean's `Leaderboard` shape (see bean Site/src/lib/leaderboard/
// types.ts): { id, title, prizePool, rankingField, closesAt, fetchedAt,
// paidPlaces, tierCount, entries: [{ rank, maskedHandle, playerId,
// weightedWager, prize, delta, tier }] }. It is `null` when bean has nothing
// polled yet; the client renders that as unavailable, never as an empty board.

const BEAN_SITE_URL = (process.env.BEAN_SITE_URL || 'https://www.beantwitch.com').replace(/\/+$/, '');
const UPSTREAM_PATH = '/api/trpc/leaderBoard.getLatest';
const CACHE_TTL_MS = 60 * 1000;
const UPSTREAM_TIMEOUT_MS = 8000;

// In-memory cache, per warm function instance: { board, cachedAt, expiresAt }
let cache = null;

// Unwrap the tRPC + superjson envelope: { result: { data: { json: <board> } } }
function unwrapBoard(payload) {
  const data = payload && payload.result && payload.result.data;
  if (!data || typeof data !== 'object') {
    throw new Error('Unrecognised upstream envelope');
  }
  // superjson nests under `json`; a transformer-less response would be bare.
  const board = 'json' in data ? data.json : data;
  if (board === null) return null;
  if (!board || !Array.isArray(board.entries)) {
    throw new Error('Upstream board missing entries');
  }
  // Anonymous read: `isSelf` is always false and just noise for our client.
  return {
    ...board,
    entries: board.entries.map(({ isSelf, ...entry }) => entry),
  };
}

async function fetchUpstream() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const upstream = await fetch(`${BEAN_SITE_URL}${UPSTREAM_PATH}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!upstream.ok) {
      throw new Error(`Upstream HTTP ${upstream.status}`);
    }
    const payload = await upstream.json();
    return unwrapBoard(payload);
  } finally {
    clearTimeout(timer);
  }
}

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

  // Let Vercel's edge share one upstream read across visitors too.
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

  if (cache && Date.now() < cache.expiresAt) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json({ board: cache.board, source: BEAN_SITE_URL, cachedAt: cache.cachedAt });
  }

  try {
    const board = await fetchUpstream();
    const cachedAt = Date.now();
    cache = { board, cachedAt, expiresAt: cachedAt + CACHE_TTL_MS };
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json({ board, source: BEAN_SITE_URL, cachedAt });
  } catch (error) {
    console.error('leaderboard proxy error:', error);
    // Stale standings beat no standings; the client shows the count time.
    if (cache && cache.board) {
      res.setHeader('X-Cache', 'STALE');
      return res.status(200).json({ board: cache.board, source: BEAN_SITE_URL, cachedAt: cache.cachedAt, stale: true });
    }
    return res.status(502).json({ error: 'Leaderboard unavailable' });
  }
}
