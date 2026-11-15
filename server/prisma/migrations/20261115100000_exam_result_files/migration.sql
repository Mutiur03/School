-- CreateTable
CREATE TABLE "exam_result_files" (
    "id" SERIAL NOT NULL,
    "exam_id" INTEGER NOT NULL,
    "class" INTEGER NOT NULL,
    "r2_key" TEXT NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "school_id" INTEGER NOT NULL DEFAULT app.current_school_id(),

    CONSTRAINT "exam_result_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exam_result_files_exam_id_class_school_key"
  ON "exam_result_files"("exam_id", "class", "school_id");

-- CreateIndex
CREATE INDEX "exam_result_files_school_id_idx" ON "exam_result_files"("school_id");

-- AddForeignKey
ALTER TABLE "exam_result_files" ADD CONSTRAINT "exam_result_files_exam_id_fkey"
  FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_result_files" ADD CONSTRAINT "exam_result_files_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS (same pattern as marksheet_files)
CREATE TRIGGER trg_exam_result_files_set_school_id
  BEFORE INSERT ON public.exam_result_files
  FOR EACH ROW EXECUTE FUNCTION app.set_school_id_from_rls_context();

ALTER TABLE public.exam_result_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_result_files FORCE ROW LEVEL SECURITY;

CREATE POLICY rls_exam_result_files_select ON public.exam_result_files
  FOR SELECT USING (app.is_super_admin() OR school_id = app.current_school_id());
CREATE POLICY rls_exam_result_files_insert ON public.exam_result_files
  FOR INSERT WITH CHECK (app.is_super_admin() OR school_id = app.current_school_id());
CREATE POLICY rls_exam_result_files_update ON public.exam_result_files
  FOR UPDATE USING (app.is_super_admin() OR school_id = app.current_school_id())
  WITH CHECK (app.is_super_admin() OR school_id = app.current_school_id());
CREATE POLICY rls_exam_result_files_delete ON public.exam_result_files
  FOR DELETE USING (app.is_super_admin() OR school_id = app.current_school_id());
