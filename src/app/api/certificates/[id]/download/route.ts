import { renderCertificateById } from "#/server/services/certificate-render";
import { errorResponse } from "#/server/api-utils";

export const runtime = "nodejs";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;

	try {
		const rendered = await renderCertificateById(id);
		if (!rendered) throw new Error("Certificate not found");

		return Response.json({
			base64: rendered.pngBuffer.toString("base64"),
			filename: rendered.filename,
		});
	} catch (err) {
		return errorResponse(err, 404);
	}
}
