import {
	pgTable,
	text,
	integer,
	timestamp,
	uniqueIndex,
	boolean,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const workshops = pgTable("workshops", {
	id: text("id").primaryKey(),
	code: text("code").notNull().unique(),
	title: text("title").notNull(),
	date: text("date").notNull(),
	templateId: text("template_id").references(() => templates.id),
	isActive: boolean("is_active").notNull().default(true),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const templates = pgTable("templates", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	// Templates are never hard-deleted (existing workshops/certificates may
	// still depend on them to re-render). "Deleting" one from the admin UI
	// just flips this to false, hiding it from new-workshop selection.
	isActive: boolean("is_active").notNull().default(true),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const templateVersions = pgTable(
	"template_versions",
	{
		id: text("id").primaryKey(),
		templateId: text("template_id")
			.notNull()
			.references(() => templates.id),
		versionNumber: integer("version_number").notNull(),
		filePath: text("file_path").notNull(),
		// JSON: CertificateDesign — see src/lib/certificate-design.ts
		design: text("design").notNull(),
		width: integer("width").notNull(),
		height: integer("height").notNull(),
		isCurrent: boolean("is_current").notNull().default(false),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("template_version_number_idx").on(
			table.templateId,
			table.versionNumber,
		),
		uniqueIndex("template_current_version_idx")
			.on(table.templateId)
			.where(sql`${table.isCurrent} = true`),
	],
);

export const certificates = pgTable(
	"certificates",
	{
		id: text("id").primaryKey(),
		workshopId: text("workshop_id")
			.references(() => workshops.id),
		templateId: text("template_id").references(() => templates.id),
		templateVersionId: text("template_version_id")
			.notNull()
			.references(() => templateVersions.id),
		sourcePlatform: text("source_platform"),
		externalId: text("external_id"),
		idempotencyKey: text("idempotency_key"),
		certificateTitle: text("certificate_title"),
		certificateDate: text("certificate_date"),
		name: text("name").notNull(),
		email: text("email").notNull(),
		// Existing production certificates keep their original stored image.
		// New certificates leave this null and are rendered on demand.
		legacyFilePath: text("legacy_file_path"),
		// New certificate images are not persisted — they're regenerated on
		// demand from the workshop (or, for service-issued certificates,
		// templateId/certificateTitle/certificateDate directly) whenever
		// someone downloads or previews them.
		emailStatus: text("email_status").notNull().default("pending"),
		emailSentAt: timestamp("email_sent_at"),
		emailError: text("email_error"),
		issuedAt: timestamp("issued_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("cert_email_workshop_idx").on(table.email, table.workshopId),
		uniqueIndex("cert_source_idempotency_idx").on(
			table.sourcePlatform,
			table.idempotencyKey,
		),
	],
);
