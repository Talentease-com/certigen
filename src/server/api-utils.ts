import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { getBearerToken, requireAdmin, type ShooUser } from "./auth";

export function errorResponse(err: unknown, fallbackStatus = 400) {
	if (err instanceof Error) {
		const status = err.message.toLowerCase().includes("unauthorized")
			? 401
			: fallbackStatus;
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
