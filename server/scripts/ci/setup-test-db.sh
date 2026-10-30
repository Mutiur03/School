#!/usr/bin/env bash
# Prepares a throwaway Postgres for the *.http.spec.ts suites (CI service container or local).
#   OWNER_URL  — superuser/owner connection (runs migrations, creates the runtime role)
#   APP_ROLE / APP_PASSWORD — restricted runtime role the app connects as, so RLS is enforced
# Seeds one school (subdomain `localtest`) with an admin + active subscription, which the
# single-school http specs (holidays, fees, accounts, ...) pick up via findFirst, plus an
# exam type, a student and a 2090 enrollment for the marks/promotion/public-results specs.
set -euo pipefail
: "${OWNER_URL:?OWNER_URL is required}"
APP_ROLE="${APP_ROLE:-school_app}"
APP_PASSWORD="${APP_PASSWORD:-school_app}"
cd "$(dirname "$0")/../.."

psql "$OWNER_URL" -v ON_ERROR_STOP=1 -q <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${APP_ROLE}') THEN
    CREATE ROLE ${APP_ROLE} LOGIN PASSWORD '${APP_PASSWORD}' NOSUPERUSER NOBYPASSRLS;
  END IF;
END \$\$;
SQL

DATABASE_URL="$OWNER_URL" DIRECT_URL="$OWNER_URL" pnpm exec prisma migrate deploy

psql "$OWNER_URL" -v ON_ERROR_STOP=1 -q <<SQL
GRANT USAGE ON SCHEMA public TO ${APP_ROLE};
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${APP_ROLE};
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${APP_ROLE};
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${APP_ROLE};
DO \$\$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'app') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA app TO ${APP_ROLE}';
    EXECUTE 'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO ${APP_ROLE}';
  END IF;
END \$\$;
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
SQL
echo "test database ready (app role: ${APP_ROLE})"
