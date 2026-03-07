import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth-utils";
import { AdminNav } from "@/components/admin-nav";

export default async function AdminLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	let session;
	try {
		session = await requireAdmin();
	} catch {
		redirect("/");
	}

	return (
		<div className="min-h-screen flex flex-col">
			<AdminNav user={session.user} />
			<main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
				{children}
			</main>
		</div>
	);
}
