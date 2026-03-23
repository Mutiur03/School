/*
  Warnings:

  - You are about to drop the `gpa` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "gpa" DROP CONSTRAINT "gpa_student_id_fkey";

-- DropTable
DROP TABLE "gpa";
