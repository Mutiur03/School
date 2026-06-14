-- Add school_id to sms_settings (one row per school)
ALTER TABLE "sms_settings" ADD COLUMN "school_id" INTEGER;

-- Backfill: assign existing row to first school, clone config for other schools
DO $$
DECLARE
  template_rec "sms_settings"%ROWTYPE;
  school_rec RECORD;
  first_school_id INTEGER;
BEGIN
  SELECT id INTO first_school_id FROM "School" ORDER BY id LIMIT 1;
  IF first_school_id IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO template_rec FROM "sms_settings" ORDER BY id LIMIT 1;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE "sms_settings"
  SET "school_id" = first_school_id
  WHERE id = template_rec.id;

  -- Remove any extra legacy rows that were never tenant-scoped
  DELETE FROM "sms_settings" WHERE "school_id" IS NULL;

  FOR school_rec IN
    SELECT id FROM "School" WHERE id <> first_school_id ORDER BY id
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM "sms_settings" WHERE "school_id" = school_rec.id
    ) THEN
    INSERT INTO "sms_settings" (
      "present_template",
      "absent_template",
      "run_awayed_template",
      "send_to_present",
      "send_to_absent",
      "send_to_run_awayed",
      "is_active",
      "sms_balance",
      "api_key",
      "api_url",
      "sender_id",
      "service_type",
      "updated_at",
      "school_id"
    ) VALUES (
      template_rec.present_template,
      template_rec.absent_template,
      template_rec.run_awayed_template,
      template_rec.send_to_present,
      template_rec.send_to_absent,
      template_rec.send_to_run_awayed,
      template_rec.is_active,
      0,
      template_rec.api_key,
      template_rec.api_url,
      template_rec.sender_id,
      template_rec.service_type,
      NOW(),
      school_rec.id
    );
    END IF;
  END LOOP;
END $$;

ALTER TABLE "sms_settings" ALTER COLUMN "school_id" SET NOT NULL;

CREATE UNIQUE INDEX "sms_settings_school_id_key" ON "sms_settings"("school_id");
CREATE INDEX "sms_settings_school_id_idx" ON "sms_settings"("school_id");

ALTER TABLE "sms_settings"
  ADD CONSTRAINT "sms_settings_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS for sms_settings (same pattern as expand_rls_all_tenant_tables)
DROP TRIGGER IF EXISTS trg_sms_settings_set_school_id ON public.sms_settings;
CREATE TRIGGER trg_sms_settings_set_school_id
  BEFORE INSERT ON public.sms_settings
  FOR EACH ROW EXECUTE FUNCTION app.set_school_id_from_rls_context();

ALTER TABLE public.sms_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_settings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_sms_settings_select ON public.sms_settings;
DROP POLICY IF EXISTS rls_sms_settings_insert ON public.sms_settings;
DROP POLICY IF EXISTS rls_sms_settings_update ON public.sms_settings;
DROP POLICY IF EXISTS rls_sms_settings_delete ON public.sms_settings;

CREATE POLICY rls_sms_settings_select ON public.sms_settings
  FOR SELECT USING (app.is_super_admin() OR school_id = app.current_school_id());

CREATE POLICY rls_sms_settings_insert ON public.sms_settings
  FOR INSERT WITH CHECK (app.is_super_admin() OR school_id = app.current_school_id());

CREATE POLICY rls_sms_settings_update ON public.sms_settings
  FOR UPDATE
  USING (app.is_super_admin() OR school_id = app.current_school_id())
  WITH CHECK (app.is_super_admin() OR school_id = app.current_school_id());

CREATE POLICY rls_sms_settings_delete ON public.sms_settings
  FOR DELETE USING (app.is_super_admin() OR school_id = app.current_school_id());
