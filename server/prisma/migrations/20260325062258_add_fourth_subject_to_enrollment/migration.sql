-- AlterTable
ALTER TABLE "student_enrollments" ADD COLUMN     "fourth_subject_id" INTEGER;

-- AddForeignKey
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_fourth_subject_id_fkey" FOREIGN KEY ("fourth_subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
