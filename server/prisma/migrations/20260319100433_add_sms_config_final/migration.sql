-- CreateTable
CREATE TABLE "sms_settings" (
    "id" SERIAL NOT NULL,
    "present_template" TEXT NOT NULL DEFAULT 'Dear Parent,
Your child {student_name} (ID: {login_id}) has attended school today ({date}).
Thank you.
Head Master
{school_name}',
    "absent_template" TEXT NOT NULL DEFAULT 'Dear Parent,
Your child {student_name} (ID: {login_id}) is absent from school today ({date}).
Please contact the school office for more info.
Thank you.
{school_name}',
    "send_to_present" BOOLEAN NOT NULL DEFAULT true,
    "send_to_absent" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sms_balance" INTEGER NOT NULL DEFAULT 0,
    "api_key" VARCHAR(255),
    "api_url" VARCHAR(255),
    "sender_id" VARCHAR(50),
    "service_type" VARCHAR(50),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_settings_pkey" PRIMARY KEY ("id")
);
