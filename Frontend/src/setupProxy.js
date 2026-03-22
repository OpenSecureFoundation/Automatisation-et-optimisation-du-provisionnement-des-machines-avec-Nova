const { createProxyMiddleware } = require('http-proxy-middleware');

/**
 * Proxy /api vers le backend (port 3001) en dev.
 * Évite d'utiliser "proxy" dans package.json qui provoque
 * l'erreur allowedHosts[0] avec react-scripts 5.
 */
module.exports = function (app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:3001',
      changeOrigin: true,
    })
  );
};
