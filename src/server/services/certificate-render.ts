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

type Certificate = typeof certificates.$inferSelect;
type Workshop = typeof workshops.$inferSelect;
type Template = typeof templates.$inferSelect;

/**
 * Certificates are never stored as files — only the DB row is persisted.
 * The image is re-rendered on demand every time it's downloaded, previewed,
 * or emailed.
 *
 * Renders from already-loaded records, so callers that already fetched the
 * cert/workshop/template (e.g. the generation route, right after inserting)
 * don't pay for three redundant round trips just to render once more.
 */
export async function renderCertificate(
	cert: Certificate,
	workshop: Workshop | null,
	template: Template,
): Promise<RenderedCertificate | null> {
	const title = cert.certificateTitle ?? workshop?.title;
	const date = cert.certificateDate ?? workshop?.date;
	if (!title || !date) return null;

	const design = parseCertificateDesign(template.design);
	const baseUrl = process.env.BASE_URL || "http://localhost:3000";
	const verifyUrl = `${baseUrl}/verify/${cert.id}`;
	const templateBuffer = await readFile(template.filePath);

	const { pngBuffer } = await generateCertificateImage({
		templateBuffer,
		templateWidth: template.width,
		templateHeight: template.height,
		elements: design.elements,
		values: {
			name: cert.name,
			workshop_title: title,
			date,
		},
		verifyUrl,
		resolveAsset: readFile,
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

/**
 * A certificate's title/date/template come from one of two places:
 *  - Workshop-issued certs (cert.workshopId set): derived from the workshop
 *    and its assigned template.
 *  - Service-issued certs (e.g. the Elevate integration — cert.workshopId
 *    null): stored directly on the certificate row (certificateTitle,
 *    certificateDate, templateId), since there's no workshop to derive them
 *    from.
 *
 * The certificate's own templateId always wins over the workshop's current
 * one — a workshop's assigned template can change after certificates have
 * already been issued against it, and re-renders (downloads, resend emails)
 * must keep using the template the certificate was actually generated with.
 * Only legacy rows without a stored templateId fall back to the workshop.
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

	const templateId = cert.templateId ?? workshop?.templateId;
	const template = templateId
		? await db.query.templates.findFirst({
				where: eq(templates.id, templateId),
			})
		: null;
	if (!template) return null;

	return renderCertificate(cert, workshop ?? null, template);
}
