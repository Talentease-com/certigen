import { config } from "dotenv";

import { migrateDatabase } from "../src/db/migrate";

config({ path: [".env.local", ".env"], quiet: true });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
	console.error("DATABASE_URL is required.");
	process.exit(1);
}

migrateDatabase(connectionString).catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
