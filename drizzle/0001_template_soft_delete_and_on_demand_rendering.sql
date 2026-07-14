-- Templates are never hard-deleted; "deleting" one from the admin UI just
-- flips this flag off so it drops out of selection for new workshops, while
-- workshops/certificates that already reference it keep working.
ALTER TABLE "templates" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;

-- Certificate images are never persisted — they're re-rendered on demand
-- from the template on every download/preview/email, so there's no file to
-- track a path for.
ALTER TABLE "certificates" DROP COLUMN IF EXISTS "file_path";
