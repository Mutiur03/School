-- AlterTable
ALTER TABLE "admission" ADD COLUMN     "admission_open" BOOLEAN DEFAULT false,
ADD COLUMN     "admission_year" INTEGER,
ADD COLUMN     "attachment_instruction" TEXT,
ADD COLUMN     "class_list" TEXT,
ADD COLUMN     "instruction" TEXT,
ADD COLUMN     "list_type" TEXT,
ADD COLUMN     "serial_no" TEXT,
ADD COLUMN     "user_id" TEXT,
ALTER COLUMN "preview_url" DROP NOT NULL;
