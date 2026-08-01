-- Templates are never hard-deleted; "deleting" one from the admin UI just
-- flips this flag off so it drops out of selection for new workshops, while
-- workshops/certificates that already reference it keep working.
ALTER TABLE "templates" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;

-- New certificates are rendered on demand, but keep the old storage key for
-- certificates issued before the cutover. A historical template may have
-- changed since a certificate was issued, so this compatibility field lets
-- existing download links serve the exact original image when it still
-- exists. New rows leave it NULL.
ALTER TABLE "certificates" RENAME COLUMN "file_path" TO "legacy_file_path";
ALTER TABLE "certificates" ALTER COLUMN "legacy_file_path" DROP NOT NULL;
