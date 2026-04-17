/*
  Warnings:

  - A unique constraint covering the columns `[school_id,category]` on the table `categories` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "categories_category_key";

-- CreateIndex
CREATE UNIQUE INDEX "categories_school_id_category_key" ON "categories"("school_id", "category");
