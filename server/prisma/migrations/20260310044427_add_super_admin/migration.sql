-- CreateEnum
CREATE TYPE "SetupTokenRole" AS ENUM ('super_admin', 'admin');

-- CreateTable
CREATE TABLE "setupToken" (
    "id" SERIAL NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "role" "SetupTokenRole" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "setupToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuperAdmin" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'super_admin',
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SuperAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "setupToken_role_tokenHash_idx" ON "setupToken"("role", "tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "SuperAdmin_email_key" ON "SuperAdmin"("email");

-- CreateIndex
CREATE INDEX "SuperAdmin_email_idx" ON "SuperAdmin"("email");

-- CreateIndex
CREATE INDEX "SuperAdmin_role_idx" ON "SuperAdmin"("role");
