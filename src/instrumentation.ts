/**
 * Runs once per server instance, before it serves requests. Applies pending database migrations so
 * a deploy never runs code against an older schema; a failed migration stops the server from
 * starting. Set CERTIGEN_AUTO_MIGRATE=false to skip it and run `pnpm db:migrate` yourself.
 */
export async function register() {
	if (process.env.NEXT_RUNTIME !== "nodejs") return;
	// `next build` also loads this file; building must not need or change the database.
	if (process.env.NEXT_PHASE === "phase-production-build") return;
	if (process.env.CERTIGEN_AUTO_MIGRATE === "false") return;

	const connectionString = process.env.DATABASE_URL;
	if (!connectionString) throw new Error("DATABASE_URL is required to apply migrations.");

	const { migrateDatabase } = await import("#/db/migrate");
	await migrateDatabase(connectionString);
}
