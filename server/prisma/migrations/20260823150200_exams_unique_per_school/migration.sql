-- Allow each school to define its own exams (same name/year/levels).

DROP INDEX IF EXISTS "exams_exam_name_exam_year_levels_key";

CREATE UNIQUE INDEX "exams_exam_name_exam_year_levels_school_id_key"
  ON "exams"("exam_name", "exam_year", "levels", "school_id");
