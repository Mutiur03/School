CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.current_school_id()
RETURNS INTEGER
LANGUAGE SQL
STABLE
AS $$
  SELECT NULLIF(current_setting('app.school_id', true), '')::INTEGER;
$$;

CREATE OR REPLACE FUNCTION app.is_super_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT current_setting('app.is_super_admin', true) = '1';
$$;

CREATE OR REPLACE FUNCTION app.set_school_id_from_rls_context()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.school_id IS NULL THEN
    NEW.school_id := app.current_school_id();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_exams_set_school_id ON "exams";
CREATE TRIGGER trg_exams_set_school_id
BEFORE INSERT ON "exams"
FOR EACH ROW
EXECUTE FUNCTION app.set_school_id_from_rls_context();

DROP TRIGGER IF EXISTS trg_exam_routines_set_school_id ON "exam_routines";
CREATE TRIGGER trg_exam_routines_set_school_id
BEFORE INSERT ON "exam_routines"
FOR EACH ROW
EXECUTE FUNCTION app.set_school_id_from_rls_context();

ALTER TABLE "exams" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exams" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exams_tenant_select ON "exams";
DROP POLICY IF EXISTS exams_tenant_insert ON "exams";
DROP POLICY IF EXISTS exams_tenant_update ON "exams";
DROP POLICY IF EXISTS exams_tenant_delete ON "exams";

CREATE POLICY exams_tenant_select
ON "exams"
FOR SELECT
USING (app.is_super_admin() OR school_id = app.current_school_id());

CREATE POLICY exams_tenant_insert
ON "exams"
FOR INSERT
WITH CHECK (app.is_super_admin() OR school_id = app.current_school_id());

CREATE POLICY exams_tenant_update
ON "exams"
FOR UPDATE
USING (app.is_super_admin() OR school_id = app.current_school_id())
WITH CHECK (app.is_super_admin() OR school_id = app.current_school_id());

CREATE POLICY exams_tenant_delete
ON "exams"
FOR DELETE
USING (app.is_super_admin() OR school_id = app.current_school_id());

ALTER TABLE "exam_routines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exam_routines" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exam_routines_tenant_select ON "exam_routines";
DROP POLICY IF EXISTS exam_routines_tenant_insert ON "exam_routines";
DROP POLICY IF EXISTS exam_routines_tenant_update ON "exam_routines";
DROP POLICY IF EXISTS exam_routines_tenant_delete ON "exam_routines";

CREATE POLICY exam_routines_tenant_select
ON "exam_routines"
FOR SELECT
USING (app.is_super_admin() OR school_id = app.current_school_id());

CREATE POLICY exam_routines_tenant_insert
ON "exam_routines"
FOR INSERT
WITH CHECK (app.is_super_admin() OR school_id = app.current_school_id());

CREATE POLICY exam_routines_tenant_update
ON "exam_routines"
FOR UPDATE
USING (app.is_super_admin() OR school_id = app.current_school_id())
WITH CHECK (app.is_super_admin() OR school_id = app.current_school_id());

CREATE POLICY exam_routines_tenant_delete
ON "exam_routines"
FOR DELETE
USING (app.is_super_admin() OR school_id = app.current_school_id());
