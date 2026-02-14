/*
  Warnings:

  - Changed the type of `class6_year` on the `student_registration_class6` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "student_registration_class6" DROP COLUMN "class6_year",
ADD COLUMN     "class6_year" INTEGER NOT NULL;
