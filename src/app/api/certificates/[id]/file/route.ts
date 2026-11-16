import { eq } from "drizzle-orm";
import { db } from "#/db";
import { certificates } from "#/db/schema";
import { certificateFilename } from "#/server/certificate-filename";
import { renderCertificateById } from "#/server/services/certificate-render";

export const runtime = "nodejs";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	try {
		const rendered = await renderCertificateById(id);
		if (!rendered) {
			const exists = await db.query.certificates.findFirst({ where: eq(certificates.id, id) });
			return exists
				? new Response("Certificate file unavailable", { status: 500 })
				: new Response("Certificate not found", { status: 404 });
		}

		const filename = certificateFilename(rendered.name);
		return new Response(new Uint8Array(rendered.pngBuffer), {
			headers: {
				"Content-Type": "image/png",
				"Content-Disposition": `attachment; filename="${filename}"`,
				"Cache-Control": "private, no-store",
			},
		});
	} catch (error) {
		console.error("Certificate file unavailable", error);
		return new Response("Certificate file unavailable", { status: 500 });
	}
}
