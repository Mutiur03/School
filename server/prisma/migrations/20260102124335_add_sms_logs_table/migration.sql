-- CreateTable
CREATE TABLE "sms_logs" (
    "id" SERIAL NOT NULL,
    "student_id" INTEGER NOT NULL,
    "phone_number" VARCHAR(15) NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error_reason" TEXT,
    "attendance_date" VARCHAR(10) NOT NULL,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sms_logs_status_idx" ON "sms_logs"("status");

-- CreateIndex
CREATE INDEX "sms_logs_attendance_date_idx" ON "sms_logs"("attendance_date");

-- CreateIndex
CREATE INDEX "sms_logs_student_id_idx" ON "sms_logs"("student_id");

-- AddForeignKey
ALTER TABLE "sms_logs" ADD CONSTRAINT "sms_logs_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
