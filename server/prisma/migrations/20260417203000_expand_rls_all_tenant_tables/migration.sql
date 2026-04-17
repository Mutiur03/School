CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.current_school_id()
RETURNS INTEGER
LANGUAGE SQL
STABLE
AS $$
  -- Intentional: unauthenticated/no-tenant sessions get NULL and are blocked by RLS predicates.
  SELECT NULLIF(current_setting('app.school_id', true), '')::INTEGER;
$$;

CREATE OR REPLACE FUNCTION app.is_super_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT lower(coalesce(NULLIF(current_setting('app.is_super_admin', true), ''), '0'))
         IN ('1', 't', 'true', 'y', 'yes', 'on');
$$;

CREATE OR REPLACE FUNCTION app.set_school_id_from_rls_context()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Super admins must always choose tenant explicitly on insert.
  IF app.is_super_admin() AND NEW.school_id IS NULL THEN
    RAISE EXCEPTION 'school_id is required for super_admin inserts';
  END IF;

  IF NEW.school_id IS NULL THEN
    NEW.school_id := app.current_school_id();
  END IF;

  IF NEW.school_id IS NULL THEN
    RAISE EXCEPTION 'school_id is required (missing tenant context)';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
DECLARE
  rec RECORD;
  trigger_name TEXT;
  policy_select TEXT;
  policy_insert TEXT;
  policy_update TEXT;
  policy_delete TEXT;
  index_school_id TEXT;
BEGIN
  FOR rec IN
    SELECT DISTINCT table_schema, table_name
    FROM information_schema.columns
    WHERE column_name = 'school_id'
      AND table_schema = 'public'
  LOOP
    trigger_name := format('trg_%s_set_school_id', rec.table_name);
    policy_select := format('rls_%s_select', rec.table_name);
    policy_insert := format('rls_%s_insert', rec.table_name);
    policy_update := format('rls_%s_update', rec.table_name);
    policy_delete := format('rls_%s_delete', rec.table_name);
    index_school_id := format('idx_%s_school_id', rec.table_name);

    EXECUTE format(
      'DROP TRIGGER IF EXISTS %I ON %I.%I',
      trigger_name,
      rec.table_schema,
      rec.table_name
    );

    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT ON %I.%I FOR EACH ROW EXECUTE FUNCTION app.set_school_id_from_rls_context()',
      trigger_name,
      rec.table_schema,
      rec.table_name
    );

    EXECUTE format(
      'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
      rec.table_schema,
      rec.table_name
    );

    -- Security-first default: even table owner must obey RLS policies.
    EXECUTE format(
      'ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY',
      rec.table_schema,
      rec.table_name
    );
    
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_select,
      rec.table_schema,
      rec.table_name
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_insert,
      rec.table_schema,
      rec.table_name
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_update,
      rec.table_schema,
      rec.table_name
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_delete,
      rec.table_schema,
      rec.table_name
    );

    EXECUTE format(
      'CREATE POLICY %I ON %I.%I FOR SELECT USING (app.is_super_admin() OR school_id = app.current_school_id())',
      policy_select,
      rec.table_schema,
      rec.table_name
    );

    EXECUTE format(
      'CREATE POLICY %I ON %I.%I FOR INSERT WITH CHECK (app.is_super_admin() OR school_id = app.current_school_id())',
      policy_insert,
      rec.table_schema,
      rec.table_name
    );

    EXECUTE format(
      'CREATE POLICY %I ON %I.%I FOR UPDATE USING (app.is_super_admin() OR school_id = app.current_school_id()) WITH CHECK (app.is_super_admin() OR school_id = app.current_school_id())',
      policy_update,
      rec.table_schema,
      rec.table_name
    );

    EXECUTE format(
      'CREATE POLICY %I ON %I.%I FOR DELETE USING (app.is_super_admin() OR school_id = app.current_school_id())',
      policy_delete,
      rec.table_schema,
      rec.table_name
    );
  END LOOP;
END $$;
