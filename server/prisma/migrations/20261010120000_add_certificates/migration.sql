-- Saved public certificates + revision history (tenant RLS like other tables).
CREATE TABLE "certificates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" INTEGER NOT NULL DEFAULT app.current_school_id(),
  "exam" VARCHAR(10) NOT NULL,
  "passing_year" INTEGER NOT NULL,
  "mobile" VARCHAR(11) NOT NULL,
  "dob" VARCHAR(10) NOT NULL,
  "data" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "certificate_revisions" (
  "id" SERIAL NOT NULL,
  "certificate_id" UUID NOT NULL,
  "school_id" INTEGER NOT NULL DEFAULT app.current_school_id(),
  "data" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "certificate_revisions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "certificates_school_id_passing_year_mobile_dob_exam_key"
  ON "certificates"("school_id", "passing_year", "mobile", "dob", "exam");
CREATE INDEX "certificates_school_id_idx" ON "certificates"("school_id");
CREATE INDEX "certificate_revisions_certificate_id_idx" ON "certificate_revisions"("certificate_id");
CREATE INDEX "certificate_revisions_school_id_idx" ON "certificate_revisions"("school_id");

ALTER TABLE "certificates"
  ADD CONSTRAINT "certificates_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "certificate_revisions"
  ADD CONSTRAINT "certificate_revisions_certificate_id_fkey"
  FOREIGN KEY ("certificate_id") REFERENCES "certificates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "certificate_revisions"
  ADD CONSTRAINT "certificate_revisions_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates FORCE ROW LEVEL SECURITY;
CREATE TRIGGER trg_certificates_set_school_id
  BEFORE INSERT ON public.certificates
  FOR EACH ROW EXECUTE FUNCTION app.set_school_id_from_rls_context();
CREATE POLICY rls_certificates_select ON public.certificates
  FOR SELECT USING (app.is_super_admin() OR school_id = app.current_school_id());
CREATE POLICY rls_certificates_insert ON public.certificates
  FOR INSERT WITH CHECK (app.is_super_admin() OR school_id = app.current_school_id());
CREATE POLICY rls_certificates_update ON public.certificates
  FOR UPDATE USING (app.is_super_admin() OR school_id = app.current_school_id())
  WITH CHECK (app.is_super_admin() OR school_id = app.current_school_id());
CREATE POLICY rls_certificates_delete ON public.certificates
  FOR DELETE USING (app.is_super_admin() OR school_id = app.current_school_id());

ALTER TABLE public.certificate_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificate_revisions FORCE ROW LEVEL SECURITY;
CREATE TRIGGER trg_certificate_revisions_set_school_id
  BEFORE INSERT ON public.certificate_revisions
  FOR EACH ROW EXECUTE FUNCTION app.set_school_id_from_rls_context();
CREATE POLICY rls_certificate_revisions_select ON public.certificate_revisions
  FOR SELECT USING (app.is_super_admin() OR school_id = app.current_school_id());
CREATE POLICY rls_certificate_revisions_insert ON public.certificate_revisions
  FOR INSERT WITH CHECK (app.is_super_admin() OR school_id = app.current_school_id());
CREATE POLICY rls_certificate_revisions_update ON public.certificate_revisions
  FOR UPDATE USING (app.is_super_admin() OR school_id = app.current_school_id())
  WITH CHECK (app.is_super_admin() OR school_id = app.current_school_id());
CREATE POLICY rls_certificate_revisions_delete ON public.certificate_revisions
  FOR DELETE USING (app.is_super_admin() OR school_id = app.current_school_id());
