-- School access codes (pre-auth school lookup for the app) and refresh-token sessions
-- (rotation + reuse detection). Both tables follow the tenant RLS pattern of the earlier
-- migrations. Apply BEFORE deploying the server code that uses them.

CREATE TABLE "school_access_codes" (
  "id" SERIAL NOT NULL,
  "school_id" INTEGER NOT NULL DEFAULT app.current_school_id(),
  "code" VARCHAR(16) NOT NULL,
  "role_hint" VARCHAR(16),
  "created_by" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  CONSTRAINT "school_access_codes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "school_access_codes_code_format" CHECK ("code" ~ '^[A-Z0-9]{3}-[A-Z0-9]{4}$'),
  CONSTRAINT "school_access_codes_role_hint_check"
    CHECK ("role_hint" IS NULL OR "role_hint" IN ('admin', 'teacher', 'student'))
);

CREATE UNIQUE INDEX "school_access_codes_code_key" ON "school_access_codes"("code");
CREATE INDEX "school_access_codes_school_id_idx" ON "school_access_codes"("school_id");

ALTER TABLE "school_access_codes" ADD CONSTRAINT "school_access_codes_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "auth_sessions" (
  "id" SERIAL NOT NULL,
  "jti" UUID NOT NULL,
  "family_id" UUID NOT NULL,
  "user_role" VARCHAR(16) NOT NULL,
  "user_id" INTEGER NOT NULL,
  "school_id" INTEGER DEFAULT app.current_school_id(),
  "client" VARCHAR(8) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "rotated_at" TIMESTAMP(3),
  "replaced_by" UUID,
  "revoked_at" TIMESTAMP(3),
  CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "auth_sessions_client_check" CHECK ("client" IN ('web', 'native')),
  CONSTRAINT "auth_sessions_school_scope_check"
    CHECK (("user_role" = 'super_admin') = ("school_id" IS NULL))
);

CREATE UNIQUE INDEX "auth_sessions_jti_key" ON "auth_sessions"("jti");
CREATE INDEX "auth_sessions_family_id_idx" ON "auth_sessions"("family_id");
CREATE INDEX "auth_sessions_school_id_idx" ON "auth_sessions"("school_id");
CREATE INDEX "auth_sessions_user_role_user_id_idx" ON "auth_sessions"("user_role", "user_id");
CREATE INDEX "auth_sessions_expires_at_idx" ON "auth_sessions"("expires_at");

ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tenant RLS, same template as acc_years. auth_sessions rows with a NULL school_id
-- (super_admin) are therefore visible only in super-admin context.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['school_access_codes', 'auth_sessions'] LOOP
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

-- Pre-auth code lookup. This is the ONLY cross-tenant read: the app does not know its school
-- yet, so no RLS context exists. Why it is safe:
--   * SECURITY DEFINER runs as the migration owner (bootstrap superuser, which bypasses RLS);
--     school_app itself gains no table privilege and stays NOBYPASSRLS.
--   * Input is one exact code; there is no pattern matching, listing or id input.
--   * Output is fixed and public: the same name/logo/host the school's public site already
--     serves from GET /api/schools/public, plus the code's role hint. No ids, no contact data.
--   * Only active codes match (not revoked, not expired).
--   * search_path is pinned and every object is schema-qualified.
--   * EXECUTE is revoked from PUBLIC and granted to school_app only.
-- If the owner is ever a non-superuser without BYPASSRLS, FORCE RLS makes this return no rows
-- (fails closed: every code resolves to "not found").
CREATE OR REPLACE FUNCTION app.lookup_school_access_code(p_code TEXT)
RETURNS TABLE (
  name VARCHAR(200),
  short_name VARCHAR(50),
  logo TEXT,
  subdomain VARCHAR(100),
  custom_domain VARCHAR(255),
  role_hint VARCHAR(16)
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT s."name", s."shortName", s."logo", s."subdomain", s."customDomain", c."role_hint"
  FROM public."school_access_codes" c
  JOIN public."School" s ON s."id" = c."school_id"
  WHERE c."code" = p_code
    AND c."revoked_at" IS NULL
    AND (c."expires_at" IS NULL OR c."expires_at" > CURRENT_TIMESTAMP)
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION app.lookup_school_access_code(TEXT) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'school_app') THEN
    GRANT EXECUTE ON FUNCTION app.lookup_school_access_code(TEXT) TO school_app;
  END IF;
END $$;
