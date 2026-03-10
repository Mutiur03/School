/*
  Warnings:

  - A unique constraint covering the columns `[tokenHash]` on the table `setupToken` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "setupToken_tokenHash_key" ON "setupToken"("tokenHash");
