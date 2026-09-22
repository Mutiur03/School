import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const MARKER = '/* open-next-school-sharp-stub */';
const ORIG_SUFFIX = '.school-orig';

/**
 * Resolve next's optional `sharp` package root (not a direct client-next dep).
 * @param {string} appRoot
 */
export function resolveSharpRoot(appRoot) {
  const req = createRequire(path.join(appRoot, 'package.json'));
  const nextReq = createRequire(req.resolve('next/package.json'));
  const sharpEntry = nextReq.resolve('sharp');
  let sharpRoot = path.dirname(sharpEntry);
  while (sharpRoot && path.basename(sharpRoot) !== 'sharp') {
    const parent = path.dirname(sharpRoot);
    if (parent === sharpRoot) break;
    sharpRoot = parent;
  }
  if (path.basename(sharpRoot) !== 'sharp') {
    throw new Error(`unexpected sharp path: ${sharpEntry}`);
  }
  return sharpRoot;
}

/**
 * After `next build` (blur placeholders need real sharp), stub sharp so
 * OpenNext's esbuild does not choke on .node binaries.
 * @param {string} appRoot
 * @param {string} monorepoRoot
 */
export function stubSharpForOpenNext(appRoot, monorepoRoot) {
  let sharpRoot;
  try {
    sharpRoot = resolveSharpRoot(appRoot);
  } catch (err) {
    console.warn(
      `[open-next patch] sharp not resolvable (${err instanceof Error ? err.message : err}); skipping stub`,
    );
    return;
  }

  const stubCjs = fs.readFileSync(path.join(appRoot, 'scripts/empty-native-stub.cjs'));
  const stubMjs = fs.readFileSync(path.join(appRoot, 'scripts/empty-native-stub.mjs'));
  const markerBuf = Buffer.from(MARKER);

  const distDir = path.join(sharpRoot, 'dist');
  let distFiles = [];
  try {
    distFiles = fs.readdirSync(distDir);
  } catch {
    console.warn('[open-next patch] sharp dist/ missing; skipping stub');
    return;
  }

  let count = 0;
  for (const name of distFiles) {
    if (!/\.(cjs|mjs|js)$/.test(name)) continue;
    const file = path.join(distDir, name);
    const original = fs.readFileSync(file);
    if (original.includes(markerBuf)) continue;
    fs.writeFileSync(`${file}${ORIG_SUFFIX}`, original);
    const body = name.endsWith('.mjs') ? stubMjs : stubCjs;
    fs.writeFileSync(file, Buffer.concat([markerBuf, Buffer.from('\n'), body]));
    count += 1;
  }

  console.log(
    `[open-next patch] Stubbed ${count} sharp files (post-next-build) → ${path.relative(monorepoRoot, sharpRoot)}`,
  );
}

/** Restore sharp files stubbed by {@link stubSharpForOpenNext}. */
export function restoreSharpAfterOpenNext(appRoot) {
  let sharpRoot;
  try {
    sharpRoot = resolveSharpRoot(appRoot);
  } catch {
    return;
  }
  const distDir = path.join(sharpRoot, 'dist');
  let distFiles = [];
  try {
    distFiles = fs.readdirSync(distDir);
  } catch {
    return;
  }
  let count = 0;
  for (const name of distFiles) {
    if (!name.endsWith(ORIG_SUFFIX)) continue;
    const bak = path.join(distDir, name);
    const file = bak.slice(0, -ORIG_SUFFIX.length);
    try {
      fs.writeFileSync(file, fs.readFileSync(bak));
      fs.rmSync(bak, { force: true });
      count += 1;
    } catch {
      /* install tree may already be gone */
    }
  }
  if (count > 0) {
    console.log(`[open-next patch] Restored ${count} sharp files`);
  }
}
