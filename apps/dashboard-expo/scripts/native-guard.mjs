/**
 * Production guard: an OTA only reaches binaries whose native fingerprint (runtime version) matches.
 *
 *   node scripts/native-guard.mjs record   # after a store build: remember its runtime version
 *   node scripts/native-guard.mjs check    # before an OTA: fail if no recorded build has it
 *
 * Needs the build's APP_ENV / EXPO_PUBLIC_* (they feed the fingerprint) and CLOUDFLARE_API_TOKEN +
 * CLOUDFLARE_ACCOUNT_ID. Records live in the update bucket under production/builds/<runtime>.json.
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const BUCKET = 'school-expo-updates';
const mode = process.argv[2];
if (mode !== 'record' && mode !== 'check') throw new Error('usage: native-guard.mjs record|check');

const appDir = path.resolve(import.meta.dirname, '..');
const wrangler = path.resolve(
  appDir,
  '../../workers/expo-updates/node_modules/wrangler/bin/wrangler.js',
);
const node = (bin, args) =>
  spawnSync(process.execPath, [path.join(appDir, bin), ...args], {
    cwd: appDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });

const resolved = node('node_modules/expo-updates/bin/cli.js', [
  'runtimeversion:resolve',
  '--platform',
  'android',
]);
if (resolved.status !== 0) throw new Error('runtimeversion:resolve failed');
const { runtimeVersion } = JSON.parse(resolved.stdout);
const key = `${BUCKET}/production/builds/${runtimeVersion}.json`;

if (mode === 'record') {
  const file = path.join(tmpdir(), 'native-build.json');
  writeFileSync(
    file,
    JSON.stringify({
      runtimeVersion,
      commit: process.env.GITHUB_SHA ?? null,
      run: process.env.GITHUB_RUN_ID ?? null,
      at: new Date().toISOString(),
    }),
  );
  const put = spawnSync(
    process.execPath,
    [wrangler, 'r2', 'object', 'put', key, '--file', file, '--content-type', 'application/json', '--remote'],
    { cwd: appDir, stdio: 'inherit' },
  );
  if (put.status !== 0) throw new Error('could not record build');
  console.log(`Recorded production build for runtime ${runtimeVersion}.`);
} else {
  const get = spawnSync(process.execPath, [wrangler, 'r2', 'object', 'get', key, '--pipe', '--remote'], {
    cwd: appDir,
    stdio: ['ignore', 'ignore', 'ignore'],
  });
  if (get.status !== 0) {
    console.error(
      `::error::No production build recorded for runtime ${runtimeVersion}. Native code changed ` +
        'since the last store build (or none was recorded): run this workflow with action=build.',
    );
    process.exit(1);
  }
  console.log(`Runtime ${runtimeVersion} matches a recorded production build.`);
}
