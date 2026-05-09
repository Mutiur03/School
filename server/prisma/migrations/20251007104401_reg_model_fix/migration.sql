/*
  Warnings:

  - You are about to drop the column `approved_at` on the `student_registration_ssc` table. All the data in the column will be lost.
  - You are about to drop the column `approved_by` on the `student_registration_ssc` table. All the data in the column will be lost.
  - You are about to drop the column `rejection_reason` on the `student_registration_ssc` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "student_registration_ssc" DROP COLUMN "approved_at",
DROP COLUMN "approved_by",
DROP COLUMN "rejection_reason";
