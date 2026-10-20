/**
 * Self-hosted expo-updates server (protocol v1), replacing EAS Update.
 *
 * R2 layout, one top-level folder per environment / channel (development | staging | production),
 * written by apps/dashboard-expo/scripts/publish-update.mjs:
 *   <channel>/latest/<runtimeVersion>/<platform>.json        manifest the apps get now
 *   <channel>/updates/<updateId>/manifest.json               every update ever published (kept)
 *   <channel>/updates/<updateId>/files/<sha256-base64url>    that update's bundle + assets
 *   <channel>/logs/<timestamp>-<event>-<updateId>.json       publish / rollback log
 *
 * GET /manifest                               latest manifest for the request's channel/runtime
 * GET /<channel>/updates/<updateId>/files/<h> immutable file (only this path shape is served)
 *
 * Each manifest request is logged to Workers Logs (wrangler.toml [observability]), not R2:
 * a write per app launch would cost more than the whole server.
 */

// Header and path values become R2 keys: allow only safe characters (no "/" or "..").
const SAFE = /^[A-Za-z0-9._-]{1,128}$/;
const PLATFORMS = new Set(['android', 'ios']);
const FILE_PATH = /^\/([^/]+)\/updates\/([^/]+)\/files\/([^/]+)$/;

const text = (status, body) =>
  new Response(body, { status, headers: { 'content-type': 'text/plain' } });

export default {
  /** @param {Request} request @param {{ UPDATES: R2Bucket }} env */
  async fetch(request, env) {
    if (request.method !== 'GET') return text(405, 'Method not allowed');
    const { pathname } = new URL(request.url);

    if (pathname === '/manifest') {
      const platform = request.headers.get('expo-platform') ?? '';
      const runtime = request.headers.get('expo-runtime-version') ?? '';
      const channel = request.headers.get('expo-channel-name') ?? '';
      const log = (status) =>
        console.log(
          JSON.stringify({
            event: 'manifest-request',
            status,
            channel,
            runtime,
            platform,
            currentUpdateId: request.headers.get('expo-current-update-id'),
            embeddedUpdateId: request.headers.get('expo-embedded-update-id'),
          }),
        );

      if (request.headers.get('expo-protocol-version') !== '1') {
        log(400);
        return text(400, 'Unsupported expo-protocol-version');
      }
      if (!PLATFORMS.has(platform) || !SAFE.test(runtime) || !SAFE.test(channel)) {
        log(400);
        return text(
          400,
          'Missing or invalid expo-platform / expo-runtime-version / expo-channel-name',
        );
      }

      // Nothing published for this build yet: the app keeps running its embedded bundle.
      const manifest = await env.UPDATES.get(`${channel}/latest/${runtime}/${platform}.json`);
      log(manifest ? 200 : 404);
      if (!manifest) return text(404, 'No update for this channel and runtime');

      return new Response(manifest.body, {
        headers: {
          'content-type': 'application/json',
          'expo-protocol-version': '1',
          'expo-sfv-version': '0',
          'cache-control': 'private, max-age=0',
        },
      });
    }

    const match = FILE_PATH.exec(pathname);
    if (match && match.slice(1).every((part) => SAFE.test(part))) {
      const [, channel, updateId, hash] = match;
      const file = await env.UPDATES.get(`${channel}/updates/${updateId}/files/${hash}`);
      if (!file) return text(404, 'Not found');
      return new Response(file.body, {
        headers: {
          'content-type': file.httpMetadata?.contentType ?? 'application/octet-stream',
          'cache-control': 'public, max-age=31536000, immutable',
        },
      });
    }

    return text(404, 'Not found');
  },
};
