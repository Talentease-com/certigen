import { NextResponse } from "next/server";
import { z } from "zod";
import { desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "#/db";
import { templates } from "#/db/schema";
import { defaultDesign, serializeCertificateDesign } from "#/lib/certificate-design";
import { saveTemplate } from "#/server/services/storage";
import { errorResponse, requireAdminFromRequest, zodErrorResponse } from "#/server/api-utils";

export const runtime = "nodejs";

export async function GET(request: Request) {
	try {
		await requireAdminFromRequest(request);

		const rows = await db
			.select({
				id: templates.id,
				name: templates.name,
				width: templates.width,
				height: templates.height,
				design: templates.design,
				isActive: templates.isActive,
				createdAt: templates.createdAt,
			})
			.from(templates)
			.orderBy(desc(templates.createdAt));

		return NextResponse.json({ templates: rows });
	} catch (err) {
		return errorResponse(err);
	}
}

const uploadTemplateInput = z.object({
	name: z.string().min(1),
	imageData: z.string(), // Base64
	imageExt: z.string().default(".png"),
	width: z.number().default(3508),
	height: z.number().default(2480),
});

export async function POST(request: Request) {
	try {
		await requireAdminFromRequest(request);

		const parsed = uploadTemplateInput.safeParse(await request.json());
		if (!parsed.success) return zodErrorResponse(parsed.error);
		const data = parsed.data;

		const id = nanoid(12);
		const buffer = Buffer.from(data.imageData, "base64");
		const filePath = await saveTemplate(id, buffer, data.imageExt);

		// Give every new template a sensible starting layout (name / workshop
		// title / date / QR) so it's immediately usable; the admin can then
		// open the canvas editor to reposition things or add logos.
		const design = defaultDesign(data.width, data.height);

		await db.insert(templates).values({
			id,
			name: data.name,
			filePath,
			design: serializeCertificateDesign(design),
			width: data.width,
			height: data.height,
		});

		return NextResponse.json({ id, name: data.name });
	} catch (err) {
		return errorResponse(err);
	}
}
