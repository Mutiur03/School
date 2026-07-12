/*
  Warnings:

  - Made the column `school_id` on table `CitizenCharter` required. This step will fail if there are existing NULL values in that column.
  - Made the column `school_id` on table `admin` required. This step will fail if there are existing NULL values in that column.
  - Made the column `school_id` on table `admission` required. This step will fail if there are existing NULL values in that column.
  - Made the column `school_id` on table `admission_form` required. This step will fail if there are existing NULL values in that column.
  - Made the column `school_id` on table `admission_result` required. This step will fail if there are existing NULL values in that column.
  - Made the column `school_id` on table `attendence` required. This step will fail if there are existing NULL values in that column.
  - Made the column `school_id` on table `categories` required. This step will fail if there are existing NULL values in that column.
  - Made the column `school_id` on table `class6_reg` required. This step will fail if there are existing NULL values in that column.
  - Made the column `school_id` on table `class8_reg` required. This step will fail if there are existing NULL values in that column.
  - Made the column `school_id` on table `class_routine` required. This step will fail if there are existing NULL values in that column.
  - Made the column `school_id` on table `class_routine_pdf` required. This step will fail if there are existing NULL values in that column.
  - Made the column `school_id` on table `class_slot_time` required. This step will fail if there are existing NULL values in that column.
  - Made the column `school_id` on table `events` required. This step will fail if there are existing NULL values in that column.
  - Made the column `school_id` on table `exam_class_stats` required. This step will fail if there are existing NULL values in that column.
  - Made the column `school_id` on table `exam_routines` required. This step will fail if there are existing NULL values in that column.
  - Made the column `school_id` on table `exams` required. This step will fail if there are existing NULL values in that column.
  - Made the column `school_id` on table `gallery` required. This step will fail if there are existing NULL values in that column.
  - Made the column `school_id` on table `head_msg` required. This step will fail if there are existing NULL values in that column.
  - Made the column `school_id` on table `holidays` required. This step will fail if there are existing NULL values in that column.
  - Made the column `school_id` on table `levels` required. This step will fail if there are existing NULL values in that column.
  - Made the column `school_id` on table `marks` required. This step will fail if there are existing NULL values in that column.
  - Made the column `school_id` on table `notices` required. This step will fail if there are existing NULL values in that column.
  - Made the column `school_id` on table `sms_logs` required. This step will fail if there are existing NULL values in that column.
  - Made the column `school_id` on table `ssc_reg` required. This step will fail if there are existing NULL values in that column.
  - Made the column `school_id` on table `staffs` required. This step will fail if there are existing NULL values in that column.
  - Made the column `school_id` on table `student_enrollments` required. This step will fail if there are existing NULL values in that column.
  - Made the column `school_id` on table `student_registration_class6` required. This step will fail if there are existing NULL values in that column.
  - Made the column `school_id` on table `student_registration_class8` required. This step will fail if there are existing NULL values in that column.
  - Made the column `school_id` on table `student_registration_ssc` required. This step will fail if there are existing NULL values in that column.
  - Made the column `school_id` on table `students` required. This step will fail if there are existing NULL values in that column.
  - Made the column `school_id` on table `subjects` required. This step will fail if there are existing NULL values in that column.
  - Made the column `school_id` on table `syllabus` required. This step will fail if there are existing NULL values in that column.
  - Made the column `school_id` on table `teachers` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "CitizenCharter" DROP CONSTRAINT "CitizenCharter_school_id_fkey";

-- DropForeignKey
ALTER TABLE "admin" DROP CONSTRAINT "admin_school_id_fkey";

-- DropForeignKey
ALTER TABLE "admission" DROP CONSTRAINT "admission_school_id_fkey";

-- DropForeignKey
ALTER TABLE "admission_form" DROP CONSTRAINT "admission_form_school_id_fkey";

-- DropForeignKey
ALTER TABLE "admission_result" DROP CONSTRAINT "admission_result_school_id_fkey";

-- DropForeignKey
ALTER TABLE "attendence" DROP CONSTRAINT "attendence_school_id_fkey";

-- DropForeignKey
ALTER TABLE "categories" DROP CONSTRAINT "categories_school_id_fkey";

-- DropForeignKey
ALTER TABLE "class6_reg" DROP CONSTRAINT "class6_reg_school_id_fkey";

-- DropForeignKey
ALTER TABLE "class8_reg" DROP CONSTRAINT "class8_reg_school_id_fkey";

-- DropForeignKey
ALTER TABLE "class_routine" DROP CONSTRAINT "class_routine_school_id_fkey";

-- DropForeignKey
ALTER TABLE "class_routine_pdf" DROP CONSTRAINT "class_routine_pdf_school_id_fkey";

-- DropForeignKey
ALTER TABLE "class_slot_time" DROP CONSTRAINT "class_slot_time_school_id_fkey";

-- DropForeignKey
ALTER TABLE "events" DROP CONSTRAINT "events_school_id_fkey";

-- DropForeignKey
ALTER TABLE "exam_class_stats" DROP CONSTRAINT "exam_class_stats_school_id_fkey";

-- DropForeignKey
ALTER TABLE "exam_routines" DROP CONSTRAINT "exam_routines_school_id_fkey";

-- DropForeignKey
ALTER TABLE "exams" DROP CONSTRAINT "exams_school_id_fkey";

-- DropForeignKey
ALTER TABLE "gallery" DROP CONSTRAINT "gallery_school_id_fkey";

-- DropForeignKey
ALTER TABLE "head_msg" DROP CONSTRAINT "head_msg_school_id_fkey";

-- DropForeignKey
ALTER TABLE "holidays" DROP CONSTRAINT "holidays_school_id_fkey";

-- DropForeignKey
ALTER TABLE "levels" DROP CONSTRAINT "levels_school_id_fkey";

-- DropForeignKey
ALTER TABLE "marks" DROP CONSTRAINT "marks_school_id_fkey";

-- DropForeignKey
ALTER TABLE "marksheet_bundles" DROP CONSTRAINT "marksheet_bundles_school_id_fkey";

-- DropForeignKey
ALTER TABLE "marksheet_files" DROP CONSTRAINT "marksheet_files_school_id_fkey";

-- DropForeignKey
ALTER TABLE "notices" DROP CONSTRAINT "notices_school_id_fkey";

-- DropForeignKey
ALTER TABLE "sms_logs" DROP CONSTRAINT "sms_logs_school_id_fkey";

-- DropForeignKey
ALTER TABLE "ssc_reg" DROP CONSTRAINT "ssc_reg_school_id_fkey";

-- DropForeignKey
ALTER TABLE "staffs" DROP CONSTRAINT "staffs_school_id_fkey";

-- DropForeignKey
ALTER TABLE "student_enrollments" DROP CONSTRAINT "student_enrollments_school_id_fkey";

-- DropForeignKey
ALTER TABLE "student_registration_class6" DROP CONSTRAINT "student_registration_class6_school_id_fkey";

-- DropForeignKey
ALTER TABLE "student_registration_class8" DROP CONSTRAINT "student_registration_class8_school_id_fkey";

-- DropForeignKey
ALTER TABLE "student_registration_ssc" DROP CONSTRAINT "student_registration_ssc_school_id_fkey";

-- DropForeignKey
ALTER TABLE "students" DROP CONSTRAINT "students_school_id_fkey";

-- DropForeignKey
ALTER TABLE "subjects" DROP CONSTRAINT "subjects_school_id_fkey";

-- DropForeignKey
ALTER TABLE "syllabus" DROP CONSTRAINT "syllabus_school_id_fkey";

-- DropForeignKey
ALTER TABLE "teachers" DROP CONSTRAINT "teachers_school_id_fkey";

-- AlterTable
ALTER TABLE "CitizenCharter" ALTER COLUMN "school_id" SET NOT NULL,
ALTER COLUMN "school_id" SET DEFAULT app.current_school_id();

-- AlterTable
ALTER TABLE "admin" ALTER COLUMN "school_id" SET NOT NULL,
ALTER COLUMN "school_id" SET DEFAULT app.current_school_id();

-- AlterTable
ALTER TABLE "admission" ALTER COLUMN "school_id" SET NOT NULL,
ALTER COLUMN "school_id" SET DEFAULT app.current_school_id();

-- AlterTable
ALTER TABLE "admission_form" ALTER COLUMN "school_id" SET NOT NULL,
ALTER COLUMN "school_id" SET DEFAULT app.current_school_id();

-- AlterTable
ALTER TABLE "admission_result" ALTER COLUMN "school_id" SET NOT NULL,
ALTER COLUMN "school_id" SET DEFAULT app.current_school_id();

-- AlterTable
ALTER TABLE "attendence" ALTER COLUMN "school_id" SET NOT NULL,
ALTER COLUMN "school_id" SET DEFAULT app.current_school_id();

-- AlterTable
ALTER TABLE "categories" ALTER COLUMN "school_id" SET NOT NULL,
ALTER COLUMN "school_id" SET DEFAULT app.current_school_id();

-- AlterTable
ALTER TABLE "class6_reg" ALTER COLUMN "school_id" SET NOT NULL,
ALTER COLUMN "school_id" SET DEFAULT app.current_school_id();

-- AlterTable
ALTER TABLE "class8_reg" ALTER COLUMN "school_id" SET NOT NULL,
ALTER COLUMN "school_id" SET DEFAULT app.current_school_id();

-- AlterTable
ALTER TABLE "class_routine" ALTER COLUMN "school_id" SET NOT NULL,
ALTER COLUMN "school_id" SET DEFAULT app.current_school_id();

-- AlterTable
ALTER TABLE "class_routine_pdf" ALTER COLUMN "school_id" SET NOT NULL,
ALTER COLUMN "school_id" SET DEFAULT app.current_school_id();

-- AlterTable
ALTER TABLE "class_slot_time" ALTER COLUMN "school_id" SET NOT NULL,
ALTER COLUMN "school_id" SET DEFAULT app.current_school_id();

-- AlterTable
ALTER TABLE "events" ALTER COLUMN "school_id" SET NOT NULL,
ALTER COLUMN "school_id" SET DEFAULT app.current_school_id();

-- AlterTable
ALTER TABLE "exam_class_stats" ALTER COLUMN "school_id" SET NOT NULL,
ALTER COLUMN "school_id" SET DEFAULT app.current_school_id();

-- AlterTable
ALTER TABLE "exam_routines" ALTER COLUMN "school_id" SET NOT NULL,
ALTER COLUMN "school_id" SET DEFAULT app.current_school_id();

-- AlterTable
ALTER TABLE "exams" ALTER COLUMN "school_id" SET NOT NULL,
ALTER COLUMN "school_id" SET DEFAULT app.current_school_id();

-- AlterTable
ALTER TABLE "gallery" ALTER COLUMN "school_id" SET NOT NULL,
ALTER COLUMN "school_id" SET DEFAULT app.current_school_id();

-- AlterTable
ALTER TABLE "head_msg" ALTER COLUMN "school_id" SET NOT NULL,
ALTER COLUMN "school_id" SET DEFAULT app.current_school_id();

-- AlterTable
ALTER TABLE "holidays" ALTER COLUMN "school_id" SET NOT NULL,
ALTER COLUMN "school_id" SET DEFAULT app.current_school_id();

-- AlterTable
ALTER TABLE "levels" ALTER COLUMN "school_id" SET NOT NULL,
ALTER COLUMN "school_id" SET DEFAULT app.current_school_id();

-- AlterTable
ALTER TABLE "marks" ALTER COLUMN "school_id" SET NOT NULL,
ALTER COLUMN "school_id" SET DEFAULT app.current_school_id();

-- AlterTable
ALTER TABLE "marksheet_bundles" ALTER COLUMN "school_id" SET DEFAULT app.current_school_id();

-- AlterTable
ALTER TABLE "marksheet_files" ALTER COLUMN "school_id" SET DEFAULT app.current_school_id();

-- AlterTable
ALTER TABLE "notices" ALTER COLUMN "school_id" SET NOT NULL,
ALTER COLUMN "school_id" SET DEFAULT app.current_school_id();

-- AlterTable
ALTER TABLE "sms_logs" ALTER COLUMN "school_id" SET NOT NULL,
ALTER COLUMN "school_id" SET DEFAULT app.current_school_id();

-- AlterTable
ALTER TABLE "ssc_reg" ALTER COLUMN "school_id" SET NOT NULL,
ALTER COLUMN "school_id" SET DEFAULT app.current_school_id();

-- AlterTable
ALTER TABLE "staffs" ALTER COLUMN "school_id" SET NOT NULL,
ALTER COLUMN "school_id" SET DEFAULT app.current_school_id();

-- AlterTable
ALTER TABLE "student_enrollments" ALTER COLUMN "school_id" SET NOT NULL,
ALTER COLUMN "school_id" SET DEFAULT app.current_school_id();

-- AlterTable
ALTER TABLE "student_registration_class6" ALTER COLUMN "school_id" SET NOT NULL,
ALTER COLUMN "school_id" SET DEFAULT app.current_school_id();

-- AlterTable
ALTER TABLE "student_registration_class8" ALTER COLUMN "school_id" SET NOT NULL,
ALTER COLUMN "school_id" SET DEFAULT app.current_school_id();

-- AlterTable
ALTER TABLE "student_registration_ssc" ALTER COLUMN "school_id" SET NOT NULL,
ALTER COLUMN "school_id" SET DEFAULT app.current_school_id();

-- AlterTable
ALTER TABLE "students" ALTER COLUMN "school_id" SET NOT NULL,
ALTER COLUMN "school_id" SET DEFAULT app.current_school_id();

-- AlterTable
ALTER TABLE "subjects" ALTER COLUMN "school_id" SET NOT NULL,
ALTER COLUMN "school_id" SET DEFAULT app.current_school_id();

-- AlterTable
ALTER TABLE "syllabus" ALTER COLUMN "school_id" SET NOT NULL,
ALTER COLUMN "school_id" SET DEFAULT app.current_school_id();

-- AlterTable
ALTER TABLE "teachers" ALTER COLUMN "school_id" SET NOT NULL,
ALTER COLUMN "school_id" SET DEFAULT app.current_school_id();

-- AddForeignKey
ALTER TABLE "admin" ADD CONSTRAINT "admin_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendence" ADD CONSTRAINT "attendence_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_class_stats" ADD CONSTRAINT "exam_class_stats_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marksheet_files" ADD CONSTRAINT "marksheet_files_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marksheet_bundles" ADD CONSTRAINT "marksheet_bundles_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staffs" ADD CONSTRAINT "staffs_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "levels" ADD CONSTRAINT "levels_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marks" ADD CONSTRAINT "marks_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gallery" ADD CONSTRAINT "gallery_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notices" ADD CONSTRAINT "notices_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission" ADD CONSTRAINT "admission_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "syllabus" ADD CONSTRAINT "syllabus_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_slot_time" ADD CONSTRAINT "class_slot_time_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_routine" ADD CONSTRAINT "class_routine_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_routines" ADD CONSTRAINT "exam_routines_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_routine_pdf" ADD CONSTRAINT "class_routine_pdf_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CitizenCharter" ADD CONSTRAINT "CitizenCharter_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "head_msg" ADD CONSTRAINT "head_msg_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ssc_reg" ADD CONSTRAINT "ssc_reg_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_registration_ssc" ADD CONSTRAINT "student_registration_ssc_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_form" ADD CONSTRAINT "admission_form_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_result" ADD CONSTRAINT "admission_result_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_logs" ADD CONSTRAINT "sms_logs_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class6_reg" ADD CONSTRAINT "class6_reg_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_registration_class6" ADD CONSTRAINT "student_registration_class6_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class8_reg" ADD CONSTRAINT "class8_reg_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_registration_class8" ADD CONSTRAINT "student_registration_class8_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
