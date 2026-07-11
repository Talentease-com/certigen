import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "#/db";
import { certificates, workshops } from "#/db/schema";
import { errorResponse, requireAdminFromRequest } from "#/server/api-utils";

export async function GET(request: Request) {
	try {
		await requireAdminFromRequest(request);

		const url = new URL(request.url);
		const workshopId = url.searchParams.get("workshopId");

		let query = db
			.select({
				id: certificates.id,
				name: certificates.name,
				email: certificates.email,
				issuedAt: certificates.issuedAt,
				certificateTitle: certificates.certificateTitle,
				certificateDate: certificates.certificateDate,
				sourcePlatform: certificates.sourcePlatform,
				emailStatus: certificates.emailStatus,
				workshopTitle: workshops.title,
				workshopCode: workshops.code,
				workshopDate: workshops.date,
			})
			.from(certificates)
			.leftJoin(workshops, eq(certificates.workshopId, workshops.id))
			.orderBy(desc(certificates.issuedAt))
			.$dynamic();

		if (workshopId) {
			query = query.where(eq(certificates.workshopId, workshopId));
		}

		const rows = await query;
		return NextResponse.json({
			certificates: rows.map((row) => ({
				...row,
				workshopTitle:
					row.certificateTitle ?? row.workshopTitle ?? "Unknown Certificate",
				workshopCode: row.workshopCode ?? row.sourcePlatform ?? "service",
				workshopDate: row.certificateDate ?? row.workshopDate ?? "",
			})),
		});
	} catch (err) {
		return errorResponse(err);
	}
}
