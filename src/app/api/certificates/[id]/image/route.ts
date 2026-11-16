import { eq } from "drizzle-orm";
import sharp from "sharp";
import { db } from "#/db";
import { certificates } from "#/db/schema";
import { certificateFilename } from "#/server/certificate-filename";
import { renderCertificateById } from "#/server/services/certificate-render";

export const runtime = "nodejs";

// Issued certificates are pinned to an immutable template version, but render
// fixes (fonts, layout) should still reach cached copies within a day.
const CACHE_CONTROL = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400";

// Wide enough for a sharp on-page image and social previews, small enough to
// stay well under link-preview size limits.
const PREVIEW_WIDTH = 1600;

function unavailable() {
	return new Response("Certificate image unavailable", {
		status: 500,
		headers: { "Cache-Control": "no-store" },
	});
}

/**
 * Serves a certificate's PNG for display (inline, publicly cacheable), unlike
 * `/file`, which is a private attachment download. `?size=preview` returns a
 * downscaled copy for the verify page and link previews.
 */
export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	try {
		const rendered = await renderCertificateById(id);
		if (!rendered) {
			const exists = await db.query.certificates.findFirst({ where: eq(certificates.id, id) });
			return exists ? unavailable() : new Response("Certificate not found", { status: 404 });
		}

		const isPreview = new URL(request.url).searchParams.get("size") === "preview";
		const png = isPreview
			? await sharp(rendered.pngBuffer)
					.resize({ width: PREVIEW_WIDTH, withoutEnlargement: true })
					.png()
					.toBuffer()
			: rendered.pngBuffer;

		return new Response(new Uint8Array(png), {
			headers: {
				"Content-Type": "image/png",
				"Content-Disposition": `inline; filename="${certificateFilename(rendered.name)}"`,
				"Cache-Control": CACHE_CONTROL,
			},
		});
	} catch (error) {
		console.error("Certificate image unavailable", error);
		return unavailable();
	}
}
