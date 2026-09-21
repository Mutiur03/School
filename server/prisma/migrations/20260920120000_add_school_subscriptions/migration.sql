CREATE TYPE "SubscriptionStatus" AS ENUM (
  'trialing',
  'active',
  'past_due',
  'suspended',
  'expired',
  'cancelled'
);

CREATE TABLE "school_subscriptions" (
  "id" SERIAL NOT NULL,
  "school_id" INTEGER NOT NULL DEFAULT app.current_school_id(),
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'trialing',
  "plan_name" VARCHAR(100) NOT NULL DEFAULT 'Annual',
  "billing_interval" VARCHAR(20) NOT NULL DEFAULT 'annual',
  "annual_price" DECIMAL(12,2),
  "currency" VARCHAR(3) NOT NULL DEFAULT 'BDT',
  "trial_started_at" TIMESTAMP(3),
  "trial_ends_at" TIMESTAMP(3),
  "subscription_started_at" TIMESTAMP(3),
  "current_period_started_at" TIMESTAMP(3),
  "current_period_ends_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  "status_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "school_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "school_subscriptions_school_id_key"
  ON "school_subscriptions"("school_id");
CREATE INDEX "school_subscriptions_school_id_idx"
  ON "school_subscriptions"("school_id");
CREATE INDEX "school_subscriptions_status_idx"
  ON "school_subscriptions"("status");
CREATE INDEX "school_subscriptions_trial_ends_at_idx"
  ON "school_subscriptions"("trial_ends_at");
CREATE INDEX "school_subscriptions_current_period_ends_at_idx"
  ON "school_subscriptions"("current_period_ends_at");

ALTER TABLE "school_subscriptions"
  ADD CONSTRAINT "school_subscriptions_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing schools remain usable after rollout. New schools are provisioned with a free trial.
INSERT INTO "school_subscriptions" (
  "school_id",
  "status",
  "plan_name",
  "billing_interval",
  "subscription_started_at",
  "current_period_started_at",
  "current_period_ends_at",
  "status_changed_at",
  "updated_at"
)
SELECT
  "id",
  'active'::"SubscriptionStatus",
  'Annual',
  'annual',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP + INTERVAL '1 year',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "School"
ON CONFLICT ("school_id") DO NOTHING;

DO $$
BEGIN
  CREATE TRIGGER trg_school_subscriptions_set_school_id
    BEFORE INSERT ON public.school_subscriptions
    FOR EACH ROW EXECUTE FUNCTION app.set_school_id_from_rls_context();

  ALTER TABLE public.school_subscriptions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.school_subscriptions FORCE ROW LEVEL SECURITY;

  CREATE POLICY rls_school_subscriptions_select ON public.school_subscriptions
    FOR SELECT USING (app.is_super_admin() OR school_id = app.current_school_id());
  CREATE POLICY rls_school_subscriptions_insert ON public.school_subscriptions
    FOR INSERT WITH CHECK (app.is_super_admin() OR school_id = app.current_school_id());
  CREATE POLICY rls_school_subscriptions_update ON public.school_subscriptions
    FOR UPDATE USING (app.is_super_admin() OR school_id = app.current_school_id())
    WITH CHECK (app.is_super_admin() OR school_id = app.current_school_id());
  CREATE POLICY rls_school_subscriptions_delete ON public.school_subscriptions
    FOR DELETE USING (app.is_super_admin() OR school_id = app.current_school_id());
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'school_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON school_subscriptions TO school_app;
    GRANT USAGE, SELECT ON SEQUENCE school_subscriptions_id_seq TO school_app;
  END IF;
END $$;
