import { NextResponse } from "next/server";
import { z } from "zod";
import { count, eq } from "drizzle-orm";
import { db } from "#/db";
import { certificates, workshops } from "#/db/schema";
import { errorResponse, requireAdminFromRequest, zodErrorResponse } from "#/server/api-utils";

const updateWorkshopInput = z.object({
	title: z.string().optional(),
	date: z.string().optional(),
	templateId: z.string().optional(),
	isActive: z.boolean().optional(),
});

export async function PATCH(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		await requireAdminFromRequest(request);
		const { id } = await params;

		const parsed = updateWorkshopInput.safeParse(await request.json());
		if (!parsed.success) return zodErrorResponse(parsed.error);
		const data = parsed.data;

		const updates: Record<string, unknown> = {};
		if (data.title !== undefined) updates.title = data.title;
		if (data.date !== undefined) updates.date = data.date;
		if (data.templateId !== undefined) updates.templateId = data.templateId;
		if (data.isActive !== undefined) updates.isActive = data.isActive;

		await db.update(workshops).set(updates).where(eq(workshops.id, id));
		return NextResponse.json({ success: true });
	} catch (err) {
		return errorResponse(err);
	}
}

export async function DELETE(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		await requireAdminFromRequest(request);
		const { id } = await params;

		const [existing] = await db
			.select({ total: count() })
			.from(certificates)
			.where(eq(certificates.workshopId, id));

		if (existing.total > 0) {
			throw new Error(
				`Cannot delete: ${existing.total} certificate(s) have been issued for this workshop. Deactivate it instead.`,
			);
		}

		await db.delete(workshops).where(eq(workshops.id, id));
		return NextResponse.json({ success: true });
	} catch (err) {
		return errorResponse(err);
	}
}
