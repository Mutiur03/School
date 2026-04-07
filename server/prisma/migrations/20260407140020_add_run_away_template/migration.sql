-- AlterTable
ALTER TABLE "sms_settings" ADD COLUMN     "run_awayed_template" TEXT NOT NULL DEFAULT 'Dear Parent,
Your child {student_name} (ID: {login_id}) was present in the morning but has run awayed from school today ({date}).
Please check immediately.
Thank you.
{school_name}',
ADD COLUMN     "send_to_run_awayed" BOOLEAN NOT NULL DEFAULT true;
