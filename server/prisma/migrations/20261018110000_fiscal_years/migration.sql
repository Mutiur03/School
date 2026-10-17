-- Year-end closing: a closed year is a row in acc_years (delete it to reopen); its closing voucher
-- zeroes income/expense into equity and is flagged so P&L reports can leave it out.

ALTER TABLE "acc_vouchers" ADD COLUMN "is_closing" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "acc_years" (
  "id" SERIAL NOT NULL,
  "school_id" INTEGER NOT NULL DEFAULT app.current_school_id(),
  "year" INTEGER NOT NULL,
  "closed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closing_voucher_id" INTEGER,
  CONSTRAINT "acc_years_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "acc_years_closing_voucher_id_key" ON "acc_years"("closing_voucher_id");
CREATE UNIQUE INDEX "acc_years_school_id_year_key" ON "acc_years"("school_id", "year");
CREATE INDEX "acc_years_school_id_idx" ON "acc_years"("school_id");

ALTER TABLE "acc_years" ADD CONSTRAINT "acc_years_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "acc_years" ADD CONSTRAINT "acc_years_closing_voucher_id_fkey"
  FOREIGN KEY ("closing_voucher_id") REFERENCES "acc_vouchers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['acc_years'] LOOP
    EXECUTE format('CREATE TRIGGER trg_%1$s_set_school_id BEFORE INSERT ON public.%1$I
      FOR EACH ROW EXECUTE FUNCTION app.set_school_id_from_rls_context()', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY rls_%1$s_select ON public.%1$I
      FOR SELECT USING (app.is_super_admin() OR school_id = app.current_school_id())', t);
    EXECUTE format('CREATE POLICY rls_%1$s_insert ON public.%1$I
      FOR INSERT WITH CHECK (app.is_super_admin() OR school_id = app.current_school_id())', t);
    EXECUTE format('CREATE POLICY rls_%1$s_update ON public.%1$I
      FOR UPDATE USING (app.is_super_admin() OR school_id = app.current_school_id())
      WITH CHECK (app.is_super_admin() OR school_id = app.current_school_id())', t);
    EXECUTE format('CREATE POLICY rls_%1$s_delete ON public.%1$I
      FOR DELETE USING (app.is_super_admin() OR school_id = app.current_school_id())', t);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'school_app') THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO school_app', t);
      EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE public.%I TO school_app', t || '_id_seq');
    END IF;
  END LOOP;
END $$;
