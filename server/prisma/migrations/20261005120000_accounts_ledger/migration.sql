CREATE TYPE "AccHeadType" AS ENUM ('asset', 'liability', 'equity', 'income', 'expense');
CREATE TYPE "VoucherType" AS ENUM ('receipt', 'payment', 'contra', 'journal');

CREATE TABLE "acc_heads" (
  "id" SERIAL NOT NULL,
  "school_id" INTEGER NOT NULL DEFAULT app.current_school_id(),
  "code" VARCHAR(20),
  "name" VARCHAR(150) NOT NULL,
  "type" "AccHeadType" NOT NULL,
  "parent_id" INTEGER,
  "is_cash_bank" BOOLEAN NOT NULL DEFAULT false,
  "bank_name" VARCHAR(150),
  "account_no" VARCHAR(50),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "acc_heads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "acc_cost_centers" (
  "id" SERIAL NOT NULL,
  "school_id" INTEGER NOT NULL DEFAULT app.current_school_id(),
  "name" VARCHAR(150) NOT NULL,
  "code" VARCHAR(20),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "acc_cost_centers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "acc_vouchers" (
  "id" SERIAL NOT NULL,
  "school_id" INTEGER NOT NULL DEFAULT app.current_school_id(),
  "type" "VoucherType" NOT NULL,
  "date" DATE NOT NULL,
  "narration" TEXT,
  "reference" VARCHAR(100),
  "created_by" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "acc_vouchers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "acc_voucher_lines" (
  "id" SERIAL NOT NULL,
  "school_id" INTEGER NOT NULL DEFAULT app.current_school_id(),
  "voucher_id" INTEGER NOT NULL,
  "head_id" INTEGER NOT NULL,
  "cost_center_id" INTEGER,
  "debit" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "credit" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "note" VARCHAR(255),
  CONSTRAINT "acc_voucher_lines_pkey" PRIMARY KEY ("id"),
  -- Exactly one side carries a positive amount.
  CONSTRAINT "acc_voucher_lines_one_side" CHECK (debit >= 0 AND credit >= 0 AND (debit = 0) <> (credit = 0))
);

CREATE UNIQUE INDEX "acc_heads_school_id_name_key" ON "acc_heads"("school_id", "name");
CREATE INDEX "acc_heads_school_id_idx" ON "acc_heads"("school_id");
CREATE INDEX "acc_heads_parent_id_idx" ON "acc_heads"("parent_id");
CREATE UNIQUE INDEX "acc_cost_centers_school_id_name_key" ON "acc_cost_centers"("school_id", "name");
CREATE INDEX "acc_cost_centers_school_id_idx" ON "acc_cost_centers"("school_id");
CREATE INDEX "acc_vouchers_school_id_date_idx" ON "acc_vouchers"("school_id", "date");
CREATE INDEX "acc_vouchers_school_id_type_idx" ON "acc_vouchers"("school_id", "type");
CREATE INDEX "acc_voucher_lines_school_id_head_id_idx" ON "acc_voucher_lines"("school_id", "head_id");
CREATE INDEX "acc_voucher_lines_voucher_id_idx" ON "acc_voucher_lines"("voucher_id");
CREATE INDEX "acc_voucher_lines_cost_center_id_idx" ON "acc_voucher_lines"("cost_center_id");

ALTER TABLE "acc_heads" ADD CONSTRAINT "acc_heads_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "acc_heads" ADD CONSTRAINT "acc_heads_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "acc_heads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "acc_cost_centers" ADD CONSTRAINT "acc_cost_centers_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "acc_vouchers" ADD CONSTRAINT "acc_vouchers_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "acc_voucher_lines" ADD CONSTRAINT "acc_voucher_lines_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "acc_voucher_lines" ADD CONSTRAINT "acc_voucher_lines_voucher_id_fkey"
  FOREIGN KEY ("voucher_id") REFERENCES "acc_vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "acc_voucher_lines" ADD CONSTRAINT "acc_voucher_lines_head_id_fkey"
  FOREIGN KEY ("head_id") REFERENCES "acc_heads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "acc_voucher_lines" ADD CONSTRAINT "acc_voucher_lines_cost_center_id_fkey"
  FOREIGN KEY ("cost_center_id") REFERENCES "acc_cost_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['acc_heads', 'acc_cost_centers', 'acc_vouchers', 'acc_voucher_lines'] LOOP
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
