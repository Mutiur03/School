-- Runtime app role (school_app) needs table privileges on exam_class_stats.
-- Migrations run as the privileged owner (mutiur) via MIGRATION_DATABASE_URL,
-- so the new table is owned by mutiur and the app role has no access by
-- default -> "permission denied for table exam_class_stats" (42501) on write.
--
-- Grant it here, and set DEFAULT PRIVILEGES so every FUTURE table/sequence the
-- migrate role creates auto-grants to the app role (prevents recurrence).
--
-- Guarded by a role-exists check so this is a harmless no-op in environments
-- that don't have a separate app role (e.g. local dev where one superuser role
-- does everything). Tenant isolation still comes from RLS, not these grants.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'school_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON exam_class_stats TO school_app;
    GRANT USAGE, SELECT ON SEQUENCE exam_class_stats_id_seq TO school_app;

    -- Future tables/sequences created by the current (migrate) role.
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO school_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT USAGE, SELECT ON SEQUENCES TO school_app;
  END IF;
END $$;
