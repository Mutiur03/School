/*
  Warnings:

  - You are about to drop the column `total_cost` on the `sms_logs` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "sms_logs" DROP COLUMN "total_cost",
ADD COLUMN     "message_id" VARCHAR(100),
ADD COLUMN     "sms_count" INTEGER;
