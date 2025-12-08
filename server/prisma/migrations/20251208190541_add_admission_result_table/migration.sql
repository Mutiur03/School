-- CreateTable
CREATE TABLE "admission_result" (
    "id" SERIAL NOT NULL,
    "class_name" VARCHAR(10) NOT NULL,
    "admission_year" INTEGER NOT NULL,
    "merit_list" TEXT,
    "merit_list_public_id" TEXT,
    "waiting_list_1" TEXT,
    "waiting_list_1_public_id" TEXT,
    "waiting_list_2" TEXT,
    "waiting_list_2_public_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admission_result_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admission_result_class_name_idx" ON "admission_result"("class_name");

-- CreateIndex
CREATE INDEX "admission_result_admission_year_idx" ON "admission_result"("admission_year");
