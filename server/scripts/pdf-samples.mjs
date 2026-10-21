// Generates one sample PDF of every kind the system makes, into server/pdf-samples-out (or argv[2]).
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const out = path.resolve(process.argv[2] ?? 'pdf-samples-out');
const r = spawnSync(
  process.execPath,
  [
    '--experimental-vm-modules',
    'node_modules/jest/bin/jest.js',
    '--testPathPatterns',
    'pdf-samples',
  ],
  { stdio: 'inherit', env: { ...process.env, PDF_SAMPLES_DIR: out } },
);
console.log(`PDFs written to ${out}`);
process.exit(r.status ?? 1);
