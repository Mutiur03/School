/*
  Warnings:

  - A unique constraint covering the columns `[class,slot_id,day,school_id]` on the table `class_routine` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name,class,group,year,school_id]` on the table `subjects` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "SchoolDomainKind" AS ENUM ('SUBDOMAIN', 'CUSTOM', 'PREVIEW');

-- DropIndex
DROP INDEX "class_routine_class_slot_id_day_key";

-- DropIndex
DROP INDEX "subjects_name_class_group_year_key";

-- AlterTable
ALTER TABLE "CitizenCharter" ADD COLUMN     "school_id" INTEGER;

-- AlterTable
ALTER TABLE "admin" ADD COLUMN     "school_id" INTEGER;

-- AlterTable
ALTER TABLE "admission" ADD COLUMN     "school_id" INTEGER;

-- AlterTable
ALTER TABLE "admission_form" ADD COLUMN     "school_id" INTEGER;

-- AlterTable
ALTER TABLE "admission_result" ADD COLUMN     "school_id" INTEGER;

-- AlterTable
ALTER TABLE "attendence" ADD COLUMN     "school_id" INTEGER;

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "school_id" INTEGER;

-- AlterTable
ALTER TABLE "class6_reg" ADD COLUMN     "school_id" INTEGER;

-- AlterTable
ALTER TABLE "class8_reg" ADD COLUMN     "school_id" INTEGER;

-- AlterTable
ALTER TABLE "class_routine" ADD COLUMN     "school_id" INTEGER;

-- AlterTable
ALTER TABLE "class_routine_pdf" ADD COLUMN     "school_id" INTEGER;

-- AlterTable
ALTER TABLE "class_slot_time" ADD COLUMN     "school_id" INTEGER;

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "school_id" INTEGER;

-- AlterTable
ALTER TABLE "exam_routines" ADD COLUMN     "school_id" INTEGER;

-- AlterTable
ALTER TABLE "exams" ADD COLUMN     "school_id" INTEGER;

-- AlterTable
ALTER TABLE "gallery" ADD COLUMN     "school_id" INTEGER;

-- AlterTable
ALTER TABLE "head_msg" ADD COLUMN     "school_id" INTEGER;

-- AlterTable
ALTER TABLE "holidays" ADD COLUMN     "school_id" INTEGER;

-- AlterTable
ALTER TABLE "levels" ADD COLUMN     "school_id" INTEGER;

-- AlterTable
ALTER TABLE "marks" ADD COLUMN     "school_id" INTEGER;

-- AlterTable
ALTER TABLE "notices" ADD COLUMN     "school_id" INTEGER;

-- AlterTable
ALTER TABLE "sms_logs" ADD COLUMN     "school_id" INTEGER;

-- AlterTable
ALTER TABLE "sms_settings" ALTER COLUMN "present_template" SET DEFAULT 'Dear Parent,
Your child {student_name} (ID: {login_id}) has attended school today ({date}).
Thank you.
Head Master
{school_name}',
ALTER COLUMN "absent_template" SET DEFAULT 'Dear Parent,
Your child {student_name} (ID: {login_id}) is absent from school today ({date}).
Please contact the school office for more info.
Thank you.
{school_name}',
ALTER COLUMN "run_awayed_template" SET DEFAULT 'Dear Parent,
Your child {student_name} (ID: {login_id}) was present in the morning but has run awayed from school today ({date}).
Please check immediately.
Thank you.
{school_name}';

-- AlterTable
ALTER TABLE "ssc_reg" ADD COLUMN     "school_id" INTEGER;

-- AlterTable
ALTER TABLE "staffs" ADD COLUMN     "school_id" INTEGER;

-- AlterTable
ALTER TABLE "student_enrollments" ADD COLUMN     "school_id" INTEGER;

-- AlterTable
ALTER TABLE "student_registration_class6" ADD COLUMN     "school_id" INTEGER;

-- AlterTable
ALTER TABLE "student_registration_class8" ADD COLUMN     "school_id" INTEGER;

-- AlterTable
ALTER TABLE "student_registration_ssc" ADD COLUMN     "school_id" INTEGER;

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "school_id" INTEGER;

-- AlterTable
ALTER TABLE "subjects" ADD COLUMN     "school_id" INTEGER;

-- AlterTable
ALTER TABLE "syllabus" ADD COLUMN     "school_id" INTEGER;

-- AlterTable
ALTER TABLE "teachers" ADD COLUMN     "school_id" INTEGER;

-- CreateTable
CREATE TABLE "School" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "shortName" VARCHAR(50),
    "eiin" VARCHAR(20),
    "logo" TEXT,
    "favicon" TEXT,
    "district" VARCHAR(100),
    "upazila" VARCHAR(100),
    "phone" VARCHAR(20),
    "email" VARCHAR(100),
    "website" TEXT,
    "slogan" TEXT,
    "establishedIn" INTEGER,
    "name_bn" VARCHAR(300),
    "center_code" VARCHAR(50),
    "map_embed_url" TEXT,
    "government_logo" TEXT,
    "header_logo" TEXT,
    "banner_urls" JSONB,
    "results_url" TEXT,
    "teacher_login_url" TEXT,
    "student_login_url" TEXT,
    "address" VARCHAR(500),
    "location" VARCHAR(200),
    "nationalized_year" VARCHAR(20),
    "subdomain" VARCHAR(100),
    "customDomain" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_site_configs" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "name_bn" VARCHAR(300),
    "name_short_bn" VARCHAR(50),
    "center_code" VARCHAR(50),
    "government_logo" TEXT,
    "header_logo" TEXT,
    "banner_urls" JSONB,
    "results_url" TEXT,
    "teacher_login_url" TEXT,
    "student_login_url" TEXT,
    "address" VARCHAR(500),
    "location" VARCHAR(200),
    "nationalized_year" VARCHAR(20),
    "map_embed_url" TEXT,
    "descriptions" JSONB,
    "academic_profile" JSONB,
    "identifiers_extra" JSONB,
    "sidebar_config" JSONB,
    "menu_items" JSONB,
    "home_charts" JSONB,
    "seo" JSONB,
    "theme" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_site_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_domains" (
    "id" SERIAL NOT NULL,
    "host" VARCHAR(255) NOT NULL,
    "school_id" INTEGER NOT NULL,
    "kind" "SchoolDomainKind" NOT NULL DEFAULT 'CUSTOM',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "redirect_to_host" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_domains_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "School_eiin_key" ON "School"("eiin");

-- CreateIndex
CREATE UNIQUE INDEX "School_subdomain_key" ON "School"("subdomain");

-- CreateIndex
CREATE UNIQUE INDEX "School_customDomain_key" ON "School"("customDomain");

-- CreateIndex
CREATE INDEX "School_name_idx" ON "School"("name");

-- CreateIndex
CREATE INDEX "School_subdomain_idx" ON "School"("subdomain");

-- CreateIndex
CREATE INDEX "School_customDomain_idx" ON "School"("customDomain");

-- CreateIndex
CREATE UNIQUE INDEX "school_site_configs_school_id_key" ON "school_site_configs"("school_id");

-- CreateIndex
CREATE INDEX "school_site_configs_school_id_idx" ON "school_site_configs"("school_id");

-- CreateIndex
CREATE UNIQUE INDEX "school_domains_host_key" ON "school_domains"("host");

-- CreateIndex
CREATE INDEX "school_domains_school_id_idx" ON "school_domains"("school_id");

-- CreateIndex
CREATE INDEX "CitizenCharter_school_id_idx" ON "CitizenCharter"("school_id");

-- CreateIndex
CREATE INDEX "admin_school_id_idx" ON "admin"("school_id");

-- CreateIndex
CREATE INDEX "admission_school_id_idx" ON "admission"("school_id");

-- CreateIndex
CREATE INDEX "admission_form_school_id_idx" ON "admission_form"("school_id");

-- CreateIndex
CREATE INDEX "admission_result_school_id_idx" ON "admission_result"("school_id");

-- CreateIndex
CREATE INDEX "attendence_school_id_idx" ON "attendence"("school_id");

-- CreateIndex
CREATE INDEX "categories_school_id_idx" ON "categories"("school_id");

-- CreateIndex
CREATE INDEX "class6_reg_school_id_idx" ON "class6_reg"("school_id");

-- CreateIndex
CREATE INDEX "class8_reg_school_id_idx" ON "class8_reg"("school_id");

-- CreateIndex
CREATE INDEX "class_routine_school_id_idx" ON "class_routine"("school_id");

-- CreateIndex
CREATE UNIQUE INDEX "class_routine_class_slot_id_day_school_id_key" ON "class_routine"("class", "slot_id", "day", "school_id");

-- CreateIndex
CREATE INDEX "class_routine_pdf_school_id_idx" ON "class_routine_pdf"("school_id");

-- CreateIndex
CREATE INDEX "class_slot_time_school_id_idx" ON "class_slot_time"("school_id");

-- CreateIndex
CREATE INDEX "events_school_id_idx" ON "events"("school_id");

-- CreateIndex
CREATE INDEX "exam_routines_school_id_idx" ON "exam_routines"("school_id");

-- CreateIndex
CREATE INDEX "exams_school_id_idx" ON "exams"("school_id");

-- CreateIndex
CREATE INDEX "gallery_school_id_idx" ON "gallery"("school_id");

-- CreateIndex
CREATE INDEX "head_msg_school_id_idx" ON "head_msg"("school_id");

-- CreateIndex
CREATE INDEX "holidays_school_id_idx" ON "holidays"("school_id");

-- CreateIndex
CREATE INDEX "levels_school_id_idx" ON "levels"("school_id");

-- CreateIndex
CREATE INDEX "marks_school_id_idx" ON "marks"("school_id");

-- CreateIndex
CREATE INDEX "notices_school_id_idx" ON "notices"("school_id");

-- CreateIndex
CREATE INDEX "sms_logs_school_id_idx" ON "sms_logs"("school_id");

-- CreateIndex
CREATE INDEX "ssc_reg_school_id_idx" ON "ssc_reg"("school_id");

-- CreateIndex
CREATE INDEX "staffs_school_id_idx" ON "staffs"("school_id");

-- CreateIndex
CREATE INDEX "student_enrollments_school_id_idx" ON "student_enrollments"("school_id");

-- CreateIndex
CREATE INDEX "student_registration_class6_school_id_idx" ON "student_registration_class6"("school_id");

-- CreateIndex
CREATE INDEX "student_registration_class8_school_id_idx" ON "student_registration_class8"("school_id");

-- CreateIndex
CREATE INDEX "student_registration_ssc_school_id_idx" ON "student_registration_ssc"("school_id");

-- CreateIndex
CREATE INDEX "students_school_id_idx" ON "students"("school_id");

-- CreateIndex
CREATE INDEX "subjects_school_id_idx" ON "subjects"("school_id");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_name_class_group_year_school_id_key" ON "subjects"("name", "class", "group", "year", "school_id");

-- CreateIndex
CREATE INDEX "syllabus_school_id_idx" ON "syllabus"("school_id");

-- CreateIndex
CREATE INDEX "teachers_school_id_idx" ON "teachers"("school_id");

-- AddForeignKey
ALTER TABLE "school_site_configs" ADD CONSTRAINT "school_site_configs_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_domains" ADD CONSTRAINT "school_domains_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin" ADD CONSTRAINT "admin_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendence" ADD CONSTRAINT "attendence_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staffs" ADD CONSTRAINT "staffs_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "levels" ADD CONSTRAINT "levels_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marks" ADD CONSTRAINT "marks_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gallery" ADD CONSTRAINT "gallery_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notices" ADD CONSTRAINT "notices_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission" ADD CONSTRAINT "admission_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "syllabus" ADD CONSTRAINT "syllabus_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_slot_time" ADD CONSTRAINT "class_slot_time_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_routine" ADD CONSTRAINT "class_routine_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_routines" ADD CONSTRAINT "exam_routines_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_routine_pdf" ADD CONSTRAINT "class_routine_pdf_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CitizenCharter" ADD CONSTRAINT "CitizenCharter_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "head_msg" ADD CONSTRAINT "head_msg_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ssc_reg" ADD CONSTRAINT "ssc_reg_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_registration_ssc" ADD CONSTRAINT "student_registration_ssc_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_form" ADD CONSTRAINT "admission_form_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_result" ADD CONSTRAINT "admission_result_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_logs" ADD CONSTRAINT "sms_logs_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class6_reg" ADD CONSTRAINT "class6_reg_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_registration_class6" ADD CONSTRAINT "student_registration_class6_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class8_reg" ADD CONSTRAINT "class8_reg_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_registration_class8" ADD CONSTRAINT "student_registration_class8_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
