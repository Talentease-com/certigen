import {
	pgTable,
	text,
	integer,
	timestamp,
	uniqueIndex,
	boolean,
} from "drizzle-orm/pg-core";

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
	filePath: text("file_path").notNull(),
	// JSON: [{key, x, y, fontSize, fontFamily, color, align}]
	placeholders: text("placeholders").notNull().default("[]"),
	width: integer("width").notNull().default(3508),
	height: integer("height").notNull().default(2480),
	// Templates are never hard-deleted (existing workshops/certificates may
	// still depend on them to re-render). "Deleting" one from the admin UI
	// just flips this to false, hiding it from new-workshop selection.
	isActive: boolean("is_active").notNull().default(true),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const certificates = pgTable(
	"certificates",
	{
		id: text("id").primaryKey(),
		workshopId: text("workshop_id")
			.references(() => workshops.id),
		templateId: text("template_id").references(() => templates.id),
		sourcePlatform: text("source_platform"),
		externalId: text("external_id"),
		idempotencyKey: text("idempotency_key"),
		certificateTitle: text("certificate_title"),
		certificateDate: text("certificate_date"),
		name: text("name").notNull(),
		email: text("email").notNull(),
		// The rendered certificate image is never persisted — it's regenerated
		// on demand from the workshop (or, for service-issued certificates,
		// templateId/certificateTitle/certificateDate directly) whenever
		// someone downloads or previews it. Keeps storage limited to templates.
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
