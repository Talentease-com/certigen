import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

/** Records which `drizzle/*.sql` migrations have been applied to this database. */
const MIGRATIONS_TABLE = "certigen_migrations";

/**
 * Advisory lock key shared by every Certigen instance, so concurrent starts (for example a rolling
 * deploy) apply migrations one at a time instead of racing.
 */
const MIGRATION_LOCK_KEY = 7314002;

export const migrationsDirectory = path.join(process.cwd(), "drizzle");

/**
 * Databases migrated before this table existed. Each query answers whether that migration's
 * changes are already present, and is consulted only once: when the table is first created.
 * Migrations added after this table never need an entry.
 */
const PRESENT_BEFORE_TRACKING: Record<string, string> = {
	"0000_service_certificates.sql": columnExists("certificates", "source_platform"),
	"0001_template_soft_delete_and_on_demand_rendering.sql": columnExists(
		"certificates",
		"legacy_file_path",
	),
	// 0003 later moves `design` onto template_versions, so either one proves 0002 ran.
	"0002_template_design_column.sql": `select ${columnExists("templates", "design")} or ${tableExists("template_versions")}`,
	"0003_immutable_template_versions.sql": tableExists("template_versions"),
	"0004_service_email_attempt.sql": columnExists("certificates", "email_attempted_at"),
};

function columnExists(table: string, column: string): string {
	return `exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = '${table}' and column_name = '${column}')`;
}

function tableExists(table: string): string {
	return `exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = '${table}')`;
}

/** Migration files in apply order: numbered `.sql` files, sorted by name. */
export function orderedMigrationFiles(fileNames: string[]): string[] {
	return fileNames.filter((name) => /^\d+.*\.sql$/.test(name)).sort();
}

/** Files not yet recorded as applied, in apply order. */
export function pendingMigrations(
	fileNames: string[],
	applied: ReadonlySet<string>,
): string[] {
	return orderedMigrationFiles(fileNames).filter((name) => !applied.has(name));
}

export type MigrationResult = { adopted: string[]; applied: string[] };

/**
 * Applies every pending migration, each in its own transaction, under an advisory lock. Throws on
 * the first failure, leaving that migration rolled back and later ones unapplied.
 */
export async function migrateDatabase(
	connectionString: string,
	log: (message: string) => void = console.log,
): Promise<MigrationResult> {
	const client = new pg.Client({ connectionString });
	await client.connect();
	try {
		await client.query("select pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);
		const adopted = await adoptExistingSchema(client);
		for (const name of adopted) log(`[migrate] Recorded ${name} as already applied`);

		const applied = new Set(
			(await client.query<{ name: string }>(`select name from ${MIGRATIONS_TABLE}`)).rows.map(
				(row) => row.name,
			),
		);
		const pending = pendingMigrations(await readdir(migrationsDirectory), applied);
		for (const name of pending) {
			const sql = await readFile(path.join(migrationsDirectory, name), "utf8");
			try {
				await client.query("BEGIN");
				await client.query(sql);
				await client.query(`insert into ${MIGRATIONS_TABLE} (name) values ($1)`, [name]);
				await client.query("COMMIT");
			} catch (error) {
				await client.query("ROLLBACK");
				throw new Error(
					`Migration ${name} failed and was rolled back: ${error instanceof Error ? error.message : String(error)}`,
					{ cause: error },
				);
			}
			log(`[migrate] Applied ${name}`);
		}
		if (pending.length === 0) log("[migrate] Database is up to date");
		return { adopted, applied: pending };
	} finally {
		await client.query("select pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]).catch(() => {});
		await client.end();
	}
}

/** Creates the tracking table and, the first time only, records migrations already present. */
async function adoptExistingSchema(client: pg.Client): Promise<string[]> {
	const tracked = await client.query(`select ${tableExists(MIGRATIONS_TABLE)} as present`);
	if (tracked.rows[0].present) return [];

	const adopted: string[] = [];
	await client.query("BEGIN");
	try {
		await client.query(
			`create table ${MIGRATIONS_TABLE} (name text primary key, applied_at timestamptz not null default now())`,
		);
		for (const [name, query] of Object.entries(PRESENT_BEFORE_TRACKING)) {
			const result = await client.query(`select (${query}) as present`);
			if (!result.rows[0].present) continue;
			await client.query(`insert into ${MIGRATIONS_TABLE} (name) values ($1)`, [name]);
			adopted.push(name);
		}
		await client.query("COMMIT");
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	}
	return adopted;
}
