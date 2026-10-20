/**
 * Publish an OTA update to the self-hosted server (workers/expo-updates). Replaces `eas update`.
 *
 *   APP_ENV=staging EXPO_PUBLIC_...=... node scripts/publish-update.mjs [--dry-run]
 *   APP_ENV=staging node scripts/publish-update.mjs --rollback <updateId>
 *
 * Use exactly the APP_ENV / EXPO_PUBLIC_* values of the matching build: they pick the channel and
 * the runtime version and are inlined into the bundle. Uploads go through wrangler, so they need
 * CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID (CI) or `wrangler login` (local).
 *
 * Everything lives under the channel's folder (R2 layout: workers/expo-updates/src/index.js).
 * Every update is kept, and each publish / rollback writes a log entry to <channel>/logs/.
 *
 * Rollback republishes an older update's files as a NEW update (new id, current time): clients
 * ignore a manifest older than the update they already run, so re-serving the old one does nothing.
 */
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { userInfo } from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';

const BUCKET = 'school-expo-updates';
const PLATFORM = 'android';
const CONTENT_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ttf: 'font/ttf',
  otf: 'font/otf',
  json: 'application/json',
};

const appDir = path.resolve(import.meta.dirname, '..');
const outDir = path.join(appDir, 'dist/ota');
const expoCli = path.join(appDir, 'node_modules/expo/bin/cli');
const updatesCli = path.join(appDir, 'node_modules/expo-updates/bin/cli.js');
const wrangler = path.resolve(
  appDir,
  '../../workers/expo-updates/node_modules/wrangler/bin/wrangler.js',
);

const { values } = parseArgs({
  options: {
    'dry-run': { type: 'boolean', default: false },
    rollback: { type: 'string' },
  },
});

/** Run a node CLI from the app dir; returns stdout when `capture`, otherwise streams it. */
function run(bin, args, capture = false) {
  const result = spawnSync(process.execPath, [bin, ...args], {
    cwd: appDir,
    encoding: 'utf8',
    stdio: ['ignore', capture ? 'pipe' : 'inherit', 'inherit'],
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(`${path.basename(bin)} ${args[0]} failed`);
  return result.stdout;
}

const put = (key, file, contentType) =>
  run(wrangler, [
    'r2',
    'object',
    'put',
    `${BUCKET}/${key}`,
    '--file',
    file,
    '--content-type',
    contentType,
    '--remote',
  ]);

const getJson = (key) =>
  JSON.parse(
    run(wrangler, ['r2', 'object', 'get', `${BUCKET}/${key}`, '--pipe', '--remote'], true),
  );

const git = (...args) =>
  spawnSync('git', args, { cwd: appDir, encoding: 'utf8' }).stdout?.trim() || null;

const exp = JSON.parse(run(expoCli, ['config', '--json', '--type', 'public'], true));
const channel = exp.updates?.requestHeaders?.['expo-channel-name'];
const updatesUrl = exp.updates?.url;
if (!channel || !updatesUrl) throw new Error('app config has no updates.url / expo-channel-name');

/** Upload a manifest as a kept update, point the channel at it, then log the event. */
function release(manifest, event, details) {
  const manifestFile = path.join(outDir, 'manifest.json');
  writeFileSync(manifestFile, JSON.stringify(manifest));

  const logEntry = {
    event,
    updateId: manifest.id,
    channel,
    platform: PLATFORM,
    runtimeVersion: manifest.runtimeVersion,
    at: manifest.createdAt,
    by: process.env.GITHUB_ACTOR ?? userInfo().username,
    source: process.env.GITHUB_ACTIONS
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : 'local',
    commit: process.env.GITHUB_SHA ?? git('rev-parse', 'HEAD'),
    commitMessage: git('log', '-1', '--pretty=%s'),
    ...details,
  };
  const logFile = path.join(outDir, 'log.json');
  writeFileSync(logFile, JSON.stringify(logEntry, null, 2));

  put(`${channel}/updates/${manifest.id}/manifest.json`, manifestFile, 'application/json');
  put(
    `${channel}/latest/${manifest.runtimeVersion}/${PLATFORM}.json`,
    manifestFile,
    'application/json',
  );
  const stamp = manifest.createdAt.replace(/[:.]/g, '-');
  put(`${channel}/logs/${stamp}-${event}-${manifest.id}.json`, logFile, 'application/json');
  console.log(
    `${event}: update ${manifest.id} is live on ${channel} (${manifest.runtimeVersion}).`,
  );
}

if (values.rollback) {
  const old = getJson(`${channel}/updates/${values.rollback}/manifest.json`);
  // Same files (URLs still point at the old update's folder), new identity so clients take it.
  release({ ...old, id: randomUUID(), createdAt: new Date().toISOString() }, 'rollback', {
    rolledBackTo: old.id,
    originalCreatedAt: old.createdAt,
  });
  process.exit(0);
}

const { runtimeVersion } = JSON.parse(
  run(updatesCli, ['runtimeversion:resolve', '--platform', PLATFORM], true),
);
console.log(`Publishing ${PLATFORM} update: channel=${channel} runtime=${runtimeVersion}`);

run(expoCli, ['export', '--platform', PLATFORM, '--output-dir', outDir]);
const { bundle, assets } = JSON.parse(readFileSync(path.join(outDir, 'metadata.json'), 'utf8'))
  .fileMetadata[PLATFORM];

const updateId = randomUUID();
const filesUrl = `${new URL(updatesUrl).origin}/${channel}/updates/${updateId}/files`;
/** @type {{ file: string; contentType: string; hash: string }[]} */
const uploads = [];

function describe(relPath, contentType, key) {
  const file = path.join(outDir, relPath);
  const data = readFileSync(file);
  const hash = createHash('sha256').update(data).digest('base64url');
  uploads.push({ file, contentType, hash });
  return {
    hash,
    key: key ?? createHash('md5').update(data).digest('hex'),
    contentType,
    url: `${filesUrl}/${hash}`,
  };
}

const manifest = {
  id: updateId,
  createdAt: new Date().toISOString(),
  runtimeVersion,
  launchAsset: describe(bundle, 'application/javascript'),
  // The bundle looks assets up by their md5, which is the exported file name.
  assets: assets.map(({ path: relPath, ext }) => ({
    ...describe(
      relPath,
      CONTENT_TYPES[ext] ?? 'application/octet-stream',
      relPath.split(/[\\/]/).pop(),
    ),
    fileExtension: `.${ext}`,
  })),
  metadata: {},
  extra: { expoClient: exp },
};

if (values['dry-run']) {
  writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest));
  console.log(
    `Dry run: wrote ${outDir}/manifest.json (${uploads.length} files), nothing uploaded.`,
  );
  process.exit(0);
}

// Files first, manifest and pointer after: a client never sees a manifest whose files are missing.
for (const { file, contentType, hash } of uploads) {
  put(`${channel}/updates/${updateId}/files/${hash}`, file, contentType);
}
release(manifest, 'publish', { files: uploads.length, bundleHash: manifest.launchAsset.hash });
