-- CreateTable
CREATE TABLE "admission" (
    "id" SERIAL NOT NULL,
    "preview_url" TEXT NOT NULL,
    "download_url" TEXT,
    "public_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admission_pkey" PRIMARY KEY ("id")
);
