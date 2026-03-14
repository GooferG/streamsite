const { createProxyMiddleware } = require('http-proxy-middleware');

const BONUS_HUNT_API_KEY = 'bnt_b493e9020cf2ecb1e4a8043cb1ea1941a8555a1fa2c90e62f411b6cdb0aba14c';
const SLOTS_API_KEY  = 'Vxqf1SnCumEuSoo4ucj6CYtzqUTypMjt2kCS0sQWkfHnrNFmsV';
const SLOTS_BASE_URL = 'https://slotslaunch.com/api';
const SLOTS_ORIGIN   = 'goofer.tv';

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
};
