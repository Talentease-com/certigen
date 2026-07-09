ALTER TABLE "certificates" ALTER COLUMN "workshop_id" DROP NOT NULL;
ALTER TABLE "certificates" ADD COLUMN "template_id" text;
ALTER TABLE "certificates" ADD COLUMN "source_platform" text;
ALTER TABLE "certificates" ADD COLUMN "external_id" text;
ALTER TABLE "certificates" ADD COLUMN "idempotency_key" text;
ALTER TABLE "certificates" ADD COLUMN "certificate_title" text;
ALTER TABLE "certificates" ADD COLUMN "certificate_date" text;
ALTER TABLE "certificates" ADD COLUMN "email_status" text DEFAULT 'pending' NOT NULL;
ALTER TABLE "certificates" ADD COLUMN "email_sent_at" timestamp;
ALTER TABLE "certificates" ADD COLUMN "email_error" text;
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE no action ON UPDATE no action;
CREATE UNIQUE INDEX "cert_source_idempotency_idx" ON "certificates" ("source_platform", "idempotency_key");
UPDATE "certificates"
SET
	"certificate_title" = "workshops"."title",
	"certificate_date" = "workshops"."date",
	"template_id" = "workshops"."template_id",
	"email_status" = 'sent',
	"email_sent_at" = "certificates"."issued_at"
FROM "workshops"
WHERE "certificates"."workshop_id" = "workshops"."id";
