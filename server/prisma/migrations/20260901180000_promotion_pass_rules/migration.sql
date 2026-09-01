CREATE TABLE "promotion_pass_rules" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "class" INTEGER NOT NULL,
    "max_failed" INTEGER NOT NULL DEFAULT 0,
    "school_id" INTEGER NOT NULL DEFAULT app.current_school_id(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotion_pass_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "promotion_pass_rules_school_id_year_class_key"
  ON "promotion_pass_rules"("school_id", "year", "class");
CREATE INDEX "promotion_pass_rules_year_idx" ON "promotion_pass_rules"("year");
CREATE INDEX "promotion_pass_rules_school_id_idx" ON "promotion_pass_rules"("school_id");

ALTER TABLE "promotion_pass_rules"
  ADD CONSTRAINT "promotion_pass_rules_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$
BEGIN
  CREATE TRIGGER trg_promotion_pass_rules_set_school_id
    BEFORE INSERT ON public.promotion_pass_rules
    FOR EACH ROW EXECUTE FUNCTION app.set_school_id_from_rls_context();

  ALTER TABLE public.promotion_pass_rules ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.promotion_pass_rules FORCE ROW LEVEL SECURITY;

  CREATE POLICY rls_promotion_pass_rules_select ON public.promotion_pass_rules
    FOR SELECT USING (app.is_super_admin() OR school_id = app.current_school_id());
  CREATE POLICY rls_promotion_pass_rules_insert ON public.promotion_pass_rules
    FOR INSERT WITH CHECK (app.is_super_admin() OR school_id = app.current_school_id());
  CREATE POLICY rls_promotion_pass_rules_update ON public.promotion_pass_rules
    FOR UPDATE USING (app.is_super_admin() OR school_id = app.current_school_id())
    WITH CHECK (app.is_super_admin() OR school_id = app.current_school_id());
  CREATE POLICY rls_promotion_pass_rules_delete ON public.promotion_pass_rules
    FOR DELETE USING (app.is_super_admin() OR school_id = app.current_school_id());
END $$;
