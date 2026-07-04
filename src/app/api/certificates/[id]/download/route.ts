import { eq } from "drizzle-orm";
import { db } from "#/db";
import { certificates } from "#/db/schema";
import { readFile } from "#/server/services/storage";
import { errorResponse } from "#/server/api-utils";

export const runtime = "nodejs";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;

	try {
		const cert = await db.query.certificates.findFirst({
			where: eq(certificates.id, id),
		});

		if (!cert) throw new Error("Certificate not found");

		const fileBuffer = await readFile(cert.filePath);
		return Response.json({
			base64: fileBuffer.toString("base64"),
			filename: `${cert.name.replace(/\s+/g, "_")}_Certificate.png`,
		});
	} catch (err) {
		return errorResponse(err, 404);
	}
}
