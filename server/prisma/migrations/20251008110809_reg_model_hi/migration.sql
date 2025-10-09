/*
  Warnings:

  - You are about to drop the column `guardian_address_same_as_permanent` on the `student_registration_ssc` table. All the data in the column will be lost.
  - You are about to drop the column `photo_public_id` on the `student_registration_ssc` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ssc_reg" ADD COLUMN     "reg_open" BOOLEAN DEFAULT false;

-- AlterTable
ALTER TABLE "student_registration_ssc" DROP COLUMN "guardian_address_same_as_permanent",
DROP COLUMN "photo_public_id";
