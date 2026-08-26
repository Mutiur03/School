/*
  Warnings:

  - A unique constraint covering the columns `[school_id,class6_year,section,roll]` on the table `student_registration_class6` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[school_id,class6_year,birth_reg_no]` on the table `student_registration_class6` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[school_id,class8_year,section,roll]` on the table `student_registration_class8` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[school_id,class8_year,birth_reg_no]` on the table `student_registration_class8` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[school_id,ssc_batch,section,roll]` on the table `student_registration_ssc` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[school_id,ssc_batch,birth_reg_no]` on the table `student_registration_ssc` will be added. If there are existing duplicate values, this will fail.
  - Made the column `class6_year` on table `class6_reg` required. This step will fail if there are existing NULL values in that column.
  - Made the column `class8_year` on table `class8_reg` required. This step will fail if there are existing NULL values in that column.
  - Made the column `ssc_year` on table `ssc_reg` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "class6_reg" ALTER COLUMN "class6_year" SET NOT NULL;

-- AlterTable
ALTER TABLE "class8_reg" ALTER COLUMN "class8_year" SET NOT NULL;

-- AlterTable
ALTER TABLE "ssc_reg" ALTER COLUMN "ssc_year" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "student_registration_class6_school_year_section_roll_key" ON "student_registration_class6"("school_id", "class6_year", "section", "roll");

-- CreateIndex
CREATE UNIQUE INDEX "student_registration_class6_school_year_birth_reg_key" ON "student_registration_class6"("school_id", "class6_year", "birth_reg_no");

-- CreateIndex
CREATE UNIQUE INDEX "student_registration_class8_school_year_section_roll_key" ON "student_registration_class8"("school_id", "class8_year", "section", "roll");

-- CreateIndex
CREATE UNIQUE INDEX "student_registration_class8_school_year_birth_reg_key" ON "student_registration_class8"("school_id", "class8_year", "birth_reg_no");

-- CreateIndex
CREATE UNIQUE INDEX "student_registration_ssc_school_year_section_roll_key" ON "student_registration_ssc"("school_id", "ssc_batch", "section", "roll");

-- CreateIndex
CREATE UNIQUE INDEX "student_registration_ssc_school_year_birth_reg_key" ON "student_registration_ssc"("school_id", "ssc_batch", "birth_reg_no");
