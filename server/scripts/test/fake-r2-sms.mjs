/**
 * In-process stand-in for Cloudflare R2 (S3 API) and the SMSPit capture API, for http specs.
 * Started by http-global-setup.mjs on a free port; R2_ENDPOINT points at it and SMSPIT_URL at
 * `<it>/sms`. Every call is recorded; `GET /__log` returns and clears the log so specs can
 * snapshot storage/SMS side effects.
 */
import http from 'node:http';

const send = (res, status, type, body) => {
  res.statusCode = status;
  if (type) res.setHeader('content-type', type);
  res.end(body);
};

/** Resolves to `{ url, close }` once listening on 127.0.0.1 (port 0 = any free port). */
export function startFakeR2Sms(port = 0) {
  let log = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const url = req.url ?? '/';
      const path = url.split('?')[0];
      if (path === '/__health') return send(res, 200, 'text/plain', 'ok');
      if (path === '/__log') {
        const out = log;
        log = [];
        return send(res, 200, 'application/json', JSON.stringify(out));
      }
      if (path.startsWith('/sms')) {
        log.push(`SMS ${body}`);
        return send(res, 200, 'application/json', '{"id":"m1"}');
      }
      const isBulkDelete = url.includes('?delete');
      log.push(`S3 ${req.method} ${path}${isBulkDelete ? '?delete' : ''}`);
      if (req.method === 'DELETE') return send(res, 204);
      const xml = '<?xml version="1.0" encoding="UTF-8"?>';
      if (isBulkDelete) return send(res, 200, 'application/xml', `${xml}<DeleteResult/>`);
      if (req.method === 'GET' && url.includes('list-type')) {
        return send(
          res,
          200,
          'application/xml',
          `${xml}<ListBucketResult><KeyCount>0</KeyCount><IsTruncated>false</IsTruncated></ListBucketResult>`,
        );
      }
      return send(res, 200, 'application/xml', '');
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const { port: p } = server.address();
      resolve({
        url: `http://127.0.0.1:${p}`,
        close: () =>
          new Promise((r) => {
            server.closeAllConnections();
            server.close(() => r());
          }),
      });
    });
  });
}
