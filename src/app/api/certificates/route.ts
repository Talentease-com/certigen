import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "#/db";
import { certificates, templates, workshops } from "#/db/schema";
import { generateCertId } from "#/server/services/certificate-gen";
import {
	renderCertificate,
	renderCertificateById,
	type RenderedCertificate,
} from "#/server/services/certificate-render";
import { sendCertificateEmail } from "#/server/services/email";
import { loadCurrentTemplateVersion } from "#/server/services/template-versions";
import { errorResponse, zodErrorResponse } from "#/server/api-utils";

export const runtime = "nodejs";

const generateCertInput = z.object({
	name: z.string().min(1).max(100),
	email: z.string().email(),
	workshopCode: z.string().min(1),
});

function queueCertificateEmail(
	certId: string,
	rendered: RenderedCertificate,
): void {
	sendCertificateEmail({
		to: rendered.email,
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
}

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

		// A repeated request is a resend, not a reissue. Preserve the original
		// participant data, template revision, issue timestamp, and verify URL.
		const normalizedEmail = email.toLowerCase();
		const existing = await db.query.certificates.findFirst({
			where: and(
				eq(certificates.email, normalizedEmail),
				eq(certificates.workshopId, workshop.id),
			),
		});
		if (existing) {
			const rendered = await renderCertificateById(existing.id);
			if (!rendered) throw new Error("Failed to render certificate image.");
			await db
				.update(certificates)
				.set({ emailStatus: "pending", emailError: null })
				.where(eq(certificates.id, existing.id));
			queueCertificateEmail(existing.id, rendered);
			return NextResponse.json({
				certId: existing.id,
				downloadUrl: `/api/certificates/${existing.id}/download`,
				remainingAttempts: 0,
				wasResent: true,
			});
		}

		// Confirm the logical template and its current immutable revision.
		const template = workshop.templateId
			? await db.query.templates.findFirst({
					where: eq(templates.id, workshop.templateId),
				})
			: null;

		if (!template) {
			throw new Error("No template configured for this workshop.");
		}
		const version = await loadCurrentTemplateVersion(template.id);
		if (!version) {
			throw new Error("Template has no current version.");
		}

		// Record the immutable revision used for this issuance.
		const proposedCertId = generateCertId();

		const [certRow] = await db
			.insert(certificates)
			.values({
				id: proposedCertId,
				workshopId: workshop.id,
				templateId: template.id,
				templateVersionId: version.id,
				certificateTitle: workshop.title,
				certificateDate: workshop.date,
				name,
				email: normalizedEmail,
				emailStatus: "pending",
				emailError: null,
			})
			.onConflictDoNothing({
				target: [certificates.email, certificates.workshopId],
			})
			.returning();

		// A concurrent request may have won the unique email/workshop insert.
		// Treat that exactly like any other resend.
		if (!certRow) {
			const raced = await db.query.certificates.findFirst({
				where: and(
					eq(certificates.email, normalizedEmail),
					eq(certificates.workshopId, workshop.id),
				),
			});
			if (!raced) throw new Error("Failed to create certificate.");
			const rendered = await renderCertificateById(raced.id);
			if (!rendered) throw new Error("Failed to render certificate image.");
			queueCertificateEmail(raced.id, rendered);
			return NextResponse.json({
				certId: raced.id,
				downloadUrl: `/api/certificates/${raced.id}/download`,
				remainingAttempts: 0,
				wasResent: true,
			});
		}

		const certId = certRow.id;
		const rendered = await renderCertificate(certRow, workshop, version);
		if (!rendered) {
			throw new Error("Failed to render certificate image.");
		}
		queueCertificateEmail(certId, rendered);

		return NextResponse.json({
			certId,
			downloadUrl: `/api/certificates/${certId}/download`,
			remainingAttempts: 1,
			wasResent: false,
		});
	} catch (err) {
		return errorResponse(err);
	}
}
