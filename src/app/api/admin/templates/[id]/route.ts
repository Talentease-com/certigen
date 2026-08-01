import { NextResponse } from "next/server";
import sharp from "sharp";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "#/db";
import { templates, templateVersions } from "#/db/schema";
import {
	parseCertificateDesignStrict,
	scaleCertificateDesign,
	serializeCertificateDesign,
} from "#/lib/certificate-design";
import {
	readFile,
	saveTemplateVersionBackground,
} from "#/server/services/storage";
import { loadCurrentTemplateVersion } from "#/server/services/template-versions";
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
		const version = await loadCurrentTemplateVersion(id);
		if (!version) throw new Error("Template has no current version");

		const imageBuffer = await readFile(version.filePath);

		return NextResponse.json({
			template: {
				id: template.id,
				name: template.name,
				width: version.width,
				height: version.height,
				design: version.design,
				isActive: template.isActive,
			},
			backgroundBase64: imageBuffer.toString("base64"),
		});
	} catch (err) {
		return errorResponse(err, 404);
	}
}

const updateTemplateInput = z.object({
	name: z.string().min(1).optional(),
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

		const existing = await db.query.templates.findFirst({
			where: eq(templates.id, id),
		});
		if (!existing) {
			throw Object.assign(new Error("Template not found"), { status: 404 });
		}
		const currentVersion = await loadCurrentTemplateVersion(id);
		if (!currentVersion) {
			throw new Error("Template has no current version");
		}

		const templateUpdates: Record<string, unknown> = {};
		if (data.name !== undefined) templateUpdates.name = data.name;
		if (data.isActive !== undefined) templateUpdates.isActive = data.isActive;
		const hasVisualChanges =
			data.design !== undefined || data.imageData !== undefined;

		if (!hasVisualChanges) {
			if (Object.keys(templateUpdates).length > 0) {
				await db
					.update(templates)
					.set(templateUpdates)
					.where(eq(templates.id, id));
			}
			return NextResponse.json({ success: true });
		}

		let design =
			data.design !== undefined
				? parseCertificateDesignStrict(data.design)
				: parseCertificateDesignStrict(currentVersion.design);
		let width = currentVersion.width;
		let height = currentVersion.height;
		let filePath = currentVersion.filePath;
		const versionId = nanoid(12);

		if (data.imageData) {
			const buffer = Buffer.from(data.imageData, "base64");
			const ext = data.imageExt || ".png";

			// Re-measure — a replacement image is very unlikely to share the
			// old image's exact pixel size, and a stale width/height is what
			// causes "must have same dimensions or smaller" at render time.
			const metadata = await sharp(buffer).metadata();
			if (!metadata.width || !metadata.height) {
				throw new Error("Could not read the uploaded image's dimensions.");
			}

			if (
				metadata.width !== currentVersion.width ||
				metadata.height !== currentVersion.height
			) {
				design = scaleCertificateDesign(
					design,
					{
						width: currentVersion.width,
						height: currentVersion.height,
					},
					{ width: metadata.width, height: metadata.height },
				);
			}

			width = metadata.width;
			height = metadata.height;
			filePath = await saveTemplateVersionBackground(
				id,
				versionId,
				buffer,
				ext,
			);
		}

		await db.transaction(async (tx) => {
			const retired = await tx
				.update(templateVersions)
				.set({ isCurrent: false })
				.where(
					and(
						eq(templateVersions.id, currentVersion.id),
						eq(templateVersions.isCurrent, true),
					),
				)
				.returning({ id: templateVersions.id });
			if (retired.length !== 1) {
				throw Object.assign(
					new Error("Template changed while you were editing; reload and try again."),
					{ status: 409 },
				);
			}

			await tx.insert(templateVersions).values({
				id: versionId,
				templateId: id,
				versionNumber: currentVersion.versionNumber + 1,
				filePath,
				design: serializeCertificateDesign(design),
				width,
				height,
				isCurrent: true,
			});
			if (Object.keys(templateUpdates).length > 0) {
				await tx
					.update(templates)
					.set(templateUpdates)
					.where(eq(templates.id, id));
			}
		});
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
