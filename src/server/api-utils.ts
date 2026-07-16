import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { getBearerToken, requireAdmin, type ShooUser } from "./auth";

export function errorResponse(err: unknown, fallbackStatus = 400) {
	if (err instanceof Error) {
		const explicitStatus =
			"status" in err && typeof err.status === "number" ? err.status : null;
		const status =
			explicitStatus ??
			(err.message.toLowerCase().includes("unauthorized")
				? 401
				: fallbackStatus);
		return NextResponse.json({ error: err.message }, { status });
	}
	return NextResponse.json({ error: "Unknown error" }, { status: fallbackStatus });
}

export function zodErrorResponse(err: ZodError) {
	return NextResponse.json(
		{ error: err.issues[0]?.message ?? "Invalid request" },
		{ status: 400 },
	);
}

/** Verifies the request's Bearer token belongs to an admin, or throws a 401 JSON response. */
export async function requireAdminFromRequest(
	request: Request,
): Promise<ShooUser> {
	const token = getBearerToken(request);
	if (!token) {
		throw Object.assign(new Error("Unauthorized: missing token"), {
			status: 401,
		});
	}
	return requireAdmin(token);
}

export function requireServiceApiKeyFromRequest(request: Request): void {
	const expected = process.env.CERTIGEN_SERVICE_API_KEY;
	if (!expected) {
		throw Object.assign(new Error("Service API key is not configured"), {
			status: 500,
		});
	}

	const token = getBearerToken(request);
	if (!token || token !== expected) {
		throw Object.assign(new Error("Unauthorized: invalid service API key"), {
			status: 401,
		});
	}
}
