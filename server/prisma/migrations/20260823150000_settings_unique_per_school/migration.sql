-- One settings row per school (replaces hardcoded id=1 singleton pattern).

DELETE FROM "class6_reg" a
USING "class6_reg" b
WHERE a.school_id = b.school_id AND a.id < b.id;

DELETE FROM "class8_reg" a
USING "class8_reg" b
WHERE a.school_id = b.school_id AND a.id < b.id;

DELETE FROM "ssc_reg" a
USING "ssc_reg" b
WHERE a.school_id = b.school_id AND a.id < b.id;

DELETE FROM "admission" a
USING "admission" b
WHERE a.school_id = b.school_id AND a.id < b.id;

CREATE UNIQUE INDEX "class6_reg_school_id_key" ON "class6_reg"("school_id");
CREATE UNIQUE INDEX "class8_reg_school_id_key" ON "class8_reg"("school_id");
CREATE UNIQUE INDEX "ssc_reg_school_id_key" ON "ssc_reg"("school_id");
CREATE UNIQUE INDEX "admission_school_id_key" ON "admission"("school_id");
