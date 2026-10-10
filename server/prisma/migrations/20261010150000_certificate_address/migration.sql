-- certificates / certificate_revisions: add student address (Bangla + English), nullable since
-- it's new and existing rows have none. Printed on the PDF only when an admin requests it.

ALTER TABLE "certificates"
  ADD COLUMN "address_bn" VARCHAR(200) NOT NULL DEFAULT '',
  ADD COLUMN "address_en" VARCHAR(150) NOT NULL DEFAULT '';

ALTER TABLE "certificate_revisions"
  ADD COLUMN "address_bn" VARCHAR(200) NOT NULL DEFAULT '',
  ADD COLUMN "address_en" VARCHAR(150) NOT NULL DEFAULT '';
