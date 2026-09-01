-- Global exam catalog + per-school assignment + year-end flag on exam instances.

CREATE TABLE "exam_types" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "is_year_end" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "assign_to_new_schools" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "exam_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "exam_types_name_key" ON "exam_types"("name");

CREATE TABLE "school_exam_types" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL DEFAULT app.current_school_id(),
    "exam_type_id" INTEGER NOT NULL,

    CONSTRAINT "school_exam_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "school_exam_types_school_id_exam_type_id_key"
  ON "school_exam_types"("school_id", "exam_type_id");
CREATE INDEX "school_exam_types_school_id_idx" ON "school_exam_types"("school_id");
CREATE INDEX "school_exam_types_exam_type_id_idx" ON "school_exam_types"("exam_type_id");

ALTER TABLE "school_exam_types"
  ADD CONSTRAINT "school_exam_types_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "school_exam_types"
  ADD CONSTRAINT "school_exam_types_exam_type_id_fkey"
  FOREIGN KEY ("exam_type_id") REFERENCES "exam_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed catalog from the five UI defaults, then any extra names already in exams.
INSERT INTO "exam_types" ("name", "is_year_end", "sort_order", "assign_to_new_schools")
VALUES
  ('Half Yearly Examination', false, 10, true),
  ('Annual Examination', true, 20, true),
  ('Pretest Examination', false, 30, true),
  ('Annual/Test Examination', true, 40, true),
  ('Test Examination', false, 50, true)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "exam_types" ("name", "is_year_end", "sort_order", "assign_to_new_schools")
SELECT DISTINCT
  e.exam_name,
  e.exam_name IN ('Annual Examination', 'Annual/Test Examination'),
  100,
  false
FROM "exams" e
WHERE e.exam_name IS NOT NULL
  AND btrim(e.exam_name) <> ''
ON CONFLICT ("name") DO NOTHING;

-- Assign defaults to every school; also assign any name a school already used.
INSERT INTO "school_exam_types" ("school_id", "exam_type_id")
SELECT s.id, t.id
FROM "School" s
CROSS JOIN "exam_types" t
WHERE t.assign_to_new_schools = true
ON CONFLICT ("school_id", "exam_type_id") DO NOTHING;

INSERT INTO "school_exam_types" ("school_id", "exam_type_id")
SELECT DISTINCT e.school_id, t.id
FROM "exams" e
JOIN "exam_types" t ON t.name = e.exam_name
ON CONFLICT ("school_id", "exam_type_id") DO NOTHING;

ALTER TABLE "exams" ADD COLUMN "exam_type_id" INTEGER;
ALTER TABLE "exams" ADD COLUMN "is_year_end" BOOLEAN NOT NULL DEFAULT false;

UPDATE "exams" e
SET
  exam_type_id = t.id,
  is_year_end = t.is_year_end
FROM "exam_types" t
WHERE t.name = e.exam_name;

ALTER TABLE "exams" ALTER COLUMN "exam_type_id" SET NOT NULL;

ALTER TABLE "exams"
  ADD CONSTRAINT "exams_exam_type_id_fkey"
  FOREIGN KEY ("exam_type_id") REFERENCES "exam_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX IF EXISTS "exams_exam_name_exam_year_levels_school_id_key";

CREATE UNIQUE INDEX "exams_exam_type_id_exam_year_school_id_key"
  ON "exams"("exam_type_id", "exam_year", "school_id");

CREATE INDEX "exams_exam_year_is_year_end_idx" ON "exams"("exam_year", "is_year_end");

-- Global catalog: anyone can read; only superadmin writes.
ALTER TABLE public.exam_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_types FORCE ROW LEVEL SECURITY;

CREATE POLICY rls_exam_types_select ON public.exam_types
  FOR SELECT USING (true);
CREATE POLICY rls_exam_types_insert ON public.exam_types
  FOR INSERT WITH CHECK (app.is_super_admin());
CREATE POLICY rls_exam_types_update ON public.exam_types
  FOR UPDATE USING (app.is_super_admin())
  WITH CHECK (app.is_super_admin());
CREATE POLICY rls_exam_types_delete ON public.exam_types
  FOR DELETE USING (app.is_super_admin());

-- Junction: standard tenant RLS.
DO $$
BEGIN
  CREATE TRIGGER trg_school_exam_types_set_school_id
    BEFORE INSERT ON public.school_exam_types
    FOR EACH ROW EXECUTE FUNCTION app.set_school_id_from_rls_context();

  ALTER TABLE public.school_exam_types ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.school_exam_types FORCE ROW LEVEL SECURITY;

  CREATE POLICY rls_school_exam_types_select ON public.school_exam_types
    FOR SELECT USING (app.is_super_admin() OR school_id = app.current_school_id());
  CREATE POLICY rls_school_exam_types_insert ON public.school_exam_types
    FOR INSERT WITH CHECK (app.is_super_admin() OR school_id = app.current_school_id());
  CREATE POLICY rls_school_exam_types_update ON public.school_exam_types
    FOR UPDATE USING (app.is_super_admin() OR school_id = app.current_school_id())
    WITH CHECK (app.is_super_admin() OR school_id = app.current_school_id());
  CREATE POLICY rls_school_exam_types_delete ON public.school_exam_types
    FOR DELETE USING (app.is_super_admin() OR school_id = app.current_school_id());
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'school_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON exam_types TO school_app;
    GRANT USAGE, SELECT ON SEQUENCE exam_types_id_seq TO school_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON school_exam_types TO school_app;
    GRANT USAGE, SELECT ON SEQUENCE school_exam_types_id_seq TO school_app;
  END IF;
END $$;
