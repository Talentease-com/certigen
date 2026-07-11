import { and, eq } from "drizzle-orm";
import { db } from "#/db";
import { certificates, templates } from "#/db/schema";
import { generateCertId } from "#/server/services/certificate-gen";
import {
	renderCertificateById,
	type RenderedCertificate,
} from "#/server/services/certificate-render";
import { sendCertificateEmail } from "#/server/services/email";

export interface ServiceCertificateInput {
	templateName: string;
	recipient: {
		name: string;
		email: string;
	};
	certificate: {
		title: string;
		date: string;
	};
	source: {
		platform: string;
		courseId: string;
		tenantId: string;
		certificateId: string;
		idempotencyKey: string;
	};
}

export interface ServiceCertificateResult {
	certId: string;
	verifyUrl: string;
	downloadUrl: string;
	emailStatus: "pending" | "sent" | "failed";
}

function baseUrl() {
	return process.env.BASE_URL || "http://localhost:3000";
}

function normalizeEmail(email: string) {
	return email.toLowerCase();
}

function sourceExternalId(source: ServiceCertificateInput["source"]) {
	return `${source.tenantId}:${source.courseId}:${source.certificateId}`;
}

function toResponse(
	certId: string,
	emailStatus: ServiceCertificateResult["emailStatus"],
): ServiceCertificateResult {
	const origin = baseUrl();
	return {
		certId,
		verifyUrl: `${origin}/verify/${certId}`,
		downloadUrl: `${origin}/api/certificates/${certId}/download`,
		emailStatus,
	};
}

function assertSamePayload(
	existing: typeof certificates.$inferSelect,
	input: ServiceCertificateInput,
	templateId: string,
) {
	const expectedExternalId = sourceExternalId(input.source);
	const comparisons: Array<[unknown, unknown]> = [
		[existing.name, input.recipient.name],
		[existing.email, normalizeEmail(input.recipient.email)],
		[existing.certificateTitle, input.certificate.title],
		[existing.certificateDate, input.certificate.date],
		[existing.templateId, templateId],
		[existing.externalId, expectedExternalId],
	];

	if (comparisons.some(([left, right]) => left !== right)) {
		throw Object.assign(new Error("Idempotency key already used with different certificate data"), {
			status: 409,
		});
	}
}

async function loadTemplateByName(name: string) {
	const rows = await db
		.select()
		.from(templates)
		.where(eq(templates.name, name))
		.limit(2);

	if (rows.length === 0) {
		throw Object.assign(new Error(`Template not found: ${name}`), { status: 404 });
	}

	if (rows.length > 1) {
		throw Object.assign(new Error(`Template name is not unique: ${name}`), {
			status: 409,
		});
	}

	return rows[0];
}

/**
 * Emails a rendered certificate and tracks delivery status on the row
 * either way. The image is never persisted — rendered on demand by the
 * caller via renderCertificateById.
 */
async function sendAndTrackEmail(
	certId: string,
	rendered: RenderedCertificate,
): Promise<ServiceCertificateResult["emailStatus"]> {
	try {
		await sendCertificateEmail({
			to: rendered.email,
			participantName: rendered.name,
			workshopTitle: rendered.workshopTitle,
			workshopDate: rendered.workshopDate,
			imageBuffer: rendered.pngBuffer,
			verifyUrl: rendered.verifyUrl,
			certificateKind: "course",
		});

		await db
			.update(certificates)
			.set({ emailStatus: "sent", emailSentAt: new Date(), emailError: null })
			.where(eq(certificates.id, certId));

		return "sent";
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		await db
			.update(certificates)
			.set({ emailStatus: "failed", emailError: message })
			.where(eq(certificates.id, certId));

		return "failed";
	}
}

export async function createServiceCertificate(
	input: ServiceCertificateInput,
): Promise<ServiceCertificateResult> {
	const template = await loadTemplateByName(input.templateName);
	const email = normalizeEmail(input.recipient.email);

	const existing = await db.query.certificates.findFirst({
		where: and(
			eq(certificates.sourcePlatform, input.source.platform),
			eq(certificates.idempotencyKey, input.source.idempotencyKey),
		),
	});

	if (existing) {
		assertSamePayload(existing, input, template.id);

		if (existing.emailStatus === "sent") {
			return toResponse(existing.id, "sent");
		}

		const rendered = await renderCertificateById(existing.id);
		if (!rendered) {
			throw new Error("Failed to render certificate image.");
		}
		const status = await sendAndTrackEmail(existing.id, rendered);
		return toResponse(existing.id, status);
	}

	const certId = generateCertId();

	await db.insert(certificates).values({
		id: certId,
		templateId: template.id,
		sourcePlatform: input.source.platform,
		externalId: sourceExternalId(input.source),
		idempotencyKey: input.source.idempotencyKey,
		certificateTitle: input.certificate.title,
		certificateDate: input.certificate.date,
		name: input.recipient.name,
		email,
		emailStatus: "pending",
	});

	const rendered = await renderCertificateById(certId);
	if (!rendered) {
		throw new Error("Failed to render certificate image.");
	}

	const emailStatus = await sendAndTrackEmail(certId, rendered);
	return toResponse(certId, emailStatus);
}
