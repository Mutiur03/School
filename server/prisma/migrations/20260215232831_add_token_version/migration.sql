-- AlterTable
ALTER TABLE "admin" ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "teachers" ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0;
