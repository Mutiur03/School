/*
  Warnings:

  - You are about to drop the column `academic_qualification` on the `teachers` table. All the data in the column will be lost.
  - You are about to drop the column `blood_group` on the `teachers` table. All the data in the column will be lost.
  - You are about to drop the column `dob` on the `teachers` table. All the data in the column will be lost.
  - You are about to drop the column `subject` on the `teachers` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "teachers" DROP COLUMN "academic_qualification",
DROP COLUMN "blood_group",
DROP COLUMN "dob",
DROP COLUMN "subject";
