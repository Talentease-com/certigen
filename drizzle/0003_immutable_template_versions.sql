-- Template rows are logical identities. Their visual rendering inputs live in
-- immutable versions so a later editor save can never change an already-issued
-- certificate.
CREATE TABLE "template_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"template_id" text NOT NULL,
	"version_number" integer NOT NULL,
	"file_path" text NOT NULL,
	"design" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "template_versions_template_id_templates_id_fk"
		FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id")
		ON DELETE no action ON UPDATE no action
);

CREATE UNIQUE INDEX "template_version_number_idx"
	ON "template_versions" ("template_id", "version_number");
CREATE UNIQUE INDEX "template_current_version_idx"
	ON "template_versions" ("template_id")
	WHERE "is_current" = true;

-- Every pre-versioning template becomes deterministic version 1. Its existing
-- storage path is retained and will never be overwritten after this cutover.
INSERT INTO "template_versions" (
	"id",
	"template_id",
	"version_number",
	"file_path",
	"design",
	"width",
	"height",
	"is_current",
	"created_at"
)
SELECT
	'initial-' || "id",
	"id",
	1,
	"file_path",
	"design",
	"width",
	"height",
	true,
	"created_at"
FROM "templates";

ALTER TABLE "certificates" ADD COLUMN "template_version_id" text;

UPDATE "certificates"
SET "template_version_id" = 'initial-' || "template_id"
WHERE "template_id" IS NOT NULL;

DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "certificates"
		WHERE "template_version_id" IS NULL
	) THEN
		RAISE EXCEPTION 'Cannot version certificates with no template_id';
	END IF;
END
$$;

ALTER TABLE "certificates" ALTER COLUMN "template_version_id" SET NOT NULL;
ALTER TABLE "certificates"
	ADD CONSTRAINT "certificates_template_version_id_template_versions_id_fk"
	FOREIGN KEY ("template_version_id")
	REFERENCES "public"."template_versions"("id")
	ON DELETE no action ON UPDATE no action;

-- Remove the mutable duplicate. From this point forward template_versions is
-- the only source of background/design/dimension data.
ALTER TABLE "templates" DROP COLUMN "file_path";
ALTER TABLE "templates" DROP COLUMN "design";
ALTER TABLE "templates" DROP COLUMN "width";
ALTER TABLE "templates" DROP COLUMN "height";
