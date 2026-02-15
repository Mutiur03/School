/*
  Warnings:

  - You are about to drop the column `blood_group` on the `student_registration_class6` table. All the data in the column will be lost.
  - You are about to drop the column `student_nick_name_bn` on the `student_registration_class6` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "student_registration_class6" DROP COLUMN "blood_group",
DROP COLUMN "student_nick_name_bn";
