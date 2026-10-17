CREATE TYPE "FeeFrequency" AS ENUM ('monthly', 'once');

CREATE TABLE "fee_heads" (
  "id" SERIAL NOT NULL,
  "school_id" INTEGER NOT NULL DEFAULT app.current_school_id(),
  "name" VARCHAR(100) NOT NULL,
  "frequency" "FeeFrequency" NOT NULL DEFAULT 'monthly',
  "income_head_id" INTEGER NOT NULL,
  "is_waivable" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fee_heads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fee_structures" (
  "id" SERIAL NOT NULL,
  "school_id" INTEGER NOT NULL DEFAULT app.current_school_id(),
  "year" INTEGER NOT NULL,
  "class" INTEGER NOT NULL,
  "fee_head_id" INTEGER NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  CONSTRAINT "fee_structures_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fee_structures_amount_positive" CHECK (amount > 0)
);

CREATE TABLE "fee_waivers" (
  "id" SERIAL NOT NULL,
  "school_id" INTEGER NOT NULL DEFAULT app.current_school_id(),
  "student_id" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "fee_head_id" INTEGER,
  "percent" BOOLEAN NOT NULL DEFAULT false,
  "value" DECIMAL(12,2) NOT NULL,
  "note" VARCHAR(255),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fee_waivers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fee_waivers_value_range" CHECK (value > 0 AND (NOT percent OR value <= 100))
);

CREATE TABLE "fee_receipts" (
  "id" SERIAL NOT NULL,
  "school_id" INTEGER NOT NULL DEFAULT app.current_school_id(),
  "receipt_no" INTEGER NOT NULL,
  "student_id" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "class" INTEGER NOT NULL,
  "section" CHAR(1) NOT NULL,
  "roll" INTEGER NOT NULL,
  "date" DATE NOT NULL,
  "total" DECIMAL(12,2) NOT NULL,
  "pay_head_id" INTEGER NOT NULL,
  "voucher_id" INTEGER NOT NULL,
  "note" VARCHAR(255),
  "created_by" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fee_receipts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fee_receipt_items" (
  "id" SERIAL NOT NULL,
  "school_id" INTEGER NOT NULL DEFAULT app.current_school_id(),
  "receipt_id" INTEGER NOT NULL,
  "student_id" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "fee_head_id" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "charge" DECIMAL(12,2) NOT NULL,
  "waiver" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "amount" DECIMAL(12,2) NOT NULL,
  CONSTRAINT "fee_receipt_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fee_receipt_items_month_range" CHECK (month BETWEEN 0 AND 12),
  CONSTRAINT "fee_receipt_items_amounts" CHECK (charge > 0 AND waiver >= 0 AND amount >= 0 AND amount = charge - waiver)
);

CREATE UNIQUE INDEX "fee_heads_school_id_name_key" ON "fee_heads"("school_id", "name");
CREATE INDEX "fee_heads_school_id_idx" ON "fee_heads"("school_id");
CREATE INDEX "fee_heads_income_head_id_idx" ON "fee_heads"("income_head_id");
CREATE UNIQUE INDEX "fee_structures_school_id_year_class_fee_head_id_key" ON "fee_structures"("school_id", "year", "class", "fee_head_id");
CREATE INDEX "fee_structures_school_id_year_class_idx" ON "fee_structures"("school_id", "year", "class");
CREATE INDEX "fee_structures_fee_head_id_idx" ON "fee_structures"("fee_head_id");
CREATE INDEX "fee_waivers_school_id_year_idx" ON "fee_waivers"("school_id", "year");
CREATE INDEX "fee_waivers_student_id_year_idx" ON "fee_waivers"("student_id", "year");
CREATE INDEX "fee_waivers_fee_head_id_idx" ON "fee_waivers"("fee_head_id");
CREATE UNIQUE INDEX "fee_receipts_voucher_id_key" ON "fee_receipts"("voucher_id");
CREATE UNIQUE INDEX "fee_receipts_school_id_receipt_no_key" ON "fee_receipts"("school_id", "receipt_no");
CREATE INDEX "fee_receipts_school_id_date_idx" ON "fee_receipts"("school_id", "date");
CREATE INDEX "fee_receipts_student_id_year_idx" ON "fee_receipts"("student_id", "year");
CREATE INDEX "fee_receipts_pay_head_id_idx" ON "fee_receipts"("pay_head_id");
CREATE UNIQUE INDEX "fee_receipt_items_school_id_student_id_year_fee_head_id_month_key" ON "fee_receipt_items"("school_id", "student_id", "year", "fee_head_id", "month");
CREATE INDEX "fee_receipt_items_receipt_id_idx" ON "fee_receipt_items"("receipt_id");
CREATE INDEX "fee_receipt_items_fee_head_id_idx" ON "fee_receipt_items"("fee_head_id");

ALTER TABLE "fee_heads" ADD CONSTRAINT "fee_heads_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_heads" ADD CONSTRAINT "fee_heads_income_head_id_fkey"
  FOREIGN KEY ("income_head_id") REFERENCES "acc_heads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_fee_head_id_fkey"
  FOREIGN KEY ("fee_head_id") REFERENCES "fee_heads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fee_waivers" ADD CONSTRAINT "fee_waivers_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_waivers" ADD CONSTRAINT "fee_waivers_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_waivers" ADD CONSTRAINT "fee_waivers_fee_head_id_fkey"
  FOREIGN KEY ("fee_head_id") REFERENCES "fee_heads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_receipts" ADD CONSTRAINT "fee_receipts_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_receipts" ADD CONSTRAINT "fee_receipts_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fee_receipts" ADD CONSTRAINT "fee_receipts_pay_head_id_fkey"
  FOREIGN KEY ("pay_head_id") REFERENCES "acc_heads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fee_receipts" ADD CONSTRAINT "fee_receipts_voucher_id_fkey"
  FOREIGN KEY ("voucher_id") REFERENCES "acc_vouchers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fee_receipt_items" ADD CONSTRAINT "fee_receipt_items_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_receipt_items" ADD CONSTRAINT "fee_receipt_items_receipt_id_fkey"
  FOREIGN KEY ("receipt_id") REFERENCES "fee_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_receipt_items" ADD CONSTRAINT "fee_receipt_items_fee_head_id_fkey"
  FOREIGN KEY ("fee_head_id") REFERENCES "fee_heads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['fee_heads', 'fee_structures', 'fee_waivers', 'fee_receipts', 'fee_receipt_items'] LOOP
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
