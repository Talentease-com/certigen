import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { db } from "@/lib/db";

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",
	}),
	socialProviders: {
		google: {
			clientId: process.env.GOOGLE_CLIENT_ID!,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
		},
	},
	plugins: [
		admin({
			adminUserIds: (process.env.ADMIN_USER_IDS ?? "")
				.split(",")
				.map((s) => s.trim())
				.filter(Boolean),
		}),
		nextCookies(), // must be last
	],
});

export type Session = typeof auth.$Infer.Session;
