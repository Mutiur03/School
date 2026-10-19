-- Last promotion / graduation run per school + session year (when and by whom), shown on the promotion page.
CREATE TABLE "promotion_runs" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "ran_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ran_by" VARCHAR(100),
    "school_id" INTEGER NOT NULL DEFAULT app.current_school_id(),

    CONSTRAINT "promotion_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "promotion_runs_school_id_year_kind_key"
  ON "promotion_runs"("school_id", "year", "kind");
CREATE INDEX "promotion_runs_school_id_idx" ON "promotion_runs"("school_id");

ALTER TABLE "promotion_runs"
  ADD CONSTRAINT "promotion_runs_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$
BEGIN
  CREATE TRIGGER trg_promotion_runs_set_school_id
    BEFORE INSERT ON public.promotion_runs
    FOR EACH ROW EXECUTE FUNCTION app.set_school_id_from_rls_context();

  ALTER TABLE public.promotion_runs ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.promotion_runs FORCE ROW LEVEL SECURITY;

  CREATE POLICY rls_promotion_runs_select ON public.promotion_runs
    FOR SELECT USING (app.is_super_admin() OR school_id = app.current_school_id());
  CREATE POLICY rls_promotion_runs_insert ON public.promotion_runs
    FOR INSERT WITH CHECK (app.is_super_admin() OR school_id = app.current_school_id());
  CREATE POLICY rls_promotion_runs_update ON public.promotion_runs
    FOR UPDATE USING (app.is_super_admin() OR school_id = app.current_school_id())
    WITH CHECK (app.is_super_admin() OR school_id = app.current_school_id());
  CREATE POLICY rls_promotion_runs_delete ON public.promotion_runs
    FOR DELETE USING (app.is_super_admin() OR school_id = app.current_school_id());
END $$;
