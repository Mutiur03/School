-- Allow sms_logs to record non-attendance sends (password reset codes, test SMS).
-- student_id / attendance_date become optional; category distinguishes the send type
-- so existing attendance stats/date-filter queries can keep filtering by category = 'attendance'.
-- Note: the existing student_id FK constraint already permits NULL values, so it is left as-is.

ALTER TABLE "sms_logs" ADD COLUMN "category" VARCHAR(30) NOT NULL DEFAULT 'attendance';

ALTER TABLE "sms_logs" ALTER COLUMN "student_id" DROP NOT NULL;
ALTER TABLE "sms_logs" ALTER COLUMN "attendance_date" DROP NOT NULL;

CREATE INDEX "sms_logs_category_idx" ON "sms_logs"("category");
