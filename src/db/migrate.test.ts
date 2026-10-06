import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { migrationsDirectory, orderedMigrationFiles, pendingMigrations } from "./migrate";

describe("database migrations", () => {
	it("orders numbered SQL files and ignores everything else", () => {
		expect(
			orderedMigrationFiles([
				"0002_b.sql",
				"meta",
				"0000_a.sql",
				"README.md",
				"0010_c.sql",
				"0001_d.sql",
			]),
		).toEqual(["0000_a.sql", "0001_d.sql", "0002_b.sql", "0010_c.sql"]);
	});

	it("runs only migrations not yet recorded, in order", () => {
		expect(
			pendingMigrations(
				["0003_c.sql", "0000_a.sql", "0002_b.sql", "0001_x.sql"],
				new Set(["0000_a.sql", "0002_b.sql"]),
			),
		).toEqual(["0001_x.sql", "0003_c.sql"]);
	});

	it("finds the repository's migrations where the server reads them", () => {
		expect(orderedMigrationFiles(readdirSync(migrationsDirectory))).toEqual([
			"0000_service_certificates.sql",
			"0001_template_soft_delete_and_on_demand_rendering.sql",
			"0002_template_design_column.sql",
			"0003_immutable_template_versions.sql",
			"0004_service_email_attempt.sql",
		]);
	});
});
