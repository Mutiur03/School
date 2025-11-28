/*
  Warnings:

  - You are about to drop the column `user_id` on the `admission` table. All the data in the column will be lost.
  - You are about to drop the column `father_profession_other` on the `admission_form` table. All the data in the column will be lost.
  - You are about to drop the column `mother_profession_other` on the `admission_form` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "admission" DROP COLUMN "user_id",
ADD COLUMN     "user_id_class6" TEXT,
ADD COLUMN     "user_id_class7" TEXT,
ADD COLUMN     "user_id_class8" TEXT,
ADD COLUMN     "user_id_class9" TEXT;

-- AlterTable
ALTER TABLE "admission_form" DROP COLUMN "father_profession_other",
DROP COLUMN "mother_profession_other";
