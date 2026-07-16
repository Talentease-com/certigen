import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "#/db";
import { templates } from "#/db/schema";
import { certificateElementSchema } from "#/lib/certificate-design";
import { generateCertificateImage } from "#/server/services/certificate-gen";
import { readFile } from "#/server/services/storage";
import { errorResponse, requireAdminFromRequest, zodErrorResponse } from "#/server/api-utils";

export const runtime = "nodejs";

const testPreviewInput = z.object({
	templateId: z.string(),
	elements: z.array(certificateElementSchema),
});

export async function POST(request: Request) {
	try {
		await requireAdminFromRequest(request);

		const parsed = testPreviewInput.safeParse(await request.json());
		if (!parsed.success) return zodErrorResponse(parsed.error);
		const data = parsed.data;

		const template = await db.query.templates.findFirst({
			where: eq(templates.id, data.templateId),
		});
		if (!template) throw new Error("Template not found");
		const templateBuffer = await readFile(template.filePath);

		const { pngBuffer } = await generateCertificateImage({
			templateBuffer,
			templateWidth: template.width,
			templateHeight: template.height,
			elements: data.elements,
			values: {
				name: "Jane Doe",
				workshop_title: "Sample Workshop Title",
				date: new Date().toLocaleDateString("en-US", {
					year: "numeric",
					month: "long",
					day: "numeric",
				}),
			},
			verifyUrl: "https://certify.talentease.com/verify/example",
			resolveAsset: readFile,
		});

		return NextResponse.json({ base64: pngBuffer.toString("base64") });
	} catch (err) {
		return errorResponse(err);
	}
}
