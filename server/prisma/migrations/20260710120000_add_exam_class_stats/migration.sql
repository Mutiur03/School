-- CreateTable
CREATE TABLE "exam_class_stats" (
    "id" SERIAL NOT NULL,
    "exam_id" INTEGER NOT NULL,
    "class" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "highest_by_subject" JSONB NOT NULL,
    "class_highest_total" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "school_id" INTEGER,

    CONSTRAINT "exam_class_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exam_class_stats_exam_id_idx" ON "exam_class_stats"("exam_id");

-- CreateIndex
CREATE INDEX "exam_class_stats_school_id_idx" ON "exam_class_stats"("school_id");

-- CreateIndex
CREATE UNIQUE INDEX "unique_exam_class_stats" ON "exam_class_stats"("exam_id", "class", "year", "school_id");

-- AddForeignKey
ALTER TABLE "exam_class_stats" ADD CONSTRAINT "exam_class_stats_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_class_stats" ADD CONSTRAINT "exam_class_stats_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Attach multi-tenant RLS (trigger + policies) to every table that has a
-- school_id column. Idempotent and identical to the block in
-- 20260417203000_expand_rls_all_tenant_tables so the new exam_class_stats
-- table is picked up automatically (school_id filled from app.school_id on insert).
DO $$
DECLARE
  rec RECORD;
  trigger_name TEXT;
  policy_select TEXT;
  policy_insert TEXT;
  policy_update TEXT;
  policy_delete TEXT;
  index_school_id TEXT;
BEGIN
  FOR rec IN
    SELECT DISTINCT table_schema, table_name
    FROM information_schema.columns
    WHERE column_name = 'school_id'
      AND table_schema = 'public'
  LOOP
    trigger_name := format('trg_%s_set_school_id', rec.table_name);
    policy_select := format('rls_%s_select', rec.table_name);
    policy_insert := format('rls_%s_insert', rec.table_name);
    policy_update := format('rls_%s_update', rec.table_name);
    policy_delete := format('rls_%s_delete', rec.table_name);
    index_school_id := format('idx_%s_school_id', rec.table_name);

    EXECUTE format(
      'DROP TRIGGER IF EXISTS %I ON %I.%I',
      trigger_name,
      rec.table_schema,
      rec.table_name
    );

    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT ON %I.%I FOR EACH ROW EXECUTE FUNCTION app.set_school_id_from_rls_context()',
      trigger_name,
      rec.table_schema,
      rec.table_name
    );

    EXECUTE format(
      'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
      rec.table_schema,
      rec.table_name
    );

    -- Security-first default: even table owner must obey RLS policies.
    EXECUTE format(
      'ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY',
      rec.table_schema,
      rec.table_name
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_select,
      rec.table_schema,
      rec.table_name
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_insert,
      rec.table_schema,
      rec.table_name
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_update,
      rec.table_schema,
      rec.table_name
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_delete,
      rec.table_schema,
      rec.table_name
    );

    EXECUTE format(
      'CREATE POLICY %I ON %I.%I FOR SELECT USING (app.is_super_admin() OR school_id = app.current_school_id())',
      policy_select,
      rec.table_schema,
      rec.table_name
    );

    EXECUTE format(
      'CREATE POLICY %I ON %I.%I FOR INSERT WITH CHECK (app.is_super_admin() OR school_id = app.current_school_id())',
      policy_insert,
      rec.table_schema,
      rec.table_name
    );

    EXECUTE format(
      'CREATE POLICY %I ON %I.%I FOR UPDATE USING (app.is_super_admin() OR school_id = app.current_school_id()) WITH CHECK (app.is_super_admin() OR school_id = app.current_school_id())',
      policy_update,
      rec.table_schema,
      rec.table_name
    );

    EXECUTE format(
      'CREATE POLICY %I ON %I.%I FOR DELETE USING (app.is_super_admin() OR school_id = app.current_school_id())',
      policy_delete,
      rec.table_schema,
      rec.table_name
    );
  END LOOP;
END $$;
