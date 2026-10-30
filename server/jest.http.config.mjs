/** Jest config for the *.http.spec.ts suites: package.json "jest" + automatic DB/fake setup. */
import fs from 'node:fs';

const base = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url))).jest;

export default {
  ...base,
  testRegex: '.*\\.http\\.spec\\.ts$',
  // No dotenv in workers: the env comes only from globalSetup, so dev .env values can't leak in.
  setupFiles: [],
  // Real DB + bcrypt + app boot per suite: slow machines (Windows) blow past Jest's 5 s default.
  testTimeout: 60000,
  globalSetup: '<rootDir>/../scripts/test/http-global-setup.mjs',
  globalTeardown: '<rootDir>/../scripts/test/http-global-teardown.mjs',
};
