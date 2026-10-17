-- Postgres truncates identifiers to 63 chars; align the index with the name Prisma expects.
ALTER INDEX "fee_receipt_items_school_id_student_id_year_fee_head_id_month_k" RENAME TO "fee_receipt_items_school_id_student_id_year_fee_head_id_mon_key";
