-- Add individual student contact/address fields
ALTER TABLE "students"
ADD COLUMN "father_phone" VARCHAR(11),
ADD COLUMN "mother_phone" VARCHAR(11),
ADD COLUMN "village" VARCHAR(100),
ADD COLUMN "post_office" VARCHAR(100),
ADD COLUMN "upazila" VARCHAR(100),
ADD COLUMN "district" VARCHAR(100);
