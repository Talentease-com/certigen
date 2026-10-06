-- Templates are never hard-deleted; "deleting" one from the admin UI just
-- flips this flag off so it drops out of selection for new workshops, while
-- workshops/certificates that already reference it keep working.
ALTER TABLE "templates" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;

-- New certificates are rendered on demand, but keep the old storage key for
-- certificates issued before the cutover. A historical template may have
-- changed since a certificate was issued, so this compatibility field lets
-- existing download links serve the exact original image when it still
-- exists. New rows leave it NULL. Some databases never stored file_path on
-- certificates; they get the empty compatibility column instead.
DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'certificates' AND column_name = 'file_path'
	) THEN
		ALTER TABLE "certificates" RENAME COLUMN "file_path" TO "legacy_file_path";
	END IF;
END
$$;
ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "legacy_file_path" text;
ALTER TABLE "certificates" ALTER COLUMN "legacy_file_path" DROP NOT NULL;
