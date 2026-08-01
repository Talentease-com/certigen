import { config } from "dotenv";
import pg from "pg";

config({ path: [".env.local", ".env"], quiet: true });

const SOURCE_DATABASE =
	process.env.MIGRATION_SOURCE_DATABASE ?? "neon_clone";
const TARGET_DATABASE =
	process.env.MIGRATION_TARGET_DATABASE ?? "nextjs_migrated";

type Row = Record<string, unknown>;

function databaseUrl(database: string): string {
	const configuredUrl = process.env.DATABASE_URL;
	if (!configuredUrl) {
		throw new Error("DATABASE_URL is required.");
	}

	const url = new URL(configuredUrl);
	url.pathname = `/${database}`;
	return url.toString();
}

function comparable(value: unknown): unknown {
	if (value instanceof Date) return value.toISOString();
	if (Array.isArray(value)) return value.map(comparable);
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, entry]) => [key, comparable(entry)]),
		);
	}
	return value;
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
	const actualJson = JSON.stringify(comparable(actual));
	const expectedJson = JSON.stringify(comparable(expected));
	if (actualJson !== expectedJson) {
		throw new Error(`${message}\nExpected: ${expectedJson}\nActual: ${actualJson}`);
	}
}

function expectedDesign(template: Row): Row {
	const placeholders = JSON.parse(String(template.placeholders)) as Array<{
		align?: "left" | "center" | "right";
		color?: string;
		fontFamily?: string;
		fontSize?: number;
		key: string;
		x?: number;
		y?: number;
	}>;
	const width = Number(template.width);
	const height = Number(template.height);

	return {
		elements: [
			...placeholders.map((placeholder, index) => {
				const fontSize = placeholder.fontSize ?? 48;
				return {
					id: `legacy-${index + 1}`,
					type: "text",
					boundTo: placeholder.key,
					content: "",
					x: placeholder.x ?? 0,
					y: (placeholder.y ?? 0) + fontSize / 2,
					width,
					height: fontSize * 2,
					rotation: 0,
					zIndex: index + 1,
					opacity: 1,
					fontFamily: placeholder.fontFamily ?? "Inter",
					fontSize,
					color: placeholder.color ?? "#333333",
					align: placeholder.align ?? "center",
				};
			}),
			{
				id: "legacy-qr",
				type: "qr",
				x: width - 320,
				y: height - 320,
				width: 280,
				height: 280,
				rotation: 0,
				zIndex: 999,
				opacity: 1,
			},
		],
	};
}

async function rows(client: pg.Client, sql: string): Promise<Row[]> {
	return (await client.query(sql)).rows;
}

async function run(): Promise<void> {
	const source = new pg.Client({
		connectionString: databaseUrl(SOURCE_DATABASE),
		options:
			"-c default_transaction_read_only=on -c statement_timeout=30000",
	});
	const target = new pg.Client({
		connectionString: databaseUrl(TARGET_DATABASE),
		options:
			"-c default_transaction_read_only=on -c statement_timeout=30000",
	});
	await Promise.all([source.connect(), target.connect()]);

	try {
		const [sourceReadOnly, targetReadOnly] = await Promise.all([
			source.query("SHOW transaction_read_only"),
			target.query("SHOW transaction_read_only"),
		]);
		assertEqual(sourceReadOnly.rows[0]?.transaction_read_only, "on", "Source is not read-only.");
		assertEqual(targetReadOnly.rows[0]?.transaction_read_only, "on", "Target comparison is not read-only.");

		const loadSourceRows = async () => ({
			templates: await rows(source, "SELECT * FROM templates ORDER BY id"),
			workshops: await rows(source, "SELECT * FROM workshops ORDER BY id"),
			certificates: await rows(source, "SELECT * FROM certificates ORDER BY id"),
		});
		const loadTargetRows = async () => ({
			templates: await rows(target, "SELECT * FROM templates ORDER BY id"),
			templateVersions: await rows(
				target,
				"SELECT * FROM template_versions ORDER BY template_id, version_number",
			),
			workshops: await rows(target, "SELECT * FROM workshops ORDER BY id"),
			certificates: await rows(target, "SELECT * FROM certificates ORDER BY id"),
		});
		const [sourceRows, targetRows] = await Promise.all([
			loadSourceRows(),
			loadTargetRows(),
		]);
		const {
			templates: sourceTemplates,
			workshops: sourceWorkshops,
			certificates: sourceCertificates,
		} = sourceRows;
		const {
			templates: targetTemplates,
			templateVersions: targetTemplateVersions,
			workshops: targetWorkshops,
			certificates: targetCertificates,
		} = targetRows;

		assertEqual(
			targetWorkshops,
			sourceWorkshops,
			"Workshop rows differ between source and target.",
		);

		const sourceTemplateById = new Map(
			sourceTemplates.map((template) => [String(template.id), template]),
		);
		const normalizedTargetTemplates = targetTemplates.map((template) => ({
			id: template.id,
			name: template.name,
			is_active: template.is_active,
			created_at: template.created_at,
		}));
		const normalizedSourceTemplates = sourceTemplates.map((template) => ({
			id: template.id,
			name: template.name,
			is_active: true,
			created_at: template.created_at,
		}));
		assertEqual(
			normalizedTargetTemplates,
			normalizedSourceTemplates,
			"Preserved template fields differ.",
		);

		assertEqual(
			targetTemplateVersions.length,
			sourceTemplates.length,
			"Initial template version count differs.",
		);
		for (const version of targetTemplateVersions) {
			const sourceTemplate = sourceTemplateById.get(String(version.template_id));
			if (!sourceTemplate) {
				throw new Error(
					`Unexpected target template version ${String(version.id)}.`,
				);
			}
			assertEqual(
				{
					id: version.id,
					template_id: version.template_id,
					version_number: version.version_number,
					file_path: version.file_path,
					width: version.width,
					height: version.height,
					is_current: version.is_current,
					design: JSON.parse(String(version.design)),
					created_at: version.created_at,
				},
				{
					id: `initial-${String(sourceTemplate.id)}`,
					template_id: sourceTemplate.id,
					version_number: 1,
					file_path: sourceTemplate.file_path,
					width: sourceTemplate.width,
					height: sourceTemplate.height,
					is_current: true,
					design: expectedDesign(sourceTemplate),
					created_at: sourceTemplate.created_at,
				},
				`Template ${String(version.template_id)} initial version differs.`,
			);
		}

		const targetCertificateById = new Map(
			targetCertificates.map((certificate) => [
				String(certificate.id),
				certificate,
			]),
		);
		const workshopById = new Map(
			sourceWorkshops.map((workshop) => [String(workshop.id), workshop]),
		);

		assertEqual(
			targetCertificates.length,
			sourceCertificates.length,
			"Certificate counts differ.",
		);
		for (const sourceCertificate of sourceCertificates) {
			const id = String(sourceCertificate.id);
			const targetCertificate = targetCertificateById.get(id);
			if (!targetCertificate) {
				throw new Error(`Certificate ${id} is missing from the target.`);
			}
			const workshop = workshopById.get(String(sourceCertificate.workshop_id));
			if (!workshop) {
				throw new Error(`Certificate ${id} references a missing source workshop.`);
			}

			assertEqual(
				{
					id: targetCertificate.id,
					workshop_id: targetCertificate.workshop_id,
					name: targetCertificate.name,
					email: targetCertificate.email,
					issued_at: targetCertificate.issued_at,
				},
				{
					id: sourceCertificate.id,
					workshop_id: sourceCertificate.workshop_id,
					name: sourceCertificate.name,
					email: sourceCertificate.email,
					issued_at: sourceCertificate.issued_at,
				},
				`Preserved certificate fields differ for ${id}.`,
			);
			assertEqual(
				{
					template_id: targetCertificate.template_id,
					template_version_id: targetCertificate.template_version_id,
					certificate_title: targetCertificate.certificate_title,
					certificate_date: targetCertificate.certificate_date,
					email_status: targetCertificate.email_status,
					email_sent_at: targetCertificate.email_sent_at,
					email_error: targetCertificate.email_error,
					legacy_file_path: targetCertificate.legacy_file_path,
					source_platform: targetCertificate.source_platform,
					external_id: targetCertificate.external_id,
					idempotency_key: targetCertificate.idempotency_key,
				},
				{
					template_id: workshop.template_id,
					template_version_id: `initial-${String(workshop.template_id)}`,
					certificate_title: workshop.title,
					certificate_date: workshop.date,
					email_status: "legacy_unknown",
					email_sent_at: null,
					email_error: null,
					legacy_file_path: sourceCertificate.file_path,
					source_platform: null,
					external_id: null,
					idempotency_key: null,
				},
				`Derived certificate fields differ for ${id}.`,
			);
		}

		const targetColumns = await rows(
			target,
			`SELECT table_name, column_name
			 FROM information_schema.columns
			 WHERE table_schema = 'public'
			 ORDER BY table_name, ordinal_position`,
		);
		const columnsByTable = Object.groupBy(targetColumns, (column) =>
			String(column.table_name),
		);
		assertEqual(
			columnsByTable.certificates
				?.map((column) => column.column_name)
				.sort(),
			[
				"certificate_date",
				"certificate_title",
				"email",
				"email_error",
				"email_sent_at",
				"email_status",
				"external_id",
				"id",
				"idempotency_key",
				"issued_at",
				"legacy_file_path",
				"name",
				"source_platform",
				"template_id",
				"template_version_id",
				"workshop_id",
			],
			"Target certificate schema differs.",
		);
		assertEqual(
			columnsByTable.templates?.map((column) => column.column_name).sort(),
			[
				"created_at",
				"id",
				"is_active",
				"name",
			],
			"Target template schema differs.",
		);
		assertEqual(
			columnsByTable.template_versions
				?.map((column) => column.column_name)
				.sort(),
			[
				"created_at",
				"design",
				"file_path",
				"height",
				"id",
				"is_current",
				"template_id",
				"version_number",
				"width",
			],
			"Target template version schema differs.",
		);

		const integrity = await target.query<{
			certificates_without_render_source: number;
			templates_without_one_current_version: number;
			invalid_designs: number;
			orphan_certificate_templates: number;
			orphan_certificate_versions: number;
			certificate_version_template_mismatches: number;
			orphan_certificate_workshops: number;
			orphan_workshop_templates: number;
		}>(`
			SELECT
				(SELECT count(*)::int
				 FROM certificates c
				 LEFT JOIN workshops w ON w.id = c.workshop_id
				 WHERE c.template_id IS NULL
				    OR c.template_version_id IS NULL
				    OR c.certificate_title IS NULL
				    OR c.certificate_date IS NULL
				    OR w.id IS NULL) AS certificates_without_render_source,
				(SELECT count(*)::int
				 FROM (
				 	SELECT t.id
				 	FROM templates t
				 	LEFT JOIN template_versions tv
				 		ON tv.template_id = t.id AND tv.is_current = true
				 	GROUP BY t.id
				 	HAVING count(tv.id) <> 1
				 ) invalid_current) AS templates_without_one_current_version,
				(SELECT count(*)::int
				 FROM template_versions
				 WHERE NOT (design::jsonb ? 'elements')
				    OR jsonb_typeof(design::jsonb->'elements') <> 'array') AS invalid_designs,
				(SELECT count(*)::int
				 FROM certificates c
				 LEFT JOIN templates t ON t.id = c.template_id
				 WHERE c.template_id IS NOT NULL AND t.id IS NULL) AS orphan_certificate_templates,
				(SELECT count(*)::int
				 FROM certificates c
				 LEFT JOIN template_versions tv ON tv.id = c.template_version_id
				 WHERE tv.id IS NULL) AS orphan_certificate_versions,
				(SELECT count(*)::int
				 FROM certificates c
				 JOIN template_versions tv ON tv.id = c.template_version_id
				 WHERE tv.template_id <> c.template_id) AS certificate_version_template_mismatches,
				(SELECT count(*)::int
				 FROM certificates c
				 LEFT JOIN workshops w ON w.id = c.workshop_id
				 WHERE c.workshop_id IS NOT NULL AND w.id IS NULL) AS orphan_certificate_workshops,
				(SELECT count(*)::int
				 FROM workshops w
				 LEFT JOIN templates t ON t.id = w.template_id
				 WHERE w.template_id IS NOT NULL AND t.id IS NULL) AS orphan_workshop_templates
		`);
		assertEqual(
			integrity.rows[0],
			{
				certificates_without_render_source: 0,
				templates_without_one_current_version: 0,
				invalid_designs: 0,
				orphan_certificate_templates: 0,
				orphan_certificate_versions: 0,
				certificate_version_template_mismatches: 0,
				orphan_certificate_workshops: 0,
				orphan_workshop_templates: 0,
			},
			"Target referential or render integrity checks failed.",
		);

		console.log(
			JSON.stringify(
				{
					sourceDatabase: SOURCE_DATABASE,
					targetDatabase: TARGET_DATABASE,
					counts: {
						certificates: sourceCertificates.length,
						templates: sourceTemplates.length,
						workshops: sourceWorkshops.length,
					},
					preservedRows: {
						certificates: sourceCertificates.length,
						templates: sourceTemplates.length,
						workshops: sourceWorkshops.length,
					},
					intentionalTransformations: {
						legacyCertificateFilePathsPreserved:
							sourceCertificates.length,
						certificateRenderSnapshotsBackfilled:
							targetCertificates.length,
						templateDesignsConverted: targetTemplates.length,
						immutableTemplateVersionsCreated:
							targetTemplateVersions.length,
						templatesMarkedActive: targetTemplates.length,
					},
					integrity: integrity.rows[0],
				},
				null,
				2,
			),
		);
	} finally {
		await Promise.all([source.end(), target.end()]);
	}
}

run().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
