/*
  Warnings:

  - Added the required column `public_id` to the `events` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "events" ADD COLUMN     "public_id" TEXT NOT NULL;
