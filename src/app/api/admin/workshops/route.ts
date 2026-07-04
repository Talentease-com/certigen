import { NextResponse } from "next/server";
import { z } from "zod";
import { desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "#/db";
import { workshops } from "#/db/schema";
import { errorResponse, requireAdminFromRequest, zodErrorResponse } from "#/server/api-utils";

export async function GET(request: Request) {
	try {
		await requireAdminFromRequest(request);

		const rows = await db
			.select({
				id: workshops.id,
				code: workshops.code,
				title: workshops.title,
				date: workshops.date,
				templateId: workshops.templateId,
				isActive: workshops.isActive,
				createdAt: workshops.createdAt,
			})
			.from(workshops)
			.orderBy(desc(workshops.createdAt));

		return NextResponse.json({ workshops: rows });
	} catch (err) {
		return errorResponse(err);
	}
}

const createWorkshopInput = z.object({
	code: z.string().min(1).max(50),
	title: z.string().min(1).max(200),
	date: z.string().min(1),
	templateId: z.string().min(1),
});

export async function POST(request: Request) {
	try {
		await requireAdminFromRequest(request);

		const parsed = createWorkshopInput.safeParse(await request.json());
		if (!parsed.success) return zodErrorResponse(parsed.error);
		const data = parsed.data;

		const id = nanoid(12);
		await db.insert(workshops).values({
			id,
			code: data.code.toUpperCase(),
			title: data.title,
			date: data.date,
			templateId: data.templateId,
		});

		return NextResponse.json({ id, code: data.code.toUpperCase() });
	} catch (err) {
		return errorResponse(err);
	}
}
