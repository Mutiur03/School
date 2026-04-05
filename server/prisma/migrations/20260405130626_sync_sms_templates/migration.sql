-- AlterTable
ALTER TABLE "sms_settings" ALTER COLUMN "present_template" SET DEFAULT 'Dear Parent,
Your child {student_name} (ID: {login_id}) has attended school today ({date}).
Thank you.
Head Master
{school_name}',
ALTER COLUMN "absent_template" SET DEFAULT 'Dear Parent,
Your child {student_name} (ID: {login_id}) is absent from school today ({date}).
Please contact the school office for more info.
Thank you.
{school_name}';
