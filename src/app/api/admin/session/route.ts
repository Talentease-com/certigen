import { NextResponse } from "next/server";
import { errorResponse, requireAdminFromRequest } from "#/server/api-utils";

export async function GET(request: Request) {
	try {
		const user = await requireAdminFromRequest(request);
		return NextResponse.json({
			user: {
				id: user.pairwiseSub,
				name: user.name ?? null,
			},
		});
	} catch (err) {
		return errorResponse(err, 401);
	}
}
