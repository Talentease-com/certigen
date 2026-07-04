import { NextResponse } from "next/server";
import { count } from "drizzle-orm";
import { db } from "#/db";
import { certificates, templates, workshops } from "#/db/schema";
import { errorResponse, requireAdminFromRequest } from "#/server/api-utils";

export async function GET(request: Request) {
	try {
		await requireAdminFromRequest(request);

		const [workshopCount] = await db.select({ total: count() }).from(workshops);
		const [certCount] = await db.select({ total: count() }).from(certificates);
		const [templateCount] = await db.select({ total: count() }).from(templates);

		return NextResponse.json({
			totalWorkshops: workshopCount.total,
			totalCertificates: certCount.total,
			totalTemplates: templateCount.total,
		});
	} catch (err) {
		return errorResponse(err);
	}
}
