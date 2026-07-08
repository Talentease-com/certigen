import dotenv from "dotenv";
// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { eq, and } from "drizzle-orm";

// 
// Run with: npx tsx scripts/send-bulk-emails.ts scripts/participants.csv
// 

async function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

type ParticipantRecord = {
	email: string;
	name: string;
	code: string;
};

async function main() {
	const { db } = await import("../src/db");
	const { certificates, workshops, templates } = await import("../src/db/schema");
	const { generateCertificateImage, generateCertId } = await import("../src/server/services/certificate-gen");
	const { sendCertificateEmail } = await import("../src/server/services/email");
	const { getCertificateOutputDir, readFile, saveFile } = await import("../src/server/services/storage");

	const csvFilePath = process.argv[2];
	if (!csvFilePath) {
		console.error("Usage: npx tsx scripts/send-bulk-emails.ts <path-to-csv>");
		process.exit(1);
	}

	try {
		const csvContent = await fs.readFile(csvFilePath, "utf-8");
		const records = parse(csvContent, {
			columns: true,
			skip_empty_lines: true,
			trim: true,
			bom: true,
		}) as ParticipantRecord[];

		console.log(`Loaded ${records.length} records from CSV.`);

		for (let i = 0; i < records.length; i++) {
			const record = records[i];
			const { email, name, code: workshopCode } = record;

			if (!email || !name || !workshopCode) {
				console.error(`Skipping invalid record at row ${i + 2}:`, record);
				continue;
			}

			console.log(`[${i + 1}/${records.length}] Processing ${name} (${email}) for ${workshopCode}...`);

			try {
				// 1. Find workshop by code
				const workshop = await db.query.workshops.findFirst({
					where: and(
						eq(workshops.code, workshopCode),
						eq(workshops.isActive, true),
					),
				});

				if (!workshop) {
					console.error(`Workshop ${workshopCode} not found or inactive. Skipping.`);
					continue;
				}

				// 2. Load template
				const template = workshop.templateId
					? await db.query.templates.findFirst({
							where: eq(templates.id, workshop.templateId),
						})
					: null;

				if (!template) {
					console.error(`No template for workshop ${workshopCode}. Skipping.`);
					continue;
				}

				const placeholderConfigs = JSON.parse(template.placeholders);

				// 3. Generate certificate
				const certId = generateCertId();
				const baseUrl = "https://certigen.talentease.com";
				const verifyUrl = `${baseUrl}/verify/${certId}`;
				const outputDir = getCertificateOutputDir(workshopCode);

				const values: Record<string, string> = {
					name: name,
					workshop_title: workshop.title,
					date: workshop.date,
				};

				const templateBuffer = await readFile(template.filePath);

				const { pngBuffer } = await generateCertificateImage({
					templateBuffer,
					templateWidth: template.width,
					templateHeight: template.height,
					placeholders: placeholderConfigs,
					values,
					certId,
					verifyUrl,
				});

				const fileKey = `${outputDir}/${certId}.png`;
				await saveFile(fileKey, pngBuffer);

				// 4. Save to DB
				await db
					.insert(certificates)
					.values({
						id: certId,
						workshopId: workshop.id,
						name: name,
						email: email.toLowerCase(),
						filePath: fileKey,
					})
					.onConflictDoUpdate({
						target: [certificates.email, certificates.workshopId],
						set: {
							id: certId,
							name: name,
							filePath: fileKey,
							issuedAt: new Date(),
						},
					});

				// 5. Send email
				await sendCertificateEmail({
					to: email,
					participantName: name,
					workshopTitle: workshop.title,
					workshopDate: workshop.date,
					imageBuffer: pngBuffer,
					verifyUrl,
				});

				console.log(`Successfully sent email to ${email}`);

			} catch (err) {
				console.error(`Failed to process ${email}:`, err);
			}

			// Delay between emails
			if (i < records.length - 1) {
				await sleep(501);
			}
		}

		console.log("Bulk processing completed.");
		process.exit(0);
	} catch (err) {
		console.error("Critical error:", err);
		process.exit(1);
	}
}

main();
