-- Supersedes the free-text address_bn/address_en from the previous migration: switch to the
-- same structured shape as the registration forms (district/upazila + post office/code/village
-- road). District and upazila get Bangla for free from the districts/upazilas lookup; post
-- office and village/road are free text with no Bangla equivalent, so both languages are stored
-- by hand. Nullable-via-default-empty since no certificate has used the old columns yet.

ALTER TABLE "certificates"
  DROP COLUMN "address_bn",
  DROP COLUMN "address_en",
  ADD COLUMN "address_district" VARCHAR(50) NOT NULL DEFAULT '',
  ADD COLUMN "address_upazila" VARCHAR(50) NOT NULL DEFAULT '',
  ADD COLUMN "address_post_office" VARCHAR(100) NOT NULL DEFAULT '',
  ADD COLUMN "address_post_office_bn" VARCHAR(100) NOT NULL DEFAULT '',
  ADD COLUMN "address_post_code" VARCHAR(4) NOT NULL DEFAULT '',
  ADD COLUMN "address_village_road" VARCHAR(200) NOT NULL DEFAULT '',
  ADD COLUMN "address_village_road_bn" VARCHAR(200) NOT NULL DEFAULT '';

ALTER TABLE "certificate_revisions"
  DROP COLUMN "address_bn",
  DROP COLUMN "address_en",
  ADD COLUMN "address_district" VARCHAR(50) NOT NULL DEFAULT '',
  ADD COLUMN "address_upazila" VARCHAR(50) NOT NULL DEFAULT '',
  ADD COLUMN "address_post_office" VARCHAR(100) NOT NULL DEFAULT '',
  ADD COLUMN "address_post_office_bn" VARCHAR(100) NOT NULL DEFAULT '',
  ADD COLUMN "address_post_code" VARCHAR(4) NOT NULL DEFAULT '',
  ADD COLUMN "address_village_road" VARCHAR(200) NOT NULL DEFAULT '',
  ADD COLUMN "address_village_road_bn" VARCHAR(200) NOT NULL DEFAULT '';
