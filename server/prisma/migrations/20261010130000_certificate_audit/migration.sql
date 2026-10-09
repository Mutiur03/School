-- Audit trail: who/where created a certificate and who replaced each revision.
ALTER TABLE "certificates" ADD COLUMN "created_ip" VARCHAR(64);
ALTER TABLE "certificate_revisions"
  ADD COLUMN "source" VARCHAR(20) NOT NULL DEFAULT 'student',
  ADD COLUMN "ip" VARCHAR(64);
