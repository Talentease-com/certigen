import { NextResponse } from "next/server";
import { z } from "zod";
import { count, eq } from "drizzle-orm";
import { db } from "#/db";
import { templates, workshops } from "#/db/schema";
import { deleteFile, saveTemplate } from "#/server/services/storage";
import { errorResponse, requireAdminFromRequest, zodErrorResponse } from "#/server/api-utils";

export const runtime = "nodejs";

const updateTemplateInput = z.object({
	name: z.string().optional(),
	placeholders: z.string().optional(),
	imageData: z.string().optional(),
	imageExt: z.string().optional(),
});

export async function PATCH(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		await requireAdminFromRequest(request);
		const { id } = await params;

		const parsed = updateTemplateInput.safeParse(await request.json());
		if (!parsed.success) return zodErrorResponse(parsed.error);
		const data = parsed.data;

		const updates: Record<string, unknown> = {};
		if (data.name !== undefined) updates.name = data.name;
		if (data.placeholders !== undefined) updates.placeholders = data.placeholders;

		if (data.imageData) {
			const buffer = Buffer.from(data.imageData, "base64");
			const ext = data.imageExt || ".png";
			updates.filePath = await saveTemplate(id, buffer, ext);
		}

		await db.update(templates).set(updates).where(eq(templates.id, id));
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

		const [refs] = await db
			.select({ total: count() })
			.from(workshops)
			.where(eq(workshops.templateId, id));

		if (refs.total > 0) {
			throw new Error(
				`Cannot delete: ${refs.total} workshop(s) use this template. Reassign them first.`,
			);
		}

		const template = await db.query.templates.findFirst({
			where: eq(templates.id, id),
		});

		if (template) {
			await deleteFile(template.filePath);
			await db.delete(templates).where(eq(templates.id, id));
		}

		return NextResponse.json({ success: true });
	} catch (err) {
		return errorResponse(err);
	}
}
