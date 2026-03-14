const { createProxyMiddleware } = require('http-proxy-middleware');

const API_KEY = 'bnt_b493e9020cf2ecb1e4a8043cb1ea1941a8555a1fa2c90e62f411b6cdb0aba14c';

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
          proxyReq.setHeader('Authorization', `Bearer ${API_KEY}`);
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
        headers: { Authorization: `Bearer ${API_KEY}` },
      });
      const data = await upstream.json();
      res.status(upstream.status).json(data);
    } catch (e) {
      res.status(500).json({ error: 'Proxy error' });
    }
  });
};
