import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "#/db";
import { workshops } from "#/db/schema";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ code: string }> },
) {
	const { code: rawCode } = await params;
	const code = decodeURIComponent(rawCode).trim().toUpperCase();

	const workshop = await db.query.workshops.findFirst({
		where: and(eq(workshops.code, code), eq(workshops.isActive, true)),
	});

	if (!workshop) return NextResponse.json({ workshop: null });

	return NextResponse.json({
		workshop: {
			id: workshop.id,
			code: workshop.code,
			title: workshop.title,
			date: workshop.date,
		},
	});
}
