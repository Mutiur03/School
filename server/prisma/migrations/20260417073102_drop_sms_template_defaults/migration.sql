-- AlterTable
ALTER TABLE "sms_settings" ALTER COLUMN "present_template" DROP DEFAULT,
ALTER COLUMN "absent_template" DROP DEFAULT,
ALTER COLUMN "run_awayed_template" DROP DEFAULT;
