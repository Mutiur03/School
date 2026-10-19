-- Manual pass/fail override: regenerating results keeps this status; promotion treats the student as locked.
ALTER TABLE "student_enrollments" ADD COLUMN "result_manual" BOOLEAN NOT NULL DEFAULT false;
