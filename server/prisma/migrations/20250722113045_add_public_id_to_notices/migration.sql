/*
  Warnings:

  - Added the required column `public_id` to the `notices` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "notices" ADD COLUMN     "public_id" TEXT NOT NULL;
