-- Session marksheet cache rows (student-year or whole-year). input_hash lives
-- in Postgres; R2 stores the PDF only (no .hash sidecar).
CREATE TABLE "marksheet_sessions" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "student_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "r2_key" TEXT,
    "input_hash" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "generated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "school_id" INTEGER NOT NULL,

    CONSTRAINT "marksheet_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "marksheet_sessions_school_id_status_idx" ON "marksheet_sessions"("school_id", "status");
CREATE INDEX "marksheet_sessions_status_idx" ON "marksheet_sessions"("status");
CREATE UNIQUE INDEX "marksheet_sessions_school_id_year_student_id_key" ON "marksheet_sessions"("school_id", "year", "student_id");

ALTER TABLE "marksheet_sessions" ADD CONSTRAINT "marksheet_sessions_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
