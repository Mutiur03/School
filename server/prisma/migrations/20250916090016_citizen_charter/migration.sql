-- CreateTable
CREATE TABLE "CitizenCharter" (
    "id" SERIAL NOT NULL,
    "file" TEXT NOT NULL,
    "download_url" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CitizenCharter_pkey" PRIMARY KEY ("id")
);
