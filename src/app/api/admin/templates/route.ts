import { NextResponse } from "next/server";
import sharp from "sharp";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "#/db";
import { templates, templateVersions } from "#/db/schema";
import { defaultDesign, serializeCertificateDesign } from "#/lib/certificate-design";
import { saveTemplateVersionBackground } from "#/server/services/storage";
import { errorResponse, requireAdminFromRequest, zodErrorResponse } from "#/server/api-utils";

export const runtime = "nodejs";

export async function GET(request: Request) {
	try {
		await requireAdminFromRequest(request);

		const rows = await db
			.select({
				id: templates.id,
				name: templates.name,
				width: templateVersions.width,
				height: templateVersions.height,
				design: templateVersions.design,
				isActive: templates.isActive,
				createdAt: templates.createdAt,
			})
			.from(templates)
			.innerJoin(
				templateVersions,
				and(
					eq(templateVersions.templateId, templates.id),
					eq(templateVersions.isCurrent, true),
				),
			)
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
});

export async function POST(request: Request) {
	try {
		await requireAdminFromRequest(request);

		const parsed = uploadTemplateInput.safeParse(await request.json());
		if (!parsed.success) return zodErrorResponse(parsed.error);
		const data = parsed.data;

		const id = nanoid(12);
		const versionId = nanoid(12);
		const buffer = Buffer.from(data.imageData, "base64");

		// The canvas must match the image's *actual* pixel size — assuming a
		// fixed size (e.g. A4 at 300dpi) regardless of what was uploaded is
		// what causes "Image to composite must have same dimensions or
		// smaller" the moment someone uploads anything else.
		const metadata = await sharp(buffer).metadata();
		const width = metadata.width;
		const height = metadata.height;
		if (!width || !height) {
			throw new Error("Could not read the uploaded image's dimensions.");
		}

		const filePath = await saveTemplateVersionBackground(
			id,
			versionId,
			buffer,
			data.imageExt,
		);

		// Give every new template a sensible starting layout (name / workshop
		// title / date / QR) so it's immediately usable; the admin can then
		// open the canvas editor to reposition things or add logos.
		const design = defaultDesign(width, height);

		await db.transaction(async (tx) => {
			await tx.insert(templates).values({
				id,
				name: data.name,
			});
			await tx.insert(templateVersions).values({
				id: versionId,
				templateId: id,
				versionNumber: 1,
				filePath,
				design: serializeCertificateDesign(design),
				width,
				height,
				isCurrent: true,
			});
		});

		return NextResponse.json({ id, name: data.name, width, height });
	} catch (err) {
		return errorResponse(err);
	}
}
