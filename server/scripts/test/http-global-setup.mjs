/**
 * Jest globalSetup for the *.http.spec.ts suites (jest.http.config.mjs). No manual steps:
 *  - takes the Postgres server + admin login from DIRECT_URL / DATABASE_URL (process env, else .env)
 *    and uses a SEPARATE database `<name>_test` on it (created if missing; the dev DB is never touched)
 *  - creates the restricted role `school_test_app` (NOBYPASSRLS) the app connects as, so RLS applies
 *  - `prisma migrate deploy` + idempotent seed (school `localtest`, admin, subscription, categories,
 *    exam type, student, enrollment) for the single-school specs
 *  - starts the fake R2/SMS server in this process on a free port
 *  - overwrites the env the workers inherit, so dev values (DB, Redis db, R2, SMS, keys) can't leak in
 * Only needs Postgres + Redis running. Works on Windows (pure Node, no bash/psql).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';
import { startFakeR2Sms } from './fake-r2-sms.mjs';

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const APP_ROLE = 'school_test_app';
const APP_PASSWORD = 'school_test_app';

const SEED_SQL = `
GRANT USAGE ON SCHEMA public TO ${APP_ROLE};
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${APP_ROLE};
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${APP_ROLE};
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${APP_ROLE};
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'app') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA app TO ${APP_ROLE}';
    EXECUTE 'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO ${APP_ROLE}';
  END IF;
END $$;
INSERT INTO "School"(name, "shortName", subdomain, "updatedAt")
  SELECT 'Local Test', 'LT', 'localtest', now()
  WHERE NOT EXISTS (SELECT 1 FROM "School" WHERE subdomain = 'localtest');
INSERT INTO admin(username, password, school_id, role)
  SELECT 'ltadmin', 'x', id, 'admin' FROM "School" WHERE subdomain = 'localtest'
  ON CONFLICT DO NOTHING;
INSERT INTO school_subscriptions(school_id, status, current_period_ends_at, updated_at)
  SELECT id, 'active', now() + interval '1 year', now() FROM "School" WHERE subdomain = 'localtest'
  AND NOT EXISTS (SELECT 1 FROM school_subscriptions s JOIN "School" sc ON sc.id = s.school_id WHERE sc.subdomain = 'localtest');
INSERT INTO categories(category, school_id)
  SELECT c, s.id FROM "School" s, unnest(ARRAY['Event','Campus','Labs','Achievement']) c
  WHERE s.subdomain = 'localtest' ON CONFLICT DO NOTHING;
INSERT INTO exam_types(name) VALUES ('HTTP Spec Type') ON CONFLICT DO NOTHING;
INSERT INTO students(login_id, name, batch, school_id)
  SELECT 900000001, 'Seed Student', '2090', id FROM "School" WHERE subdomain = 'localtest'
  ON CONFLICT DO NOTHING;
INSERT INTO student_enrollments(student_id, class, roll, section, year, school_id)
  SELECT st.id, 6, 1, 'A', 2090, st.school_id FROM students st
  JOIN "School" s ON s.id = st.school_id
  WHERE s.subdomain = 'localtest' AND st.login_id = 900000001
  ON CONFLICT DO NOTHING;
`;

const withDb = (url, db) => {
  const u = new URL(url);
  u.pathname = `/${db}`;
  u.search = '';
  return u.toString();
};

async function query(url, sql, params) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    return await client.query(sql, params);
  } finally {
    await client.end();
  }
}

export default async function globalSetup() {
  const envFile = path.join(serverDir, '.env');
  const fileEnv = fs.existsSync(envFile) ? dotenv.parse(fs.readFileSync(envFile)) : {};
  const pick = (k) => process.env[k] || fileEnv[k];
  const baseUrl = pick('DIRECT_URL') || pick('DATABASE_URL');
  if (!baseUrl) throw new Error('http specs: set DATABASE_URL (server/.env) to your Postgres');

  const base = new URL(baseUrl);
  const devDb = base.pathname.replace(/^\//, '') || 'school';
  const testDb = devDb.endsWith('_test') ? devDb : `${devDb}_test`;
  if (!/^[A-Za-z0-9_]+$/.test(testDb)) throw new Error(`unsupported database name: ${testDb}`);
  const ownerUrl = withDb(baseUrl, testDb);

  // Create the test DB + restricted role from the maintenance DB.
  const admin = withDb(baseUrl, 'postgres');
  const exists = await query(admin, 'SELECT 1 FROM pg_database WHERE datname = $1', [testDb]);
  if (exists.rowCount === 0) await query(admin, `CREATE DATABASE "${testDb}"`);
  await query(
    admin,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${APP_ROLE}') THEN
        CREATE ROLE ${APP_ROLE} LOGIN PASSWORD '${APP_PASSWORD}' NOSUPERUSER NOBYPASSRLS;
      END IF;
    END $$;`,
  );

  const migrate = spawnSync(
    process.execPath,
    [path.join(serverDir, 'node_modules/prisma/build/index.js'), 'migrate', 'deploy'],
    {
      cwd: serverDir,
      env: { ...process.env, DATABASE_URL: ownerUrl, DIRECT_URL: ownerUrl },
      encoding: 'utf8',
    },
  );
  if (migrate.status !== 0) {
    throw new Error(`prisma migrate deploy failed:\n${migrate.stdout}\n${migrate.stderr}`);
  }
  await query(ownerUrl, SEED_SQL);

  const fake = await startFakeR2Sms();
  globalThis.__FAKE_R2_SMS__ = fake;

  const appUrl = new URL(ownerUrl);
  appUrl.username = APP_ROLE;
  appUrl.password = APP_PASSWORD;

  // Workers are spawned after globalSetup and inherit process.env; dotenv never overrides it.
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: appUrl.toString(),
    DIRECT_URL: ownerUrl,
    REDIS_HOST: pick('REDIS_HOST') || '127.0.0.1',
    REDIS_DB: process.env.TEST_REDIS_DB || '15',
    JWT_SECRET: 'http-spec-jwt-secret',
    ENCRYPTION_KEY: '0'.repeat(64),
    R2_ACCOUNT_ID: 'test',
    R2_ACCESS_KEY_ID: 'test-key',
    R2_SECRET_ACCESS_KEY: 'test-secret',
    R2_BUCKET_NAME: 'test-bucket',
    R2_PUBLIC_URL: 'http://cdn.local',
    R2_ENDPOINT: fake.url,
    SMSPIT_URL: `${fake.url}/sms`,
  });
  console.log(
    `\nhttp specs: db ${testDb} as ${APP_ROLE}, redis db ${process.env.REDIS_DB}, fakes ${fake.url}`,
  );
}
