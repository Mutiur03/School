import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Ensures Next sees OPEN_NEXT=1 when OpenNext invokes `next build`. */
process.env.OPEN_NEXT = '1';
process.env.WRANGLER_BUILD_PLATFORM ??= 'node';
process.env.WRANGLER_BUILD_CONDITIONS ??= '';

const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const monorepoRoot = path.join(appRoot, '..');
// OpenNext setStandaloneBuildMode sets these too; set early so nested standalone is consistent.
process.env.NEXT_PRIVATE_STANDALONE = 'true';
process.env.NEXT_PRIVATE_OUTPUT_TRACE_ROOT = monorepoRoot;

/**
 * OpenNext's patchVercelOgLibrary (monorepo / incomplete NFT):
 * 1) copyFileSync to `@vercel/og/index.edge.js` without mkdir
 * 2) renameSync Geist-Regular.ttf → .bin without copying the font first
 */
function patchOpenNextVercelOgLibrary() {
  const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const monorepoRoot = path.join(appRoot, '..');
  const candidates = [
    path.join(
      monorepoRoot,
      'node_modules/@opennextjs/cloudflare/dist/cli/build/patches/ast/patch-vercel-og-library.js',
    ),
    path.join(
      appRoot,
      'node_modules/@opennextjs/cloudflare/dist/cli/build/patches/ast/patch-vercel-og-library.js',
    ),
  ];

  const marker = '/* open-next-school-og-patch */';

  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    let src = fs.readFileSync(file, 'utf8');
    if (src.includes(marker)) {
      return;
    }

    if (!src.includes('from "node:fs"')) continue;

    src = src.replace(/import \{([^}]+)\} from "node:fs";/, (full, inner) => {
      let next = inner;
      if (!next.includes('mkdirSync')) next = `${next.replace(/\s+$/, '')}, mkdirSync `;
      if (!next.includes('readdirSync')) next = `${next.replace(/\s+$/, '')}, readdirSync `;
      return `import {${next}} from "node:fs";`;
    });

    const mkdirNeedle = 'if (!existsSync(outputEdgePath)) {\n            const tracedEdgePath';
    const mkdirReplacement =
      'if (!existsSync(outputEdgePath)) {\n            mkdirSync(path.dirname(outputEdgePath), { recursive: true });\n            const tracedEdgePath';
    if (src.includes(mkdirNeedle) && !src.includes('mkdirSync(path.dirname(outputEdgePath)')) {
      src = src.replace(mkdirNeedle, mkdirReplacement);
    }

    // After yoga.wasm copy, also copy sibling assets (fonts, resvg.wasm, …).
    const yogaNeedle =
      'if (existsSync(tracedWasmPath)) {\n                copyFileSync(tracedWasmPath, path.join(outputDir, "yoga.wasm"));\n            }';
    const yogaReplacement = `${yogaNeedle}
            const tracedOgDir = path.dirname(tracedEdgePath);
            if (existsSync(tracedOgDir)) {
                for (const name of readdirSync(tracedOgDir)) {
                    if (name === "satori" || name === "index.edge.js" || name === "yoga.wasm") continue;
                    const from = path.join(tracedOgDir, name);
                    const to = path.join(outputDir, name);
                    if (existsSync(from) && !existsSync(to)) {
                        try { copyFileSync(from, to); } catch { /* skip dirs */ }
                    }
                }
            }`;
    if (src.includes(yogaNeedle) && !src.includes('tracedOgDir')) {
      src = src.replace(yogaNeedle, yogaReplacement);
    }

    const renameNeedle =
      'renameSync(path.join(outputDir, fontFileName), path.join(outputDir, `${fontFileName}.bin`));';
    const renameReplacement = `const fontSrc = path.join(outputDir, fontFileName);
                const fontDest = path.join(outputDir, \`\${fontFileName}.bin\`);
                if (!existsSync(fontSrc)) {
                    const tracedFontPath = path.join(path.dirname(traceInfoPath), tracedNodePath.replace("index.node.js", fontFileName));
                    if (existsSync(tracedFontPath)) {
                        mkdirSync(path.dirname(fontSrc), { recursive: true });
                        copyFileSync(tracedFontPath, fontSrc);
                    }
                }
                if (existsSync(fontSrc) && !existsSync(fontDest)) {
                    renameSync(fontSrc, fontDest);
                }`;
    if (src.includes(renameNeedle)) {
      src = src.replace(renameNeedle, renameReplacement);
    } else if (!src.includes('fontDest')) {
      console.warn(
        '[open-next patch] Could not locate vercel/og renameSync site; font patch skipped.',
      );
    }

    src = `${marker}\n${src}`;
    fs.writeFileSync(file, src);
    console.log(
      `[open-next patch] Patched @vercel/og mkdir+font copy → ${path.relative(monorepoRoot, file)}`,
    );
    return;
  }
}

patchOpenNextVercelOgLibrary();

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error('Usage: node scripts/run-with-open-next.mjs <command> [...args]');
  process.exit(1);
}

const child = spawn(cmd, args, {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
