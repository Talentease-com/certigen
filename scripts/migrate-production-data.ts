import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";
import pg from "pg";

config({ path: [".env.local", ".env"], quiet: true });

const SOURCE_DATABASE =
	process.env.MIGRATION_SOURCE_DATABASE ?? "neon_clone";
const TARGET_DATABASE =
	process.env.MIGRATION_TARGET_DATABASE ?? "nextjs_migrated";
const ADMIN_DATABASE = process.env.MIGRATION_ADMIN_DATABASE ?? "postgres";

function databaseUrl(database: string): string {
	const configuredUrl = process.env.DATABASE_URL;
	if (!configuredUrl) {
		throw new Error("DATABASE_URL is required.");
	}

	const url = new URL(configuredUrl);
	url.pathname = `/${database}`;
	return url.toString();
}

function quoteIdentifier(identifier: string): string {
	return `"${identifier.replaceAll('"', '""')}"`;
}

async function databaseExists(
	client: pg.Client,
	database: string,
): Promise<boolean> {
	const result = await client.query<{ exists: boolean }>(
		"SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS exists",
		[database],
	);
	return result.rows[0]?.exists ?? false;
}

async function sourceCounts(): Promise<Record<string, number>> {
	const client = new pg.Client({
		connectionString: databaseUrl(SOURCE_DATABASE),
		options:
			"-c default_transaction_read_only=on -c statement_timeout=30000",
	});
	await client.connect();

	try {
		const result = await client.query<{
			certificates: number;
			templates: number;
			workshops: number;
		}>(`
			SELECT
				(SELECT count(*)::int FROM certificates) AS certificates,
				(SELECT count(*)::int FROM templates) AS templates,
				(SELECT count(*)::int FROM workshops) AS workshops
		`);
		return result.rows[0];
	} finally {
		await client.end();
	}
}

async function run(): Promise<void> {
	if (SOURCE_DATABASE === TARGET_DATABASE) {
		throw new Error("Source and target database names must be different.");
	}

	const beforeCounts = await sourceCounts();
	const admin = new pg.Client({
		connectionString: databaseUrl(ADMIN_DATABASE),
		options: "-c statement_timeout=30000",
	});
	await admin.connect();

	try {
		if (!(await databaseExists(admin, SOURCE_DATABASE))) {
			throw new Error(`Source database ${SOURCE_DATABASE} does not exist.`);
		}
		if (await databaseExists(admin, TARGET_DATABASE)) {
			throw new Error(
				`Target database ${TARGET_DATABASE} already exists; refusing to overwrite it.`,
			);
		}

		await admin.query(
			`CREATE DATABASE ${quoteIdentifier(TARGET_DATABASE)} WITH TEMPLATE ${quoteIdentifier(SOURCE_DATABASE)}`,
		);
	} finally {
		await admin.end();
	}

	const migrationsDirectory = path.join(process.cwd(), "drizzle");
	const migrationFiles = (await readdir(migrationsDirectory))
		.filter((name) => /^\d+.*\.sql$/.test(name))
		.sort();
	const target = new pg.Client({
		connectionString: databaseUrl(TARGET_DATABASE),
		options: "-c statement_timeout=30000",
	});
	await target.connect();

	try {
		await target.query("BEGIN");
		for (const migrationFile of migrationFiles) {
			const sql = await readFile(
				path.join(migrationsDirectory, migrationFile),
				"utf8",
			);
			await target.query(sql);
			console.log(`Applied ${migrationFile}`);
		}
		await target.query("COMMIT");
	} catch (error) {
		await target.query("ROLLBACK");
		throw error;
	} finally {
		await target.end();
	}

	const afterCounts = await sourceCounts();
	if (JSON.stringify(beforeCounts) !== JSON.stringify(afterCounts)) {
		throw new Error(
			`Source counts changed during migration: ${JSON.stringify({ beforeCounts, afterCounts })}`,
		);
	}

	console.log(
		JSON.stringify(
			{
				sourceDatabase: SOURCE_DATABASE,
				targetDatabase: TARGET_DATABASE,
				sourceReadOnlyCounts: afterCounts,
				appliedMigrations: migrationFiles,
			},
			null,
			2,
		),
	);
}

run().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
