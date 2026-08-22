import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const eslintCli = path.join(root, 'node_modules/eslint/bin/eslint.js');
const preload = path.join(root, 'scripts/eslint-ts6-preload.cjs');
const args = process.argv.slice(2);
const fix = args.includes('--fix');
const lintPaths = args.filter((arg) => !arg.startsWith('-'));
const targets = lintPaths.length > 0 ? lintPaths : ['.'];

const eslintArgs = [
  '--require',
  preload,
  eslintCli,
  '--cache',
  '--cache-location',
  path.join(root, '.eslintcache'),
  ...targets,
];
if (fix) {
  eslintArgs.push('--fix');
}

const result = spawnSync(process.execPath, eslintArgs, {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status ?? 1);
