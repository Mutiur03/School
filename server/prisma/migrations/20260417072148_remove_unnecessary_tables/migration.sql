/*
  Warnings:

  - You are about to drop the `school_domains` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `super_admin_hosts` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "school_domains" DROP CONSTRAINT "school_domains_school_id_fkey";

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
{school_name}',
ALTER COLUMN "run_awayed_template" SET DEFAULT 'Dear Parent,
Your child {student_name} (ID: {login_id}) was present in the morning but has run awayed from school today ({date}).
Please check immediately.
Thank you.
{school_name}';

-- DropTable
DROP TABLE "school_domains";

-- DropTable
DROP TABLE "super_admin_hosts";

-- DropEnum
DROP TYPE "SchoolDomainKind";
