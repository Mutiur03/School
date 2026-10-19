-- Allow super-admin refresh-token sessions (auth_sessions rows with school_id NULL).
--
-- 20261018120000 requires super_admin rows to have no school (auth_sessions_school_scope_check)
-- but attached the generic app.set_school_id_from_rls_context() trigger, which raises for a
-- NULL school_id in super-admin context ('school_id is required for super_admin inserts') and
-- outside it ('missing tenant context'). Every super-admin login and refresh therefore failed
-- with a 500.
--
-- This replaces the trigger on auth_sessions only with a table-specific function:
--   * NULL school_id is accepted only for user_role = 'super_admin' in super-admin RLS context
--     (app.is_super_admin(), the same check the generic function uses);
--   * everything else behaves exactly like app.set_school_id_from_rls_context().
-- The CHECK constraint, RLS policies, the generic function and every other table's trigger are
-- unchanged. No rows are read or written. Safe to re-run (CREATE OR REPLACE / DROP IF EXISTS).

CREATE OR REPLACE FUNCTION app.set_auth_sessions_school_id_from_rls_context()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Super-admin sessions belong to no school (see auth_sessions_school_scope_check).
  IF NEW.user_role = 'super_admin' AND NEW.school_id IS NULL AND app.is_super_admin() THEN
    RETURN NEW;
  END IF;

  -- Below: identical to app.set_school_id_from_rls_context().
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

DROP TRIGGER IF EXISTS trg_auth_sessions_set_school_id ON public.auth_sessions;
CREATE TRIGGER trg_auth_sessions_set_school_id
  BEFORE INSERT ON public.auth_sessions
  FOR EACH ROW EXECUTE FUNCTION app.set_auth_sessions_school_id_from_rls_context();
