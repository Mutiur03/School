-- CreateTable
CREATE TABLE "marksheet_files" (
    "id" SERIAL NOT NULL,
    "student_id" INTEGER NOT NULL,
    "exam_id" INTEGER NOT NULL,
    "exam_name" VARCHAR(100) NOT NULL,
    "year" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "r2_key" TEXT,
    "input_hash" TEXT,
    "student_name" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "generated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "school_id" INTEGER NOT NULL,

    CONSTRAINT "marksheet_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "marksheet_files_exam_id_status_idx" ON "marksheet_files"("exam_id", "status");

-- CreateIndex
CREATE INDEX "marksheet_files_school_id_idx" ON "marksheet_files"("school_id");

-- CreateIndex
CREATE INDEX "marksheet_files_status_idx" ON "marksheet_files"("status");

-- CreateIndex
CREATE UNIQUE INDEX "marksheet_files_student_id_exam_id_key" ON "marksheet_files"("student_id", "exam_id");

-- AddForeignKey
ALTER TABLE "marksheet_files" ADD CONSTRAINT "marksheet_files_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "unique_exam_class_stats" RENAME TO "exam_class_stats_exam_id_class_year_school_id_key";
