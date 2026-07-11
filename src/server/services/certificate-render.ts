import { eq } from "drizzle-orm";
import { db } from "#/db";
import { certificates, templates, workshops } from "#/db/schema";
import {
	generateCertificateImage,
	type PlaceholderConfig,
} from "./certificate-gen";
import { readFile } from "./storage";

export interface RenderedCertificate {
	pngBuffer: Buffer;
	filename: string;
	name: string;
	email: string;
	workshopTitle: string;
	workshopDate: string;
	verifyUrl: string;
}

/**
 * Certificates are never stored as files — only the DB row is persisted.
 * The image is re-rendered on demand every time it's downloaded, previewed,
 * or emailed.
 *
 * A certificate's title/date/template come from one of two places:
 *  - Workshop-issued certs (cert.workshopId set): derived from the workshop
 *    and its assigned template.
 *  - Service-issued certs (e.g. the Elevate integration — cert.workshopId
 *    null): stored directly on the certificate row (certificateTitle,
 *    certificateDate, templateId), since there's no workshop to derive them
 *    from.
 */
export async function renderCertificateById(
	certId: string,
): Promise<RenderedCertificate | null> {
	const cert = await db.query.certificates.findFirst({
		where: eq(certificates.id, certId),
	});
	if (!cert) return null;

	const workshop = cert.workshopId
		? await db.query.workshops.findFirst({
				where: eq(workshops.id, cert.workshopId),
			})
		: null;

	const templateId = workshop?.templateId ?? cert.templateId;
	const template = templateId
		? await db.query.templates.findFirst({
				where: eq(templates.id, templateId),
			})
		: null;
	if (!template) return null;

	const title = cert.certificateTitle ?? workshop?.title;
	const date = cert.certificateDate ?? workshop?.date;
	if (!title || !date) return null;

	const placeholders: PlaceholderConfig[] = JSON.parse(template.placeholders);
	const baseUrl = process.env.BASE_URL || "http://localhost:3000";
	const verifyUrl = `${baseUrl}/verify/${cert.id}`;
	const templateBuffer = await readFile(template.filePath);

	const { pngBuffer } = await generateCertificateImage({
		templateBuffer,
		templateWidth: template.width,
		templateHeight: template.height,
		placeholders,
		values: {
			name: cert.name,
			workshop_title: title,
			date,
		},
		certId: cert.id,
		verifyUrl,
	});

	return {
		pngBuffer,
		filename: `${cert.name.replace(/\s+/g, "_")}_Certificate.png`,
		name: cert.name,
		email: cert.email,
		workshopTitle: title,
		workshopDate: date,
		verifyUrl,
	};
}
