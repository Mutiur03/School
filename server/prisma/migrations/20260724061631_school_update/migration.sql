/*
  Warnings:

  - You are about to drop the `school_site_configs` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "school_site_configs" DROP CONSTRAINT "school_site_configs_school_id_fkey";

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "academic_profile" JSONB,
ADD COLUMN     "descriptions" JSONB,
ADD COLUMN     "ga_measurement_id" VARCHAR(50),
ADD COLUMN     "home_charts" JSONB,
ADD COLUMN     "identifiers_extra" JSONB,
ADD COLUMN     "menu_items" JSONB,
ADD COLUMN     "seo" JSONB,
ADD COLUMN     "sidebar_config" JSONB,
ADD COLUMN     "theme" JSONB;

-- DropTable
DROP TABLE "school_site_configs";
