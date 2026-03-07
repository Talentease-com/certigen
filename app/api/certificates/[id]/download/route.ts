import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { certificates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { readFileStream } from "@/lib/storage";

export const maxDuration = 30;

export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;

	const cert = await db.query.certificates.findFirst({
		where: eq(certificates.id, id),
	});

	if (!cert) {
		return NextResponse.json(
			{ error: "Certificate not found" },
			{ status: 404 },
		);
	}

	const stream = await readFileStream(cert.filePath);
	const safeName = cert.name
		.replace(/[^\w\s-]/g, "")
		.replace(/\s+/g, "_");
	const filename = `${safeName}_Certificate.png`;
	const encodedFilename = encodeURIComponent(filename);

	return new Response(stream, {
		headers: {
			"Content-Type": "image/png",
			"Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
			"Cache-Control": "public, max-age=31536000, immutable",
		},
	});
}
