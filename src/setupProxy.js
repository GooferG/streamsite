const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  app.use(
    '/api/public',
    createProxyMiddleware({
      target: 'https://bonushunt.gg',
      changeOrigin: true,
      secure: true,
      xfwd: false,
    })
  );
};
