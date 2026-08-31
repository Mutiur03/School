-- Drop unused School JSON columns (sidebar/menu/charts/theme never read; identifiers_extra unused).
ALTER TABLE "School" DROP COLUMN IF EXISTS "identifiers_extra";
ALTER TABLE "School" DROP COLUMN IF EXISTS "sidebar_config";
ALTER TABLE "School" DROP COLUMN IF EXISTS "menu_items";
ALTER TABLE "School" DROP COLUMN IF EXISTS "home_charts";
ALTER TABLE "School" DROP COLUMN IF EXISTS "theme";
