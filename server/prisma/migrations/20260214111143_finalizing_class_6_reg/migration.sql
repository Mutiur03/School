/*
  Warnings:

  - You are about to drop the column `photo_path` on the `student_registration_class6` table. All the data in the column will be lost.
  - You are about to drop the column `sorkari_brirti` on the `student_registration_class6` table. All the data in the column will be lost.
  - Added the required column `photo` to the `student_registration_class6` table without a default value. This is not possible if the table is not empty.
  - Made the column `class6_year` on table `student_registration_class6` required. This step will fail if there are existing NULL values in that column.
  - Made the column `section` on table `student_registration_class6` required. This step will fail if there are existing NULL values in that column.
  - Made the column `roll` on table `student_registration_class6` required. This step will fail if there are existing NULL values in that column.
  - Made the column `religion` on table `student_registration_class6` required. This step will fail if there are existing NULL values in that column.
  - Made the column `student_name_bn` on table `student_registration_class6` required. This step will fail if there are existing NULL values in that column.
  - Made the column `student_nick_name_bn` on table `student_registration_class6` required. This step will fail if there are existing NULL values in that column.
  - Made the column `student_name_en` on table `student_registration_class6` required. This step will fail if there are existing NULL values in that column.
  - Made the column `birth_reg_no` on table `student_registration_class6` required. This step will fail if there are existing NULL values in that column.
  - Made the column `father_name_bn` on table `student_registration_class6` required. This step will fail if there are existing NULL values in that column.
  - Made the column `father_name_en` on table `student_registration_class6` required. This step will fail if there are existing NULL values in that column.
  - Made the column `mother_name_bn` on table `student_registration_class6` required. This step will fail if there are existing NULL values in that column.
  - Made the column `mother_name_en` on table `student_registration_class6` required. This step will fail if there are existing NULL values in that column.
  - Made the column `birth_date` on table `student_registration_class6` required. This step will fail if there are existing NULL values in that column.
  - Made the column `birth_year` on table `student_registration_class6` required. This step will fail if there are existing NULL values in that column.
  - Made the column `birth_month` on table `student_registration_class6` required. This step will fail if there are existing NULL values in that column.
  - Made the column `birth_day` on table `student_registration_class6` required. This step will fail if there are existing NULL values in that column.
  - Made the column `present_district` on table `student_registration_class6` required. This step will fail if there are existing NULL values in that column.
  - Made the column `present_upazila` on table `student_registration_class6` required. This step will fail if there are existing NULL values in that column.
  - Made the column `present_post_office` on table `student_registration_class6` required. This step will fail if there are existing NULL values in that column.
  - Made the column `present_post_code` on table `student_registration_class6` required. This step will fail if there are existing NULL values in that column.
  - Made the column `present_village_road` on table `student_registration_class6` required. This step will fail if there are existing NULL values in that column.
  - Made the column `permanent_district` on table `student_registration_class6` required. This step will fail if there are existing NULL values in that column.
  - Made the column `permanent_upazila` on table `student_registration_class6` required. This step will fail if there are existing NULL values in that column.
  - Made the column `permanent_post_office` on table `student_registration_class6` required. This step will fail if there are existing NULL values in that column.
  - Made the column `permanent_post_code` on table `student_registration_class6` required. This step will fail if there are existing NULL values in that column.
  - Made the column `permanent_village_road` on table `student_registration_class6` required. This step will fail if there are existing NULL values in that column.
  - Made the column `prev_school_name` on table `student_registration_class6` required. This step will fail if there are existing NULL values in that column.
  - Made the column `prev_school_district` on table `student_registration_class6` required. This step will fail if there are existing NULL values in that column.
  - Made the column `prev_school_upazila` on table `student_registration_class6` required. This step will fail if there are existing NULL values in that column.
  - Made the column `status` on table `student_registration_class6` required. This step will fail if there are existing NULL values in that column.
  - Made the column `submission_date` on table `student_registration_class6` required. This step will fail if there are existing NULL values in that column.
  - Made the column `prev_school_passing_year` on table `student_registration_class6` required. This step will fail if there are existing NULL values in that column.
  - Made the column `roll_in_prev_school` on table `student_registration_class6` required. This step will fail if there are existing NULL values in that column.
  - Made the column `section_in_prev_school` on table `student_registration_class6` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "student_registration_class6" DROP COLUMN "photo_path",
DROP COLUMN "sorkari_brirti",
ADD COLUMN     "photo" VARCHAR(255) NOT NULL,
ALTER COLUMN "class6_year" SET NOT NULL,
ALTER COLUMN "section" SET NOT NULL,
ALTER COLUMN "roll" SET NOT NULL,
ALTER COLUMN "religion" SET NOT NULL,
ALTER COLUMN "student_name_bn" SET NOT NULL,
ALTER COLUMN "student_nick_name_bn" SET NOT NULL,
ALTER COLUMN "student_name_en" SET NOT NULL,
ALTER COLUMN "birth_reg_no" SET NOT NULL,
ALTER COLUMN "father_name_bn" SET NOT NULL,
ALTER COLUMN "father_name_en" SET NOT NULL,
ALTER COLUMN "mother_name_bn" SET NOT NULL,
ALTER COLUMN "mother_name_en" SET NOT NULL,
ALTER COLUMN "birth_date" SET NOT NULL,
ALTER COLUMN "birth_year" SET NOT NULL,
ALTER COLUMN "birth_month" SET NOT NULL,
ALTER COLUMN "birth_day" SET NOT NULL,
ALTER COLUMN "present_district" SET NOT NULL,
ALTER COLUMN "present_upazila" SET NOT NULL,
ALTER COLUMN "present_post_office" SET NOT NULL,
ALTER COLUMN "present_post_code" SET NOT NULL,
ALTER COLUMN "present_village_road" SET NOT NULL,
ALTER COLUMN "permanent_district" SET NOT NULL,
ALTER COLUMN "permanent_upazila" SET NOT NULL,
ALTER COLUMN "permanent_post_office" SET NOT NULL,
ALTER COLUMN "permanent_post_code" SET NOT NULL,
ALTER COLUMN "permanent_village_road" SET NOT NULL,
ALTER COLUMN "prev_school_name" SET NOT NULL,
ALTER COLUMN "prev_school_district" SET NOT NULL,
ALTER COLUMN "prev_school_upazila" SET NOT NULL,
ALTER COLUMN "status" SET NOT NULL,
ALTER COLUMN "submission_date" SET NOT NULL,
ALTER COLUMN "prev_school_passing_year" SET NOT NULL,
ALTER COLUMN "roll_in_prev_school" SET NOT NULL,
ALTER COLUMN "section_in_prev_school" SET NOT NULL;
