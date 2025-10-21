-- CreateTable
CREATE TABLE "syllabus" (
    "id" SERIAL NOT NULL,
    "class" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "pdf_url" TEXT NOT NULL,
    "download_url" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "syllabus_pkey" PRIMARY KEY ("id")
);
