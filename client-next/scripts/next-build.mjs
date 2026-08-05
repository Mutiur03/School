import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const monorepoRoot = path.join(appRoot, "..");

const build = spawnSync("npx", ["next", "build", "--webpack"], {
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
 * In npm workspaces NFT often copies an incomplete `next` package (only a few
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
      if (entry.name === "node_modules" && dir !== standaloneRoot) {
        // Still check this node_modules for next
        const nestedNext = path.join(full, "next");
        if (fs.existsSync(nestedNext)) destinations.push(nestedNext);
        continue;
      }
      walk(full);
    }
  }
}

walk(standaloneRoot);

// Always ensure classic layout exists for OpenNext.
destinations.push(path.join(standaloneRoot, "node_modules", "next"));

const uniqueDests = [...new Set(destinations)];
for (const dest of uniqueDests) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(nextSrc, dest, { recursive: true, force: true });
  console.log(`[open-next patch] Copied full next → ${path.relative(appRoot, dest)}`);
}
