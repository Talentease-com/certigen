import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireServiceApiKeyFromRequest, zodErrorResponse } from "#/server/api-utils";
import { deliverServiceCertificate } from "#/server/services/service-certificates";

export const runtime = "nodejs";

const input = z.object({
	platform: z.string().min(1).max(80),
	idempotencyKey: z.string().min(1).max(240),
});

export async function POST(request: Request) {
	try {
		requireServiceApiKeyFromRequest(request);
		const parsed = input.safeParse(await request.json());
		if (!parsed.success) return zodErrorResponse(parsed.error);
		return NextResponse.json(await deliverServiceCertificate(parsed.data.platform, parsed.data.idempotencyKey), {
			headers: { "Cache-Control": "no-store" },
		});
	} catch (error) {
		return errorResponse(error);
	}
}
