import { NextResponse } from "next/server";
import { z } from "zod";
import { and, count, eq } from "drizzle-orm";
import { db } from "#/db";
import { certificates, templates, workshops } from "#/db/schema";
import {
	generateCertId,
	generateCertificateImage,
	type PlaceholderConfig,
} from "#/server/services/certificate-gen";
import { sendCertificateEmail } from "#/server/services/email";
import {
	getCertificateOutputDir,
	readFile,
	saveFile,
} from "#/server/services/storage";
import { errorResponse, zodErrorResponse } from "#/server/api-utils";

export const runtime = "nodejs";

const generateCertInput = z.object({
	name: z.string().min(1).max(100),
	email: z.string().email(),
	workshopCode: z.string().min(1),
});

export async function POST(request: Request) {
	const parsed = generateCertInput.safeParse(await request.json());
	if (!parsed.success) return zodErrorResponse(parsed.error);
	const { name, email, workshopCode } = parsed.data;

	try {
		// 1. Find workshop by code
		const workshop = await db.query.workshops.findFirst({
			where: and(
				eq(workshops.code, workshopCode),
				eq(workshops.isActive, true),
			),
		});

		if (!workshop) {
			throw new Error("Invalid or inactive workshop code.");
		}

		// 2. Check rate limit: max 2 certs per email per workshop
		const [existing] = await db
			.select({ total: count() })
			.from(certificates)
			.where(
				and(
					eq(certificates.email, email.toLowerCase()),
					eq(certificates.workshopId, workshop.id),
				),
			);

		if (existing.total >= 2) {
			throw new Error(
				"You have already generated the maximum of 2 certificates for this workshop.",
			);
		}

		// 3. Load template
		const template = workshop.templateId
			? await db.query.templates.findFirst({
					where: eq(templates.id, workshop.templateId),
				})
			: null;

		if (!template) {
			throw new Error("No template configured for this workshop.");
		}

		const placeholderConfigs: PlaceholderConfig[] = JSON.parse(
			template.placeholders,
		);

		// 4. Generate certificate
		const certId = generateCertId();
		const baseUrl = process.env.BASE_URL || "http://localhost:3000";
		const verifyUrl = `${baseUrl}/verify/${certId}`;
		const outputDir = getCertificateOutputDir(workshopCode);

		const values: Record<string, string> = {
			name,
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

		// 5. Save to DB
		await db
			.insert(certificates)
			.values({
				id: certId,
				workshopId: workshop.id,
				templateId: template.id,
				certificateTitle: workshop.title,
				certificateDate: workshop.date,
				name,
				email: email.toLowerCase(),
				filePath: fileKey,
				emailStatus: "pending",
				emailError: null,
			})
			.onConflictDoUpdate({
				target: [certificates.email, certificates.workshopId],
				set: {
					id: certId,
					name,
					filePath: fileKey,
					templateId: template.id,
					certificateTitle: workshop.title,
					certificateDate: workshop.date,
					emailStatus: "pending",
					emailError: null,
					issuedAt: new Date(),
				},
			});

		// 6. Send email (non-blocking)
		sendCertificateEmail({
			to: email,
			participantName: name,
			workshopTitle: workshop.title,
			workshopDate: workshop.date,
			imageBuffer: pngBuffer,
			verifyUrl,
		}).then(
			() =>
				db
					.update(certificates)
					.set({
						emailStatus: "sent",
						emailSentAt: new Date(),
						emailError: null,
					})
					.where(eq(certificates.id, certId)),
			(err) => {
				console.error("Failed to send certificate email:", err);
				return db
					.update(certificates)
					.set({
						emailStatus: "failed",
						emailError: err instanceof Error ? err.message : String(err),
					})
					.where(eq(certificates.id, certId));
			},
		);

		// 7. Return result
		const remainingAttempts = 2 - (existing.total + 1);
		return NextResponse.json({
			certId,
			downloadUrl: `/api/certificates/${certId}/download`,
			remainingAttempts,
		});
	} catch (err) {
		return errorResponse(err);
	}
}
