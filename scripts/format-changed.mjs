// Format only files changed vs HEAD (staged, unstaged, untracked). `pnpm format:all` formats everything.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8' }).split('\n').filter(Boolean);

const files = [
  ...new Set([
    ...git('diff', '--name-only', '--diff-filter=d', 'HEAD'),
    ...git('ls-files', '--others', '--exclude-standard'),
  ]),
];

if (files.length === 0) {
  console.log('No changed files to format.');
  process.exit(0);
}

// --ignore-unknown skips file types prettier can't parse; .prettierignore is still honored.
execFileSync(
  process.execPath,
  [
    fileURLToPath(import.meta.resolve('prettier/bin/prettier.cjs')),
    '--write',
    '--ignore-unknown',
    ...files,
  ],
  { stdio: 'inherit' },
);
