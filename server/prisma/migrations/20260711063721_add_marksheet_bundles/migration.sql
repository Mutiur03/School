-- CreateTable
CREATE TABLE "marksheet_bundles" (
    "id" SERIAL NOT NULL,
    "exam_id" INTEGER NOT NULL,
    "exam_name" VARCHAR(100) NOT NULL,
    "year" INTEGER NOT NULL,
    "class" INTEGER NOT NULL,
    "section" VARCHAR(20) NOT NULL DEFAULT 'ALL',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "r2_key" TEXT,
    "input_hash" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "generated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "school_id" INTEGER NOT NULL,

    CONSTRAINT "marksheet_bundles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "marksheet_bundles_exam_id_status_idx" ON "marksheet_bundles"("exam_id", "status");

-- CreateIndex
CREATE INDEX "marksheet_bundles_school_id_idx" ON "marksheet_bundles"("school_id");

-- CreateIndex
CREATE UNIQUE INDEX "marksheet_bundles_exam_id_class_section_key" ON "marksheet_bundles"("exam_id", "class", "section");

-- AddForeignKey
ALTER TABLE "marksheet_bundles" ADD CONSTRAINT "marksheet_bundles_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
