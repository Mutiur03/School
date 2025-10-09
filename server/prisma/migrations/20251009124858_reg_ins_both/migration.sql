/*
  Warnings:

  - You are about to drop the column `instructions` on the `ssc_reg` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ssc_reg" DROP COLUMN "instructions",
ADD COLUMN     "instruction_for_a" TEXT DEFAULT 'Please follow the instructions carefully',
ADD COLUMN     "instruction_for_b" TEXT DEFAULT 'Please follow the instructions carefully';
