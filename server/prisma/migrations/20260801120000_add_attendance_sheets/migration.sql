-- CreateTable
CREATE TABLE "attendance_sheets" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "class" INTEGER NOT NULL,
    "section" VARCHAR(20) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "r2_key" TEXT,
    "input_hash" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "generated_at" TIMESTAMP(3),
    "design_version" VARCHAR(32),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "school_id" INTEGER NOT NULL DEFAULT app.current_school_id(),

    CONSTRAINT "attendance_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendance_sheets_school_id_status_idx" ON "attendance_sheets"("school_id", "status");

-- CreateIndex
CREATE INDEX "attendance_sheets_status_idx" ON "attendance_sheets"("status");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_sheets_school_id_year_month_class_section_key" ON "attendance_sheets"("school_id", "year", "month", "class", "section");

-- AddForeignKey
ALTER TABLE "attendance_sheets" ADD CONSTRAINT "attendance_sheets_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Multi-tenant RLS for attendance_sheets
DO $$
BEGIN
  CREATE TRIGGER trg_attendance_sheets_set_school_id
    BEFORE INSERT ON public.attendance_sheets
    FOR EACH ROW EXECUTE FUNCTION app.set_school_id_from_rls_context();

  ALTER TABLE public.attendance_sheets ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.attendance_sheets FORCE ROW LEVEL SECURITY;

  CREATE POLICY rls_attendance_sheets_select ON public.attendance_sheets
    FOR SELECT USING (app.is_super_admin() OR school_id = app.current_school_id());
  CREATE POLICY rls_attendance_sheets_insert ON public.attendance_sheets
    FOR INSERT WITH CHECK (app.is_super_admin() OR school_id = app.current_school_id());
  CREATE POLICY rls_attendance_sheets_update ON public.attendance_sheets
    FOR UPDATE USING (app.is_super_admin() OR school_id = app.current_school_id())
    WITH CHECK (app.is_super_admin() OR school_id = app.current_school_id());
  CREATE POLICY rls_attendance_sheets_delete ON public.attendance_sheets
    FOR DELETE USING (app.is_super_admin() OR school_id = app.current_school_id());
END $$;
