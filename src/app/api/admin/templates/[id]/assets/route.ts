import { NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { readFile, saveTemplateAsset } from "#/server/services/storage";
import { errorResponse, requireAdminFromRequest, zodErrorResponse } from "#/server/api-utils";

export const runtime = "nodejs";

/**
 * Design assets (logos, signatures, seals) an admin adds as image elements
 * in the certificate editor. Stored alongside the template's background,
 * scoped under `templates/{id}/assets/...` so a GET here can be validated
 * against path traversal.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
	try {
		await requireAdminFromRequest(request);
		const { id } = await params;

		const key = new URL(request.url).searchParams.get("key");
		if (!key || !key.startsWith(`templates/${id}/assets/`)) {
			throw new Error("Invalid asset key");
		}

		const buffer = await readFile(key);
		return NextResponse.json({ base64: buffer.toString("base64") });
	} catch (err) {
		return errorResponse(err, 404);
	}
}

const uploadAssetInput = z.object({
	imageData: z.string(),
	imageExt: z.string().default(".png"),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
	try {
		await requireAdminFromRequest(request);
		const { id } = await params;

		const parsed = uploadAssetInput.safeParse(await request.json());
		if (!parsed.success) return zodErrorResponse(parsed.error);
		const data = parsed.data;

		const assetId = nanoid(10);
		const buffer = Buffer.from(data.imageData, "base64");
		const storageKey = await saveTemplateAsset(id, assetId, buffer, data.imageExt);

		return NextResponse.json({ storageKey });
	} catch (err) {
		return errorResponse(err);
	}
}
