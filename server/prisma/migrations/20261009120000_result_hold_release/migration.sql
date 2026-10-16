-- AlterTable
ALTER TABLE "student_enrollments" ADD COLUMN     "release_batch" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "result_held" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "result_released_at" TIMESTAMP(3);
