import { and, eq } from "drizzle-orm";
import { db } from "#/db";
import { workshops } from "#/db/schema";
import { WorkshopClient } from "./workshop-client";

export default async function WorkshopPage({
	params,
}: {
	params: Promise<{ code: string }>;
}) {
	const { code: rawCode } = await params;
	const requestedCode = decodeURIComponent(rawCode);
	const code = requestedCode.trim().toUpperCase();

	const workshopRow = await db.query.workshops.findFirst({
		where: and(eq(workshops.code, code), eq(workshops.isActive, true)),
	});

	const workshop = workshopRow
		? {
				id: workshopRow.id,
				code: workshopRow.code,
				title: workshopRow.title,
				date: workshopRow.date,
			}
		: null;

	return <WorkshopClient workshop={workshop} requestedCode={requestedCode} />;
}
