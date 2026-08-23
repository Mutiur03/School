-- Multi-tenant RLS for marksheet_files and marksheet_bundles (cache tables).

-- Drop old global unique constraints before adding school-scoped ones.
DROP INDEX IF EXISTS "marksheet_files_student_id_exam_id_key";
DROP INDEX IF EXISTS "marksheet_bundles_exam_id_class_section_key";

CREATE UNIQUE INDEX "marksheet_files_student_id_exam_id_school_key"
  ON "marksheet_files"("student_id", "exam_id", "school_id");
CREATE UNIQUE INDEX "marksheet_bundles_exam_id_class_section_school_key"
  ON "marksheet_bundles"("exam_id", "class", "section", "school_id");

-- marksheet_files RLS
ALTER TABLE "marksheet_files"
  ALTER COLUMN "school_id" SET DEFAULT app.current_school_id();

DO $$
BEGIN
  CREATE TRIGGER trg_marksheet_files_set_school_id
    BEFORE INSERT ON public.marksheet_files
    FOR EACH ROW EXECUTE FUNCTION app.set_school_id_from_rls_context();

  ALTER TABLE public.marksheet_files ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.marksheet_files FORCE ROW LEVEL SECURITY;

  CREATE POLICY rls_marksheet_files_select ON public.marksheet_files
    FOR SELECT USING (app.is_super_admin() OR school_id = app.current_school_id());
  CREATE POLICY rls_marksheet_files_insert ON public.marksheet_files
    FOR INSERT WITH CHECK (app.is_super_admin() OR school_id = app.current_school_id());
  CREATE POLICY rls_marksheet_files_update ON public.marksheet_files
    FOR UPDATE USING (app.is_super_admin() OR school_id = app.current_school_id())
    WITH CHECK (app.is_super_admin() OR school_id = app.current_school_id());
  CREATE POLICY rls_marksheet_files_delete ON public.marksheet_files
    FOR DELETE USING (app.is_super_admin() OR school_id = app.current_school_id());
END $$;

-- marksheet_bundles RLS
ALTER TABLE "marksheet_bundles"
  ALTER COLUMN "school_id" SET DEFAULT app.current_school_id();

DO $$
BEGIN
  CREATE TRIGGER trg_marksheet_bundles_set_school_id
    BEFORE INSERT ON public.marksheet_bundles
    FOR EACH ROW EXECUTE FUNCTION app.set_school_id_from_rls_context();

  ALTER TABLE public.marksheet_bundles ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.marksheet_bundles FORCE ROW LEVEL SECURITY;

  CREATE POLICY rls_marksheet_bundles_select ON public.marksheet_bundles
    FOR SELECT USING (app.is_super_admin() OR school_id = app.current_school_id());
  CREATE POLICY rls_marksheet_bundles_insert ON public.marksheet_bundles
    FOR INSERT WITH CHECK (app.is_super_admin() OR school_id = app.current_school_id());
  CREATE POLICY rls_marksheet_bundles_update ON public.marksheet_bundles
    FOR UPDATE USING (app.is_super_admin() OR school_id = app.current_school_id())
    WITH CHECK (app.is_super_admin() OR school_id = app.current_school_id());
  CREATE POLICY rls_marksheet_bundles_delete ON public.marksheet_bundles
    FOR DELETE USING (app.is_super_admin() OR school_id = app.current_school_id());
END $$;
