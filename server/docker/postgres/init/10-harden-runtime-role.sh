#!/bin/sh
set -eu

APP_DB_ROLE="${APP_DB_ROLE:-school_app}"
APP_DB_PASSWORD="${APP_DB_PASSWORD:-postgres}"

# Bootstrap superuser cannot drop own SUPERUSER attribute. Create dedicated runtime role instead.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v app_db_role="$APP_DB_ROLE" \
  -v app_db_password="$APP_DB_PASSWORD" <<'EOSQL'
DO $$
DECLARE
  db_name TEXT := current_database();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_db_role') THEN
    EXECUTE format(
      'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',
      :'app_db_role',
      :'app_db_password'
    );
  END IF;

  EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I', db_name, :'app_db_role');
  EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', :'app_db_role');
  EXECUTE format('GRANT USAGE ON SCHEMA app TO %I', :'app_db_role');

  EXECUTE format('GRANT EXECUTE ON FUNCTION app.current_school_id() TO %I', :'app_db_role');
  EXECUTE format('GRANT EXECUTE ON FUNCTION app.is_super_admin() TO %I', :'app_db_role');
  EXECUTE format('GRANT EXECUTE ON FUNCTION app.set_school_id_from_rls_context() TO %I', :'app_db_role');

  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %I', :'app_db_role');
  EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO %I', :'app_db_role');
END $$;
EOSQL