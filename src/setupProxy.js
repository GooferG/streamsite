const { createProxyMiddleware } = require('http-proxy-middleware');

// Dev-only secrets — read from env (.env.local), no longer committed. Set
// BONUSHUNT_API_KEY / SLOTSLAUNCH_API_KEY in .env.local for local API mirrors.
const BONUS_HUNT_API_KEY = process.env.BONUSHUNT_API_KEY || '';
const SLOTS_API_KEY  = process.env.SLOTSLAUNCH_API_KEY || '';
const SLOTS_BASE_URL = 'https://slotslaunch.com/api';
const SLOTS_ORIGIN   = 'goofer.tv';

// Hunt-suggest endpoints need Firebase admin, which can't run in the CRA dev
// server. Mirror them by proxying to the deployed functions so the local UI
// can be exercised end-to-end. Override with HUNT_SUGGEST_PROXY_TARGET.
const HUNT_SUGGEST_TARGET =
  process.env.HUNT_SUGGEST_PROXY_TARGET || 'https://goofer.tv';

if (!BONUS_HUNT_API_KEY || !SLOTS_API_KEY) {
  // eslint-disable-next-line no-console
  console.warn(
    '[setupProxy] BONUSHUNT_API_KEY / SLOTSLAUNCH_API_KEY not set in .env.local — ' +
      '/api/bonus-hunts and /api/slots dev mirrors will fail until they are.'
  );
}

module.exports = function (app) {
  // Dev proxy for direct /api/public calls
  app.use(
    '/api/public',
    createProxyMiddleware({
      target: 'https://bonushunt.gg',
      changeOrigin: true,
      secure: true,
      xfwd: false,
      on: {
        proxyReq: (proxyReq) => {
          proxyReq.setHeader('Authorization', `Bearer ${BONUS_HUNT_API_KEY}`);
        },
      },
    })
  );

  // Dev handler for /api/bonus-hunts (mirrors the Vercel function)
  app.get('/api/bonus-hunts', async (req, res) => {
    const { path } = req.query;
    if (!path) return res.status(400).json({ error: 'Missing path param' });
    try {
      const upstream = await fetch(`https://bonushunt.gg/api/public/${path}`, {
        headers: { Authorization: `Bearer ${BONUS_HUNT_API_KEY}` },
      });
      const data = await upstream.json();
      res.status(upstream.status).json(data);
    } catch (e) {
      res.status(500).json({ error: 'Proxy error' });
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

  // Dev handler for /api/slots (mirrors the Vercel function)
  app.get('/api/slots', async (req, res) => {
    const { path, ...rest } = req.query;
    const allowed = ['games', 'providers', 'types', 'themes'];
    if (!path || !allowed.includes(path)) {
      return res.status(400).json({ error: 'Invalid path' });
    }
    try {
      const upstreamParams = new URLSearchParams({ token: SLOTS_API_KEY, ...rest }).toString();
      const upstreamUrl = `${SLOTS_BASE_URL}/${path}?${upstreamParams}`;
      const upstream = await fetch(upstreamUrl, {
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Origin': SLOTS_ORIGIN },
      });
      const data = await upstream.json();
      res.status(upstream.status).json(data);
    } catch (e) {
      res.status(500).json({ error: 'Proxy error' });
    }
  });

  // Hunt-suggest endpoints (info/manage/submit) run on Firebase admin and can't
  // execute in the CRA dev server — proxy them to the deployed functions so the
  // suggestion-intake UI works under `npm start`.
  app.use(
    '/api/hunt-suggest',
    createProxyMiddleware({
      target: HUNT_SUGGEST_TARGET,
      changeOrigin: true,
      secure: true,
      pathRewrite: { '^/api/hunt-suggest': '/api/hunt-suggest' },
    })
  );
};
