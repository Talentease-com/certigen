import { eq } from "drizzle-orm";
import { db } from "#/db";
import { certificates, templates, workshops } from "#/db/schema";
import { parseCertificateDesign } from "#/lib/certificate-design";
import { generateCertificateImage } from "./certificate-gen";
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
 * Certificates are never stored as files — only the (name, email, workshop,
 * issuedAt) row is persisted. The image is re-rendered on demand from the
 * workshop's template every time it's downloaded, previewed, or emailed.
 */
export async function renderCertificateById(
	certId: string,
): Promise<RenderedCertificate | null> {
	const cert = await db.query.certificates.findFirst({
		where: eq(certificates.id, certId),
	});
	if (!cert) return null;

	const workshop = await db.query.workshops.findFirst({
		where: eq(workshops.id, cert.workshopId),
	});
	if (!workshop) return null;

	const template = workshop.templateId
		? await db.query.templates.findFirst({
				where: eq(templates.id, workshop.templateId),
			})
		: null;
	if (!template) return null;

	const design = parseCertificateDesign(template.design);
	const baseUrl = process.env.BASE_URL || "http://localhost:3000";
	const verifyUrl = `${baseUrl}/verify/${cert.id}`;
	const templateBuffer = await readFile(template.filePath);

	const { pngBuffer } = await generateCertificateImage({
		templateBuffer,
		elements: design.elements,
		values: {
			name: cert.name,
			workshop_title: workshop.title,
			date: workshop.date,
		},
		verifyUrl,
		resolveAsset: readFile,
	});

	return {
		pngBuffer,
		filename: `${cert.name.replace(/\s+/g, "_")}_Certificate.png`,
		name: cert.name,
		email: cert.email,
		workshopTitle: workshop.title,
		workshopDate: workshop.date,
		verifyUrl,
	};
}
