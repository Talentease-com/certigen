import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "#/db";
import { templates } from "#/db/schema";
import { saveTemplate, readFile } from "#/server/services/storage";
import { errorResponse, requireAdminFromRequest, zodErrorResponse } from "#/server/api-utils";

export const runtime = "nodejs";

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		await requireAdminFromRequest(request);
		const { id } = await params;

		const template = await db.query.templates.findFirst({
			where: eq(templates.id, id),
		});
		if (!template) throw new Error("Template not found");

		const imageBuffer = await readFile(template.filePath);

		return NextResponse.json({
			template: {
				id: template.id,
				name: template.name,
				width: template.width,
				height: template.height,
				design: template.design,
				isActive: template.isActive,
			},
			backgroundBase64: imageBuffer.toString("base64"),
		});
	} catch (err) {
		return errorResponse(err, 404);
	}
}

const updateTemplateInput = z.object({
	name: z.string().optional(),
	design: z.string().optional(),
	imageData: z.string().optional(),
	imageExt: z.string().optional(),
	isActive: z.boolean().optional(),
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
		if (data.design !== undefined) updates.design = data.design;
		if (data.isActive !== undefined) updates.isActive = data.isActive;

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

/**
 * "Deleting" a template from the admin UI never removes the row — workshops
 * and certificates that already reference it must still be able to
 * re-render. This just flips `isActive` off so it drops out of selection
 * for new workshops.
 */
export async function DELETE(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		await requireAdminFromRequest(request);
		const { id } = await params;

		await db.update(templates).set({ isActive: false }).where(eq(templates.id, id));
		return NextResponse.json({ success: true });
	} catch (err) {
		return errorResponse(err);
	}
}
