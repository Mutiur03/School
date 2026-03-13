-- AlterTable
ALTER TABLE "subjects" ADD COLUMN     "assessment_type" TEXT NOT NULL DEFAULT 'exam',
ADD COLUMN     "include_in_result" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "parent_id" INTEGER,
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "subject_type" TEXT NOT NULL DEFAULT 'single';

-- CreateIndex
CREATE INDEX "subjects_parent_id_idx" ON "subjects"("parent_id");

-- CreateIndex
CREATE INDEX "subjects_priority_idx" ON "subjects"("priority");

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
