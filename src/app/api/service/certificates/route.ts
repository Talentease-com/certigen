import { NextResponse } from "next/server";
import { z } from "zod";
import {
	errorResponse,
	requireServiceApiKeyFromRequest,
	zodErrorResponse,
} from "#/server/api-utils";
import { createServiceCertificate, findServiceCertificate } from "#/server/services/service-certificates";

export const runtime = "nodejs";

const serviceCertificateInput = z.object({
	templateName: z.string().min(1),
	recipient: z.object({
		name: z.string().min(1).max(100),
		email: z.string().email(),
	}),
	certificate: z.object({
		title: z.string().min(1).max(200),
		date: z.string().min(1),
	}),
	source: z.object({
		platform: z.string().min(1).max(80),
		courseId: z.string().min(1).max(120),
		tenantId: z.string().min(1).max(120),
		certificateId: z.string().min(1).max(120),
		idempotencyKey: z.string().min(1).max(240),
	}),
});

const serviceCertificateLookup = z.object({
	platform: z.string().min(1).max(80),
	idempotencyKey: z.string().min(1).max(240),
});

export async function GET(request: Request) {
	try {
		requireServiceApiKeyFromRequest(request);
		const url = new URL(request.url);
		const parsed = serviceCertificateLookup.safeParse({
			platform: url.searchParams.get("platform"),
			idempotencyKey: url.searchParams.get("idempotencyKey"),
		});
		if (!parsed.success) return zodErrorResponse(parsed.error);
		return NextResponse.json(await findServiceCertificate(parsed.data.platform, parsed.data.idempotencyKey), {
			headers: { "Cache-Control": "no-store" },
		});
	} catch (err) {
		return errorResponse(err);
	}
}

export async function POST(request: Request) {
	try {
		requireServiceApiKeyFromRequest(request);

		const parsed = serviceCertificateInput.safeParse(await request.json());
		if (!parsed.success) return zodErrorResponse(parsed.error);

		const result = await createServiceCertificate(parsed.data);
		return NextResponse.json(result);
	} catch (err) {
		return errorResponse(err);
	}
}
