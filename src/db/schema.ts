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
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const certificates = pgTable(
	"certificates",
	{
		id: text("id").primaryKey(),
		workshopId: text("workshop_id")
			.notNull()
			.references(() => workshops.id),
		name: text("name").notNull(),
		email: text("email").notNull(),
		filePath: text("file_path").notNull(),
		issuedAt: timestamp("issued_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("cert_email_workshop_idx").on(table.email, table.workshopId),
	],
);
