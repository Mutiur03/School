-- Junior Scholarship Examination form-fillup (mirrors class8_reg shape)

CREATE TABLE "junior_scholarship_reg" (
    "id" SERIAL NOT NULL,
    "reg_open" BOOLEAN DEFAULT false,
    "a_sec_roll" TEXT,
    "b_sec_roll" TEXT,
    "notice" TEXT,
    "jse_year" INTEGER NOT NULL,
    "instruction_for_a" TEXT DEFAULT 'Please follow the instructions carefully',
    "instruction_for_b" TEXT DEFAULT 'Please follow the instructions carefully',
    "attachment_instruction" TEXT DEFAULT 'Please attach all required documents',
    "classmates" TEXT,
    "classmates_source" TEXT NOT NULL DEFAULT 'default',
    "school_id" INTEGER NOT NULL DEFAULT app.current_school_id(),

    CONSTRAINT "junior_scholarship_reg_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "student_registration_junior_scholarship" (
    "id" TEXT NOT NULL,
    "section" VARCHAR(10) NOT NULL,
    "roll" VARCHAR(20) NOT NULL,
    "religion" VARCHAR(50) NOT NULL,
    "student_name_bn" VARCHAR(100) NOT NULL,
    "student_name_en" VARCHAR(100) NOT NULL,
    "birth_reg_no" VARCHAR(17) NOT NULL,
    "father_name_bn" VARCHAR(100) NOT NULL,
    "father_name_en" VARCHAR(100) NOT NULL,
    "father_nid" VARCHAR(17),
    "father_phone" VARCHAR(11),
    "mother_name_bn" VARCHAR(100) NOT NULL,
    "mother_name_en" VARCHAR(100) NOT NULL,
    "mother_nid" VARCHAR(17),
    "mother_phone" VARCHAR(11),
    "birth_date" VARCHAR(10) NOT NULL,
    "birth_year" VARCHAR(4) NOT NULL,
    "birth_month" VARCHAR(2) NOT NULL,
    "birth_day" VARCHAR(2) NOT NULL,
    "email" VARCHAR(100),
    "present_district" VARCHAR(50) NOT NULL,
    "present_upazila" VARCHAR(50) NOT NULL,
    "present_post_office" VARCHAR(100) NOT NULL,
    "present_post_code" VARCHAR(4) NOT NULL,
    "present_village_road" VARCHAR(200) NOT NULL,
    "permanent_district" VARCHAR(50) NOT NULL,
    "permanent_upazila" VARCHAR(50) NOT NULL,
    "permanent_post_office" VARCHAR(100) NOT NULL,
    "permanent_post_code" VARCHAR(4) NOT NULL,
    "permanent_village_road" VARCHAR(200) NOT NULL,
    "guardian_name" VARCHAR(100),
    "guardian_phone" VARCHAR(11),
    "guardian_relation" VARCHAR(50),
    "guardian_nid" VARCHAR(17),
    "guardian_district" VARCHAR(50),
    "guardian_upazila" VARCHAR(50),
    "guardian_post_office" VARCHAR(100),
    "guardian_post_code" VARCHAR(4),
    "guardian_village_road" VARCHAR(200),
    "prev_school_name" VARCHAR(200) NOT NULL,
    "prev_school_district" VARCHAR(50) NOT NULL,
    "prev_school_upazila" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "submission_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "photo" VARCHAR(255) NOT NULL,
    "jse_year" INTEGER NOT NULL,
    "nearby_student_info" VARCHAR(200),
    "class6_passing_year" VARCHAR(4) NOT NULL,
    "class6_board" VARCHAR(50) NOT NULL,
    "class6_reg_no" VARCHAR(10) NOT NULL,
    "class6_roll_no" VARCHAR(20) NOT NULL,
    "scout_status" VARCHAR(10),
    "school_id" INTEGER NOT NULL DEFAULT app.current_school_id(),
    "pdf_path" VARCHAR(255),
    "pdf_settings_snapshot" JSONB,
    "pdf_generated_at" TIMESTAMP(3),

    CONSTRAINT "student_registration_junior_scholarship_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "junior_scholarship_reg_school_id_jse_year_key"
  ON "junior_scholarship_reg"("school_id", "jse_year");
CREATE INDEX "junior_scholarship_reg_school_id_idx"
  ON "junior_scholarship_reg"("school_id");

CREATE UNIQUE INDEX "student_registration_jse_school_year_section_roll_key"
  ON "student_registration_junior_scholarship"("school_id", "jse_year", "section", "roll");
CREATE UNIQUE INDEX "student_registration_jse_school_year_birth_reg_key"
  ON "student_registration_junior_scholarship"("school_id", "jse_year", "birth_reg_no");
CREATE INDEX "student_registration_junior_scholarship_birth_reg_no_idx"
  ON "student_registration_junior_scholarship"("birth_reg_no");
CREATE INDEX "student_registration_junior_scholarship_father_nid_idx"
  ON "student_registration_junior_scholarship"("father_nid");
CREATE INDEX "student_registration_junior_scholarship_mother_nid_idx"
  ON "student_registration_junior_scholarship"("mother_nid");
CREATE INDEX "student_registration_junior_scholarship_status_idx"
  ON "student_registration_junior_scholarship"("status");
CREATE INDEX "student_registration_junior_scholarship_submission_date_idx"
  ON "student_registration_junior_scholarship"("submission_date");
CREATE INDEX "student_registration_junior_scholarship_school_id_idx"
  ON "student_registration_junior_scholarship"("school_id");

ALTER TABLE "junior_scholarship_reg"
  ADD CONSTRAINT "junior_scholarship_reg_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "student_registration_junior_scholarship"
  ADD CONSTRAINT "student_registration_junior_scholarship_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$
BEGIN
  CREATE TRIGGER trg_junior_scholarship_reg_set_school_id
    BEFORE INSERT ON public.junior_scholarship_reg
    FOR EACH ROW EXECUTE FUNCTION app.set_school_id_from_rls_context();

  ALTER TABLE public.junior_scholarship_reg ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.junior_scholarship_reg FORCE ROW LEVEL SECURITY;

  CREATE POLICY rls_junior_scholarship_reg_select ON public.junior_scholarship_reg
    FOR SELECT USING (app.is_super_admin() OR school_id = app.current_school_id());
  CREATE POLICY rls_junior_scholarship_reg_insert ON public.junior_scholarship_reg
    FOR INSERT WITH CHECK (app.is_super_admin() OR school_id = app.current_school_id());
  CREATE POLICY rls_junior_scholarship_reg_update ON public.junior_scholarship_reg
    FOR UPDATE USING (app.is_super_admin() OR school_id = app.current_school_id())
    WITH CHECK (app.is_super_admin() OR school_id = app.current_school_id());
  CREATE POLICY rls_junior_scholarship_reg_delete ON public.junior_scholarship_reg
    FOR DELETE USING (app.is_super_admin() OR school_id = app.current_school_id());

  CREATE TRIGGER trg_student_registration_junior_scholarship_set_school_id
    BEFORE INSERT ON public.student_registration_junior_scholarship
    FOR EACH ROW EXECUTE FUNCTION app.set_school_id_from_rls_context();

  ALTER TABLE public.student_registration_junior_scholarship ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.student_registration_junior_scholarship FORCE ROW LEVEL SECURITY;

  CREATE POLICY rls_student_registration_junior_scholarship_select
    ON public.student_registration_junior_scholarship
    FOR SELECT USING (app.is_super_admin() OR school_id = app.current_school_id());
  CREATE POLICY rls_student_registration_junior_scholarship_insert
    ON public.student_registration_junior_scholarship
    FOR INSERT WITH CHECK (app.is_super_admin() OR school_id = app.current_school_id());
  CREATE POLICY rls_student_registration_junior_scholarship_update
    ON public.student_registration_junior_scholarship
    FOR UPDATE USING (app.is_super_admin() OR school_id = app.current_school_id())
    WITH CHECK (app.is_super_admin() OR school_id = app.current_school_id());
  CREATE POLICY rls_student_registration_junior_scholarship_delete
    ON public.student_registration_junior_scholarship
    FOR DELETE USING (app.is_super_admin() OR school_id = app.current_school_id());
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'school_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON junior_scholarship_reg TO school_app;
    GRANT USAGE, SELECT ON SEQUENCE junior_scholarship_reg_id_seq TO school_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON student_registration_junior_scholarship TO school_app;
  END IF;
END $$;
