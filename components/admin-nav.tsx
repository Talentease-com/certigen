"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

interface AdminNavProps {
	user: {
		id: string;
		name: string;
		email: string;
		image?: string | null;
	};
}

export function AdminNav({ user }: AdminNavProps) {
	const pathname = usePathname();
	const router = useRouter();

	const navItems = [
		{ href: "/admin", label: "Dashboard", exact: true },
		{ href: "/admin/workshops", label: "Workshops" },
		{ href: "/admin/templates", label: "Templates" },
	];

	const handleSignOut = async () => {
		await authClient.signOut();
		router.push("/");
		router.refresh();
	};

	return (
		<header className="border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-40">
			<div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
				<div className="flex items-center gap-6">
					<Link
						href="/"
						className="text-xl font-bold hover:opacity-80 transition-opacity"
					>
						<span className="text-[#F5A623]">talent</span>
						<span className="text-[#D0021B]">e</span>
						<span className="text-[#F5A623]">ase</span>
					</Link>
					<span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
						Admin
					</span>
				</div>
				<div className="flex items-center gap-4">
					<nav className="hidden sm:flex items-center gap-1">
						{navItems.map((item) => {
							const isActive = item.exact
								? pathname === item.href
								: pathname.startsWith(item.href);
							return (
								<Link
									key={item.href}
									href={item.href}
									className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
										isActive
											? "bg-orange-50 text-[#D4900F]"
											: "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
									}`}
								>
									{item.label}
								</Link>
							);
						})}
					</nav>
					<button
						type="button"
						onClick={handleSignOut}
						className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
					>
						Sign out
					</button>
				</div>
			</div>
		</header>
	);
}
