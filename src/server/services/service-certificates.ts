import { and, eq } from "drizzle-orm";
import { db } from "#/db";
import { certificates, templates } from "#/db/schema";
import {
	generateCertId,
	generateCertificateImage,
	type PlaceholderConfig,
} from "#/server/services/certificate-gen";
import { sendCertificateEmail } from "#/server/services/email";
import { readFile, saveFile } from "#/server/services/storage";

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

function serviceOutputDir(platform: string, idempotencyKey: string) {
	const safeKey = idempotencyKey.replace(/[^a-zA-Z0-9._-]/g, "_");
	return `certificates/service/${platform}/${safeKey}`;
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

async function generateAndSaveCertificate(
	input: ServiceCertificateInput,
	template: typeof templates.$inferSelect,
	certId: string,
) {
	const placeholderConfigs: PlaceholderConfig[] = JSON.parse(template.placeholders);
	const verifyUrl = `${baseUrl()}/verify/${certId}`;
	const templateBuffer = await readFile(template.filePath);

	const { pngBuffer } = await generateCertificateImage({
		templateBuffer,
		templateWidth: template.width,
		templateHeight: template.height,
		placeholders: placeholderConfigs,
		values: {
			name: input.recipient.name,
			workshop_title: input.certificate.title,
			date: input.certificate.date,
		},
		certId,
		verifyUrl,
	});

	const fileKey = `${serviceOutputDir(input.source.platform, input.source.idempotencyKey)}/${certId}.png`;
	await saveFile(fileKey, pngBuffer);
	return { pngBuffer, fileKey, verifyUrl };
}

async function sendAndTrackEmail(
	certId: string,
	input: ServiceCertificateInput,
	imageBuffer: Buffer,
	verifyUrl: string,
): Promise<ServiceCertificateResult["emailStatus"]> {
	try {
		await sendCertificateEmail({
			to: input.recipient.email,
			participantName: input.recipient.name,
			workshopTitle: input.certificate.title,
			workshopDate: input.certificate.date,
			imageBuffer,
			verifyUrl,
			certificateKind: "course",
		});

		await db
			.update(certificates)
			.set({
				emailStatus: "sent",
				emailSentAt: new Date(),
				emailError: null,
			})
			.where(eq(certificates.id, certId));

		return "sent";
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		await db
			.update(certificates)
			.set({
				emailStatus: "failed",
				emailError: message,
			})
			.where(eq(certificates.id, certId));

		return "failed";
	}
}

async function retryExistingEmail(
	existing: typeof certificates.$inferSelect,
	input: ServiceCertificateInput,
	template: typeof templates.$inferSelect,
) {
	let imageBuffer: Buffer;
	try {
		imageBuffer = await readFile(existing.filePath);
	} catch {
		const generated = await generateAndSaveCertificate(input, template, existing.id);
		imageBuffer = generated.pngBuffer;
		await db
			.update(certificates)
			.set({ filePath: generated.fileKey })
			.where(eq(certificates.id, existing.id));
	}

	return sendAndTrackEmail(
		existing.id,
		input,
		imageBuffer,
		`${baseUrl()}/verify/${existing.id}`,
	);
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
		const status =
			existing.emailStatus === "sent"
				? "sent"
				: await retryExistingEmail(existing, input, template);
		return toResponse(existing.id, status);
	}

	const certId = generateCertId();
	const { pngBuffer, fileKey, verifyUrl } = await generateAndSaveCertificate(
		input,
		template,
		certId,
	);

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
		filePath: fileKey,
		emailStatus: "pending",
	});

	const emailStatus = await sendAndTrackEmail(certId, input, pngBuffer, verifyUrl);
	return toResponse(certId, emailStatus);
}
