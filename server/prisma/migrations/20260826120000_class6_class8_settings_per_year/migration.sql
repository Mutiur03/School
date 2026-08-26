DROP INDEX IF EXISTS "class6_reg_school_id_key";
DROP INDEX IF EXISTS "class8_reg_school_id_key";

CREATE UNIQUE INDEX "class6_reg_school_id_class6_year_key" ON "class6_reg"("school_id", "class6_year");
CREATE UNIQUE INDEX "class8_reg_school_id_class8_year_key" ON "class8_reg"("school_id", "class8_year");
