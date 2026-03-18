/*
  Warnings:

  - You are about to drop the column `department` on the `student_enrollments` table. All the data in the column will be lost.
  - You are about to drop the column `department` on the `subjects` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name,class,group,year]` on the table `subjects` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "student_enrollments_department_idx";

-- DropIndex
DROP INDEX "subjects_department_idx";

-- DropIndex
DROP INDEX "subjects_name_class_department_year_key";

-- AlterTable
ALTER TABLE "student_enrollments" RENAME COLUMN "department" TO "group";

-- AlterTable
ALTER TABLE "subjects" RENAME COLUMN "department" TO "group";

-- CreateIndex
CREATE INDEX "student_enrollments_group_idx" ON "student_enrollments"("group");

-- CreateIndex
CREATE INDEX "subjects_group_idx" ON "subjects"("group");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_name_class_group_year_key" ON "subjects"("name", "class", "group", "year");
