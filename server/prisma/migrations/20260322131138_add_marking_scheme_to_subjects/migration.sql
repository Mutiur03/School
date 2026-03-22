-- CreateEnum
CREATE TYPE "MarkingScheme" AS ENUM ('TOTAL', 'BREAKDOWN');

-- AlterTable
ALTER TABLE "subjects" ADD COLUMN     "marking_scheme" "MarkingScheme" NOT NULL DEFAULT 'TOTAL';
