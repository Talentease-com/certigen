import { eq } from "drizzle-orm";
import { db } from "#/db";
import { certificates, templateVersions, workshops } from "#/db/schema";
import { parseCertificateDesign } from "#/lib/certificate-design";
import { generateCertificateImage } from "./certificate-gen";
import { readFile } from "./storage";
import { loadTemplateVersionById } from "./template-versions";

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
type TemplateVersion = typeof templateVersions.$inferSelect;

/**
 * New certificates are rendered on demand from an immutable template version.
 * Migrated certificates may retain an exact historical image, handled by
 * renderCertificateById before it reaches this function.
 *
 * Renders from already-loaded records, so callers that already fetched the
 * cert/workshop/template (e.g. the generation route, right after inserting)
 * don't pay for three redundant round trips just to render once more.
 */
export async function renderCertificate(
	cert: Certificate,
	workshop: Workshop | null,
	version: TemplateVersion,
): Promise<RenderedCertificate | null> {
	const title = cert.certificateTitle ?? workshop?.title;
	const date = cert.certificateDate ?? workshop?.date;
	if (!title || !date) return null;

	const design = parseCertificateDesign(version.design);
	const baseUrl = process.env.BASE_URL || "http://localhost:3000";
	const verifyUrl = `${baseUrl}/verify/${cert.id}`;
	const templateBuffer = await readFile(version.filePath);

	const { pngBuffer } = await generateCertificateImage({
		templateBuffer,
		templateWidth: version.width,
		templateHeight: version.height,
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
 * Every certificate is pinned to an immutable template version. Editing a
 * template only creates a new current version for future certificates; it
 * cannot change an already-issued certificate.
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

	// Certificates migrated from the legacy system retain their original
	// image path. Prefer that immutable issued artifact when it still exists;
	// if storage is incomplete, fall back to the new on-demand renderer below.
	if (cert.legacyFilePath) {
		const title = cert.certificateTitle ?? workshop?.title;
		const date = cert.certificateDate ?? workshop?.date;
		if (title && date) {
			try {
				const baseUrl = process.env.BASE_URL || "http://localhost:3000";
				return {
					pngBuffer: await readFile(cert.legacyFilePath),
					filename: `${cert.name.replace(/\s+/g, "_")}_Certificate.png`,
					name: cert.name,
					email: cert.email,
					workshopTitle: title,
					workshopDate: date,
					verifyUrl: `${baseUrl}/verify/${cert.id}`,
				};
			} catch (error) {
				console.warn(
					`Legacy certificate image unavailable for ${cert.id}; rendering on demand.`,
					error,
				);
			}
		}
	}

	const version = await loadTemplateVersionById(cert.templateVersionId);
	if (!version) return null;

	return renderCertificate(cert, workshop ?? null, version);
}
