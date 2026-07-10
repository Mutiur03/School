-- Grand-total class highest (max per-student sum across ALL subjects, incl.
-- continuous), for the "Grand Total Marks" summary row. class_highest_total
-- stays exam-only (used by the "Total Marks" row).
ALTER TABLE "exam_class_stats"
  ADD COLUMN "class_highest_grand_total" INTEGER NOT NULL DEFAULT 0;
