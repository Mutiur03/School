-- Multi-tenant RLS for marksheet_sessions (same pattern as attendance_sheets).
ALTER TABLE "marksheet_sessions"
  ALTER COLUMN "school_id" SET DEFAULT app.current_school_id();

DO $$
BEGIN
  CREATE TRIGGER trg_marksheet_sessions_set_school_id
    BEFORE INSERT ON public.marksheet_sessions
    FOR EACH ROW EXECUTE FUNCTION app.set_school_id_from_rls_context();

  ALTER TABLE public.marksheet_sessions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.marksheet_sessions FORCE ROW LEVEL SECURITY;

  CREATE POLICY rls_marksheet_sessions_select ON public.marksheet_sessions
    FOR SELECT USING (app.is_super_admin() OR school_id = app.current_school_id());
  CREATE POLICY rls_marksheet_sessions_insert ON public.marksheet_sessions
    FOR INSERT WITH CHECK (app.is_super_admin() OR school_id = app.current_school_id());
  CREATE POLICY rls_marksheet_sessions_update ON public.marksheet_sessions
    FOR UPDATE USING (app.is_super_admin() OR school_id = app.current_school_id())
    WITH CHECK (app.is_super_admin() OR school_id = app.current_school_id());
  CREATE POLICY rls_marksheet_sessions_delete ON public.marksheet_sessions
    FOR DELETE USING (app.is_super_admin() OR school_id = app.current_school_id());
END $$;
