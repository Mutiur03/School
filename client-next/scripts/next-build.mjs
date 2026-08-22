import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const monorepoRoot = path.join(appRoot, "..");

// Compiler selection, per deploy target:
//  - Vercel: Turbopack, now that `output: "standalone"` is no longer forced
//    for this target (see next.config.ts) — that was what made Vercel's
//    onBuildComplete step depend on `.next/next-server.js.nft.json`, which
//    Turbopack doesn't emit in that shape (confirmed broken in production,
//    2026-08-15). Without standalone mode, Vercel's native tracing doesn't
//    hit that path, so Turbopack is safe here. ~31% faster than Webpack
//    (1m10s vs 1m41s measured locally).
//  - OpenNext/Cloudflare: stays on Webpack — Turbopack's flat tracing root
//    breaks OpenNext's esbuild bundling (`zod`/workspace-package ESM
//    interop fails with "EcmascriptModuleLocalsModule must only be used on
//    modules with EsmExports").
// Override either way with `NEXT_BUILD_COMPILER=webpack|turbopack`.
const isOpenNext = process.env.OPEN_NEXT === "1";
const compiler = process.env.NEXT_BUILD_COMPILER ?? (isOpenNext ? "webpack" : "turbopack");
console.log(
  `[next-build] compiler: ${compiler} (${isOpenNext ? "open-next/cloudflare" : "vercel"})`,
);

const build = spawnSync("npx", ["next", "build", `--${compiler}`], {
  cwd: appRoot,
  stdio: "inherit",
  shell: true,
  env: process.env,
});

if (build.status) {
  process.exit(build.status ?? 1);
}

/**
 * OpenNext esbuild-bundles next-server.js from the traced standalone copy.
 * In pnpm workspaces NFT often copies an incomplete `next` package (only a few
 * files), which then fails with "Could not resolve ./node-environment".
 * Copy the full hoisted `next` into every standalone node_modules/next slot.
 */
if (process.env.OPEN_NEXT !== "1") {
  process.exit(0);
}

const nextSrcCandidates = [
  path.join(appRoot, "node_modules", "next"),
  path.join(monorepoRoot, "node_modules", "next"),
];
const nextSrc = nextSrcCandidates.find((p) =>
  fs.existsSync(path.join(p, "dist", "server", "next-server.js")),
);

if (!nextSrc) {
  console.error("[open-next patch] Could not find a full next install to copy.");
  process.exit(1);
}

const standaloneRoot = path.join(appRoot, ".next", "standalone");
if (!fs.existsSync(standaloneRoot)) {
  console.error("[open-next patch] Missing .next/standalone — is output:'standalone' set?");
  process.exit(1);
}

// OpenNext resolves `.next/standalone/<appDir>/.next/server/pages-manifest.json` in monorepos.
const packageDir = path.basename(appRoot);
const nestedAppRoot = path.join(standaloneRoot, packageDir);
const nestedManifest = path.join(nestedAppRoot, ".next/server/pages-manifest.json");
const flatManifest = path.join(standaloneRoot, ".next/server/pages-manifest.json");

if (!fs.existsSync(nestedManifest) && fs.existsSync(flatManifest)) {
  fs.mkdirSync(nestedAppRoot, { recursive: true });
  for (const name of fs.readdirSync(standaloneRoot)) {
    if (name === packageDir) continue;
    fs.renameSync(path.join(standaloneRoot, name), path.join(nestedAppRoot, name));
  }
  console.log(
    `[open-next patch] Restructured standalone layout → standalone/${packageDir}/`,
  );
}

const standaloneAppRoot = fs.existsSync(nestedManifest)
  ? nestedAppRoot
  : fs.existsSync(flatManifest)
    ? standaloneRoot
    : nestedAppRoot;

/** @type {string[]} */
const destinations = [];

function walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "next" && path.basename(dir) === "node_modules") {
        destinations.push(full);
        continue;
      }
      // Don't descend into nested node_modules except the top-level ones we care about.
      if (entry.name === "node_modules" && dir !== standaloneAppRoot) {
        // Still check this node_modules for next
        const nestedNext = path.join(full, "next");
        if (fs.existsSync(nestedNext)) destinations.push(nestedNext);
        continue;
      }
      walk(full);
    }
  }
}

walk(standaloneAppRoot);

// Always ensure classic layout exists for OpenNext.
destinations.push(path.join(standaloneAppRoot, "node_modules", "next"));

const uniqueDests = [...new Set(destinations)];
for (const dest of uniqueDests) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(nextSrc, dest, { recursive: true, force: true });
  console.log(`[open-next patch] Copied full next → ${path.relative(appRoot, dest)}`);
}

/**
 * next/dist/client/lib/console.js requires `@swc/helpers/_/_interop_require_default`.
 * Ensure helpers sit next to the standalone next install (monorepo NFT often omits them).
 */
const helpersSrcCandidates = [
  path.join(nextSrc, "node_modules", "@swc", "helpers"),
  path.join(appRoot, "node_modules", "@swc", "helpers"),
  path.join(monorepoRoot, "node_modules", "@swc", "helpers"),
];
const helpersSrc = helpersSrcCandidates.find((p) =>
  fs.existsSync(path.join(p, "_", "_interop_require_default")),
);

if (helpersSrc) {
  const helpersDests = new Set(
    uniqueDests.map((nextDest) =>
      path.join(path.dirname(nextDest), "@swc", "helpers"),
    ),
  );
  helpersDests.add(path.join(standaloneAppRoot, "node_modules", "@swc", "helpers"));
  for (const dest of helpersDests) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.cpSync(helpersSrc, dest, { recursive: true, force: true });
    console.log(
      `[open-next patch] Copied @swc/helpers → ${path.relative(appRoot, dest)}`,
    );
  }
} else {
  console.warn(
    "[open-next patch] @swc/helpers not found — OpenNext bundle may miss interop helpers.",
  );
}

/**
 * OpenNext esbuild resolves styled-jsx via require('./dist/index'). Monorepo NFT
 * often leaves only the package root stub without dist/.
 */
const styledJsxSrcCandidates = [
  path.join(nextSrc, "node_modules", "styled-jsx"),
  path.join(appRoot, "node_modules", "styled-jsx"),
  path.join(monorepoRoot, "node_modules", "styled-jsx"),
];
const styledJsxSrc = styledJsxSrcCandidates.find((p) =>
  fs.existsSync(path.join(p, "dist", "index", "index.js")),
);

if (styledJsxSrc) {
  const styledJsxDests = new Set(
    uniqueDests.map((nextDest) =>
      path.join(path.dirname(nextDest), "styled-jsx"),
    ),
  );
  styledJsxDests.add(path.join(standaloneAppRoot, "node_modules", "styled-jsx"));
  for (const dest of styledJsxDests) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.cpSync(styledJsxSrc, dest, { recursive: true, force: true });
    console.log(
      `[open-next patch] Copied styled-jsx → ${path.relative(appRoot, dest)}`,
    );
  }
} else {
  console.warn(
    "[open-next patch] styled-jsx not found — OpenNext bundle may fail resolving ./dist/index.",
  );
}
