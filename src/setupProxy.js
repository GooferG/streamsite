const { createProxyMiddleware } = require('http-proxy-middleware');

// Dev-only secrets — read from env (.env.local), no longer committed. Set
// COMMUNITYHUNTS_API_KEY in .env.local for the local API mirrors.

// communityhunts.gg dev mirror (see api/communityhunts.js). Reads the same
// server-only COMMUNITYHUNTS_* vars from .env.local.
const CH_BASE = (
  process.env.COMMUNITYHUNTS_API_URL || 'https://api.communityhunts.gg/api/public/v1'
).replace(/\/+$/, '');
const CH_OWNER = process.env.COMMUNITYHUNTS_OWNER_ID || 'usr_IT8I88O03xF3QHqHzqme95';

async function chDevGet(path) {
  const upstream = await fetch(`${CH_BASE}${path}`, {
    headers: { Authorization: `Bearer ${process.env.COMMUNITYHUNTS_API_KEY || ''}` },
  });
  if (!upstream.ok) {
    const err = new Error(`communityhunts ${upstream.status}`);
    err.status = upstream.status;
    throw err;
  }
  return upstream.json();
}

// /api/me/* (daily claim) needs Firebase admin, which can't run in the CRA dev
// server. Proxy it to the deployed functions. Override with API_PROXY_TARGET.
const DEPLOYED_API_TARGET =
  process.env.API_PROXY_TARGET || 'https://goofer.tv';

if (!process.env.COMMUNITYHUNTS_API_KEY) {
  // eslint-disable-next-line no-console
  console.warn(
    '[setupProxy] COMMUNITYHUNTS_API_KEY not set in .env.local — ' +
      '/api/communityhunts and /api/slots dev mirrors will fail until it is.'
  );
}

module.exports = function (app) {
  // Dev handler for /api/communityhunts (mirrors the Vercel function).
  app.get('/api/communityhunts', async (req, res) => {
    const { view, id } = req.query;
    try {
      if (view === 'overview') {
        const [live, recent] = await Promise.all([
          chDevGet(`/hunts?status=live&ownerId=${CH_OWNER}&view=full&limit=1`),
          chDevGet(`/hunts?ownerId=${CH_OWNER}&view=summary&limit=10`),
        ]);
        return res.status(200).json({ live: live.data[0] || null, recent: recent.data });
      }
      if (view === 'hunt' && /^[A-Za-z0-9_-]{1,64}$/.test(String(id || ''))) {
        const hunt = await chDevGet(`/hunts/${id}`);
        return res.status(200).json({ hunt: hunt.data });
      }
      return res.status(400).json({ error: 'INVALID_VIEW' });
    } catch (e) {
      return res
        .status(e.status === 404 ? 404 : 502)
        .json({ error: e.status === 404 ? 'NOT_FOUND' : 'UPSTREAM_UNAVAILABLE' });
    }
  });

  // Dev handler for /api/leaderboard (mirrors the Vercel function): proxies the
  // bean site's public tRPC board read. Override host with BEAN_SITE_URL.
  app.get('/api/leaderboard', async (_req, res) => {
    const base = (process.env.BEAN_SITE_URL || 'https://www.beantwitch.com').replace(/\/+$/, '');
    try {
      const upstream = await fetch(`${base}/api/trpc/leaderBoard.getLatest`, {
        headers: { Accept: 'application/json' },
      });
      if (!upstream.ok) return res.status(502).json({ error: 'Leaderboard unavailable' });
      const payload = await upstream.json();
      const data = payload && payload.result && payload.result.data;
      const board = data && 'json' in data ? data.json : data;
      res.status(200).json({ board: board ?? null, source: base, cachedAt: Date.now() });
    } catch (e) {
      res.status(502).json({ error: 'Leaderboard unavailable' });
    }
  });

  // Dev handler for /api/btc (mirrors the Vercel function)
  app.get('/api/btc', async (_req, res) => {
    try {
      const upstream = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true'
      );
      const raw = await upstream.json();
      if (!upstream.ok || !raw?.bitcoin) {
        return res.status(502).json({ error: 'Bad upstream response' });
      }
      res.status(200).json({
        usd: raw.bitcoin.usd,
        change24h: raw.bitcoin.usd_24h_change,
        fetchedAt: Date.now(),
      });
    } catch (e) {
      res.status(500).json({ error: 'Proxy error' });
    }
  });

  // Dev handler for /api/slots (mirrors the Vercel function): the
  // communityhunts.gg slot catalogue.
  app.get('/api/slots', async (_req, res) => {
    try {
      const body = await chDevGet('/slots');
      res.status(200).json({ slots: body.data || [] });
    } catch (e) {
      res.status(502).json({ error: 'UPSTREAM_UNAVAILABLE' });
    }
  });

  // /api/me/* needs Firebase admin — proxy to the deployed functions.
  app.use(
    '/api/me',
    createProxyMiddleware({
      target: DEPLOYED_API_TARGET,
      changeOrigin: true,
      secure: true,
      pathRewrite: { '^/api/me': '/api/me' },
    })
  );
};
