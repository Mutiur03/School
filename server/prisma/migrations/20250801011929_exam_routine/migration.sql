-- CreateTable
CREATE TABLE "exam_routines" (
    "id" SERIAL NOT NULL,
    "exam_id" INTEGER NOT NULL,
    "class" INTEGER NOT NULL,
    "date" VARCHAR(10) NOT NULL,
    "day" VARCHAR(10) NOT NULL,
    "subject" VARCHAR(100) NOT NULL,
    "time" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_routines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exam_routines_exam_id_class_idx" ON "exam_routines"("exam_id", "class");

-- AddForeignKey
ALTER TABLE "exam_routines" ADD CONSTRAINT "exam_routines_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
