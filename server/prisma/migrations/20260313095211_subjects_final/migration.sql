/*
  Warnings:

  - You are about to drop the column `include_in_result` on the `subjects` table. All the data in the column will be lost.
  - You are about to drop the column `teacher_id` on the `subjects` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "subjects_teacher_id_idx";

-- AlterTable
ALTER TABLE "subjects" DROP COLUMN "include_in_result",
DROP COLUMN "teacher_id";
