import { NextResponse } from "next/server";
import { z } from "zod";
import { and, count, eq } from "drizzle-orm";
import { db } from "#/db";
import { certificates, templates, workshops } from "#/db/schema";
import { generateCertId } from "#/server/services/certificate-gen";
import { renderCertificateById } from "#/server/services/certificate-render";
import { sendCertificateEmail } from "#/server/services/email";
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

		// 3. Confirm a template is configured (the render step will need it later)
		const template = workshop.templateId
			? await db.query.templates.findFirst({
					where: eq(templates.id, workshop.templateId),
				})
			: null;

		if (!template) {
			throw new Error("No template configured for this workshop.");
		}

		// 4. Record the certificate. No image is written to storage — it's
		// rendered on demand (see renderCertificateById) whenever it's needed.
		const certId = generateCertId();

		await db
			.insert(certificates)
			.values({
				id: certId,
				workshopId: workshop.id,
				name,
				email: email.toLowerCase(),
			})
			.onConflictDoUpdate({
				target: [certificates.email, certificates.workshopId],
				set: {
					id: certId,
					name,
					issuedAt: new Date(),
				},
			});

		// 5. Render once for the email attachment, then send (non-blocking)
		const rendered = await renderCertificateById(certId);
		if (!rendered) {
			throw new Error("Failed to render certificate image.");
		}

		sendCertificateEmail({
			to: email,
			participantName: rendered.name,
			workshopTitle: rendered.workshopTitle,
			workshopDate: rendered.workshopDate,
			imageBuffer: rendered.pngBuffer,
			verifyUrl: rendered.verifyUrl,
		}).catch((err) => {
			console.error("Failed to send certificate email:", err);
		});

		// 6. Return result
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
