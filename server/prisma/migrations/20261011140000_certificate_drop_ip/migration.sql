-- IP capture is dropped for certificates: not needed, and it was unreliable anyway
-- (reverse proxy chain showed Cloudflare/Vercel edge IPs instead of the real visitor).

ALTER TABLE "certificates" DROP COLUMN "created_ip";
ALTER TABLE "certificate_revisions" DROP COLUMN "ip";
