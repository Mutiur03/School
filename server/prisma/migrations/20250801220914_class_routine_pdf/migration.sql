-- CreateTable
CREATE TABLE "class_routine_pdf" (
    "id" SERIAL NOT NULL,
    "pdf_url" TEXT NOT NULL,
    "download_url" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_routine_pdf_pkey" PRIMARY KEY ("id")
);
