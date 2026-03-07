import {
	pgTable,
	text,
	integer,
	timestamp,
	uniqueIndex,
	boolean,
} from "drizzle-orm/pg-core";

// ── Better Auth tables ──────────────────────────────────────────────────────

export const user = pgTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: boolean("email_verified").notNull(),
	image: text("image"),
	createdAt: timestamp("created_at").notNull(),
	updatedAt: timestamp("updated_at").notNull(),
	role: text("role"),
	banned: boolean("banned"),
	banReason: text("ban_reason"),
	banExpires: timestamp("ban_expires"),
});

export const session = pgTable("session", {
	id: text("id").primaryKey(),
	expiresAt: timestamp("expires_at").notNull(),
	token: text("token").notNull().unique(),
	createdAt: timestamp("created_at").notNull(),
	updatedAt: timestamp("updated_at").notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	impersonatedBy: text("impersonated_by"),
});

export const account = pgTable("account", {
	id: text("id").primaryKey(),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	accessTokenExpiresAt: timestamp("access_token_expires_at"),
	refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
	scope: text("scope"),
	password: text("password"),
	createdAt: timestamp("created_at").notNull(),
	updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
	id: text("id").primaryKey(),
	identifier: text("identifier").notNull(),
	value: text("value").notNull(),
	expiresAt: timestamp("expires_at").notNull(),
	createdAt: timestamp("created_at"),
	updatedAt: timestamp("updated_at"),
});

// ── Application tables ──────────────────────────────────────────────────────

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
