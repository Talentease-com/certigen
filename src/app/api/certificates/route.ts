import { NextResponse } from "next/server";
import { z } from "zod";
import { and, count, eq } from "drizzle-orm";
import { db } from "#/db";
import { certificates, templates, workshops } from "#/db/schema";
import { generateCertId } from "#/server/services/certificate-gen";
import { renderCertificate } from "#/server/services/certificate-render";
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
		// rendered on demand (see certificate-render.ts) whenever it's needed.
		// The id is only a *proposed* id: on conflict (re-generating for the
		// same email+workshop), the existing row's id must be preserved —
		// otherwise previously issued verify links / QR codes would 404.
		const proposedCertId = generateCertId();

		const [certRow] = await db
			.insert(certificates)
			.values({
				id: proposedCertId,
				workshopId: workshop.id,
				templateId: template.id,
				certificateTitle: workshop.title,
				certificateDate: workshop.date,
				name,
				email: email.toLowerCase(),
				emailStatus: "pending",
				emailError: null,
			})
			.onConflictDoUpdate({
				target: [certificates.email, certificates.workshopId],
				set: {
					name,
					templateId: template.id,
					certificateTitle: workshop.title,
					certificateDate: workshop.date,
					emailStatus: "pending",
					emailError: null,
					issuedAt: new Date(),
				},
			})
			.returning();

		const certId = certRow.id;

		// 5. Render once for the email attachment, then send (non-blocking).
		// workshop/template are already loaded above, so render directly from
		// them instead of re-fetching cert/workshop/template inside
		// renderCertificateById.
		const rendered = await renderCertificate(certRow, workshop, template);
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
