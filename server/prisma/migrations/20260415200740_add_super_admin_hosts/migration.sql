CREATE TABLE IF NOT EXISTS "super_admin_hosts" (
	"id" SERIAL PRIMARY KEY,
	"host" VARCHAR(255) NOT NULL,
	"is_active" BOOLEAN NOT NULL DEFAULT true,
	"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "super_admin_hosts_host_key"
	ON "super_admin_hosts" ("host");

CREATE UNIQUE INDEX IF NOT EXISTS "super_admin_hosts_host_lower_key"
	ON "super_admin_hosts" (LOWER("host"));
