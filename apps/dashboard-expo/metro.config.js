// Expo's default config (monorepo-aware: watches the workspace root and packages/*) plus
// NativeWind, which compiles global.css + tailwind.config.js for web and native.
// inlineRem: 16 makes 1rem = 16px on native like the browser (NativeWind defaults to 14), so
// `p-4`, `text-sm`, etc. have the same pixel sizes as in the web dashboard.
const http = require('node:http');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Web dev: proxy same-origin /api to the local auth-bff, like dashboard/vite.config.ts. The page
// host (e.g. lbp.localhost:8081) goes along as x-forwarded-host so the BFF resolves the school.
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => (req, res, next) => {
    if (!req.url.startsWith('/api/') && req.url !== '/api') return middleware(req, res, next);
    const upstream = http.request(
      {
        host: '127.0.0.1',
        port: 8787,
        method: req.method,
        path: req.url,
        headers: { ...req.headers, host: '127.0.0.1:8787', 'x-forwarded-host': req.headers.host },
      },
      (upstreamRes) => {
        res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
        upstreamRes.pipe(res);
      },
    );
    upstream.on('error', () => {
      res.writeHead(502, { 'content-type': 'text/plain' });
      res.end('auth-bff not reachable on 127.0.0.1:8787 (pnpm dev:auth-bff)');
    });
    req.pipe(upstream);
  },
};

module.exports = withNativeWind(config, {
  input: './global.css',
  inlineRem: 16,
});
