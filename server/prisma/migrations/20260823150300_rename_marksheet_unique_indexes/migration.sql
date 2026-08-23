-- Align unique index names with Prisma @@unique naming (school_id column suffix).
ALTER INDEX "marksheet_bundles_exam_id_class_section_school_key"
  RENAME TO "marksheet_bundles_exam_id_class_section_school_id_key";

ALTER INDEX "marksheet_files_student_id_exam_id_school_key"
  RENAME TO "marksheet_files_student_id_exam_id_school_id_key";
