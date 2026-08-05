import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Ensures Next sees OPEN_NEXT=1 when OpenNext invokes `next build`. */
process.env.OPEN_NEXT = "1";
process.env.WRANGLER_BUILD_PLATFORM ??= "node";
process.env.WRANGLER_BUILD_CONDITIONS ??= "";

/**
 * OpenNext's patchVercelOgLibrary copyFileSync's to
 * `.open-next/.../node_modules/next/dist/compiled/@vercel/og/index.edge.js`
 * without mkdir — fails in monorepos when that folder wasn't NFT-traced.
 */
function patchOpenNextVercelOgMkdir() {
  const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  const monorepoRoot = path.join(appRoot, "..");
  const candidates = [
    path.join(
      monorepoRoot,
      "node_modules/@opennextjs/cloudflare/dist/cli/build/patches/ast/patch-vercel-og-library.js",
    ),
    path.join(
      appRoot,
      "node_modules/@opennextjs/cloudflare/dist/cli/build/patches/ast/patch-vercel-og-library.js",
    ),
  ];

  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    let src = fs.readFileSync(file, "utf8");
    if (src.includes("mkdirSync(path.dirname(outputEdgePath)")) {
      return;
    }

    if (!src.includes('from "node:fs"')) continue;

    src = src.replace(/import \{([^}]+)\} from "node:fs";/, (full, inner) => {
      if (inner.includes("mkdirSync")) return full;
      return `import {${inner.replace(/\s+$/, "")}, mkdirSync } from "node:fs";`;
    });

    const needle =
      "if (!existsSync(outputEdgePath)) {\n            const tracedEdgePath";
    const replacement =
      "if (!existsSync(outputEdgePath)) {\n            mkdirSync(path.dirname(outputEdgePath), { recursive: true });\n            const tracedEdgePath";

    if (!src.includes(needle)) {
      console.warn(
        "[open-next patch] Could not locate vercel/og copyFile site; skipping mkdir patch.",
      );
      return;
    }

    src = src.replace(needle, replacement);
    fs.writeFileSync(file, src);
    console.log(
      `[open-next patch] Added mkdirSync before @vercel/og copy → ${path.relative(monorepoRoot, file)}`,
    );
    return;
  }
}

patchOpenNextVercelOgMkdir();

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error("Usage: node scripts/run-with-open-next.mjs <command> [...args]");
  process.exit(1);
}

const child = spawn(cmd, args, {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
