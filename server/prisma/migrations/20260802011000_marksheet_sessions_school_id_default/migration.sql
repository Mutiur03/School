-- Match schema: school_id defaults from RLS context like other tenant tables.
ALTER TABLE "marksheet_sessions"
  ALTER COLUMN "school_id" SET DEFAULT app.current_school_id();
