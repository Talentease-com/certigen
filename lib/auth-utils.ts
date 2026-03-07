import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export async function getSession() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});
	return session;
}

export async function requireAdmin() {
	const session = await getSession();
	if (!session) {
		throw new Error("Unauthorized: not authenticated");
	}

	const adminIds = (process.env.ADMIN_USER_IDS || "")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);

	const isAdmin =
		session.user.role === "admin" || adminIds.includes(session.user.id);

	if (!isAdmin) {
		throw new Error("Unauthorized: not an admin");
	}

	return session;
}
