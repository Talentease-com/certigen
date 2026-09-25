import { and, eq, inArray, lt, or } from "drizzle-orm";
import { db } from "#/db";
import { certificates, templates } from "#/db/schema";
import { generateCertId } from "#/server/services/certificate-gen";
import {
	renderCertificate,
} from "#/server/services/certificate-render";
import { sendCertificateEmail } from "#/server/services/email";
import {
	loadCurrentTemplateVersion,
	loadTemplateVersionById,
} from "#/server/services/template-versions";

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
	emailStatus: "pending" | "sending" | "sent" | "failed";
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
		downloadUrl: `${origin}/api/certificates/${certId}/file`,
		emailStatus,
	};
}

/** Retrieve an issued artifact without changing its recipient, award, or email state. */
export async function findServiceCertificate(
	platform: string,
	idempotencyKey: string,
): Promise<ServiceCertificateResult> {
	const existing = await db.query.certificates.findFirst({
		where: and(
			eq(certificates.sourcePlatform, platform),
			eq(certificates.idempotencyKey, idempotencyKey),
		),
	});
	if (!existing) {
		throw Object.assign(new Error("Certificate not found"), { status: 404 });
	}
	return toResponse(existing.id, existing.emailStatus as ServiceCertificateResult["emailStatus"]);
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

	const template = rows[0];
	const version = await loadCurrentTemplateVersion(template.id);
	if (!version) {
		throw new Error(`Template has no current version: ${name}`);
	}

	return { template, version };
}

/** Delivery is a separate, explicit operation on an already issued artifact. */
export async function deliverServiceCertificate(
	platform: string,
	idempotencyKey: string,
): Promise<ServiceCertificateResult> {
	const existing = await db.query.certificates.findFirst({
		where: and(eq(certificates.sourcePlatform, platform), eq(certificates.idempotencyKey, idempotencyKey)),
	});
	if (!existing) throw Object.assign(new Error("Certificate not found"), { status: 404 });
	if (existing.emailStatus === "sent") return toResponse(existing.id, "sent");
	// Claim before contacting the provider so concurrent requests cannot send twice.
	const [claimed] = await db.update(certificates)
		.set({ emailStatus: "sending", emailAttemptedAt: new Date(), emailError: null })
		.where(and(eq(certificates.id, existing.id), or(
			inArray(certificates.emailStatus, ["pending", "failed"]),
			and(eq(certificates.emailStatus, "sending"),
				lt(certificates.emailAttemptedAt, new Date(Date.now() - 2 * 60_000))),
		)))
		.returning({ id: certificates.id });
	if (!claimed) return toResponse(existing.id, existing.emailStatus as ServiceCertificateResult["emailStatus"]);
	try {
		const pinnedVersion = await loadTemplateVersionById(existing.templateVersionId);
		if (!pinnedVersion) throw new Error("Certificate template version not found.");
		const rendered = await renderCertificate(existing, null, pinnedVersion);
		if (!rendered) throw new Error("Failed to render certificate image.");
		await sendCertificateEmail({
			to: rendered.email,
			participantName: rendered.name,
			workshopTitle: rendered.workshopTitle,
			workshopDate: rendered.workshopDate,
			imageBuffer: rendered.pngBuffer,
			verifyUrl: rendered.verifyUrl,
			certificateKind: "course",
			idempotencyKey: `certificate:${existing.id}`,
		});

		await db
			.update(certificates)
			.set({ emailStatus: "sent", emailSentAt: new Date(), emailError: null })
			.where(eq(certificates.id, existing.id));

		return toResponse(existing.id, "sent");
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		await db
			.update(certificates)
			.set({ emailStatus: "failed", emailError: message })
			.where(eq(certificates.id, existing.id));

		return toResponse(existing.id, "failed");
	}
}

export async function createServiceCertificate(
	input: ServiceCertificateInput,
): Promise<ServiceCertificateResult> {
	const { template, version: currentVersion } = await loadTemplateByName(
		input.templateName,
	);
	const email = normalizeEmail(input.recipient.email);

	const existing = await db.query.certificates.findFirst({
		where: and(
			eq(certificates.sourcePlatform, input.source.platform),
			eq(certificates.idempotencyKey, input.source.idempotencyKey),
		),
	});

	if (existing) {
		assertSamePayload(existing, input, template.id);

		return toResponse(existing.id, existing.emailStatus as ServiceCertificateResult["emailStatus"]);
	}

	const certId = generateCertId();

	const [certRow] = await db
		.insert(certificates)
		.values({
			id: certId,
			templateId: template.id,
			templateVersionId: currentVersion.id,
			sourcePlatform: input.source.platform,
			externalId: sourceExternalId(input.source),
			idempotencyKey: input.source.idempotencyKey,
			certificateTitle: input.certificate.title,
			certificateDate: input.certificate.date,
			name: input.recipient.name,
			email,
			emailStatus: "pending",
		})
		.returning();

	return toResponse(certRow.id, "pending");
}
