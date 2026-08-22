import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scope = process.argv[2];
const prettierBin = path.join(root, 'node_modules/prettier/bin/prettier.cjs');
const tscBin = path.join(root, 'node_modules/typescript/bin/tsc');
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

/** @type {Record<string, { paths: string[] }>} */
const SCOPES = {
  server: {
    paths: ['server', 'packages/shared-schemas'],
  },
  'client-next': {
    paths: ['client-next', 'packages/common-ui', 'packages/shared-schemas'],
  },
  dashboard: {
    paths: ['dashboard', 'packages/common-ui', 'packages/shared-schemas'],
  },
  'auth-bff': {
    paths: ['workers/auth-bff'],
  },
  'tenant-router': {
    paths: ['workers/tenant-router'],
  },
};

/** @type {Record<string, { cwd: string; project: string }[]>} */
const TYPECHECK_PROJECTS = {
  server: [
    { cwd: 'server', project: 'tsconfig.json' },
    { cwd: 'packages/shared-schemas', project: 'tsconfig.json' },
  ],
  'client-next': [
    { cwd: 'client-next', project: 'tsconfig.json' },
    { cwd: 'packages/common-ui', project: 'tsconfig.json' },
    { cwd: 'packages/shared-schemas', project: 'tsconfig.json' },
  ],
  dashboard: [
    { cwd: 'dashboard', project: 'tsconfig.json' },
    { cwd: 'packages/common-ui', project: 'tsconfig.json' },
    { cwd: 'packages/shared-schemas', project: 'tsconfig.json' },
  ],
  'auth-bff': [{ cwd: 'workers/auth-bff', project: 'tsconfig.json' }],
  'tenant-router': [],
};

function run(label, command, args, options = {}) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    ...options,
  });

  if (result.status !== 0) {
    console.error(`\n${label} failed (exit ${result.status ?? 1})`);
    process.exit(result.status ?? 1);
  }
}

const config = SCOPES[scope];
if (!config) {
  console.error(`Unknown scope: ${scope}`);
  console.error(`Valid scopes: ${Object.keys(SCOPES).join(', ')}`);
  process.exit(1);
}

const eslintScript = path.join(root, 'scripts/run-eslint.mjs');
run('Lint', process.execPath, [eslintScript, ...config.paths]);
run('Format check', process.execPath, [prettierBin, '--check', ...config.paths]);

if (scope === 'server') {
  run('Prisma generate (server)', pnpmCommand, [
    '--filter',
    'server',
    'exec',
    'prisma',
    'generate',
  ]);
}

/** Packages whose consumers resolve types from dist/ — build before typecheck. */
const BUILD_BEFORE_TYPECHECK = {
  server: ['@school/shared-schemas'],
  'client-next': ['@school/shared-schemas', '@school/common-ui'],
  dashboard: ['@school/shared-schemas', '@school/common-ui'],
};

for (const pkg of BUILD_BEFORE_TYPECHECK[scope] ?? []) {
  run(`Build (${pkg})`, pnpmCommand, ['--filter', pkg, 'build']);
}

/** Next apps gitignore next-env.d.ts; generate it before tsc so image/module types exist on CI. */
if (scope === 'client-next') {
  run('Next typegen (client-next)', pnpmCommand, [
    '--filter',
    'client-next',
    'exec',
    'next',
    'typegen',
  ]);
}

for (const { cwd, project } of TYPECHECK_PROJECTS[scope] ?? []) {
  run(`Typecheck (${cwd})`, process.execPath, [tscBin, '--noEmit', '-p', project], {
    cwd: path.join(root, cwd),
  });
}

console.log(`\nAll checks passed for scope: ${scope}`);
