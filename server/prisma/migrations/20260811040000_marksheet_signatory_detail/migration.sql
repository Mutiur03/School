-- Pin signatory name/signature/phone at generate time so frozen exams do not
-- rewrite history when the same person later renames or re-uploads a signature.
ALTER TABLE "marksheet_files"
    ADD COLUMN "snapshot_signatory_detail" JSONB;

ALTER TABLE "marksheet_bundles"
    ADD COLUMN "snapshot_signatory_detail" JSONB;
