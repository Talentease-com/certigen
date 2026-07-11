import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "#/db";
import { certificates, workshops } from "#/db/schema";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;

	const cert = await db.query.certificates.findFirst({
		where: eq(certificates.id, id),
	});

	if (!cert) return NextResponse.json({ cert: null });

	const workshop = cert.workshopId
		? await db.query.workshops.findFirst({
				where: eq(workshops.id, cert.workshopId),
			})
		: null;

	return NextResponse.json({
		cert: {
			id: cert.id,
			name: cert.name,
			email: cert.email,
			workshopTitle:
				cert.certificateTitle ?? workshop?.title ?? "Unknown Certificate",
			workshopDate: cert.certificateDate ?? workshop?.date ?? "",
			issuedAt: cert.issuedAt.toISOString(),
		},
	});
}
