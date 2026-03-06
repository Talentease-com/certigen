import {
	createFileRoute,
	Outlet,
	Link,
	useLocation,
} from "@tanstack/react-router";
import { useShooAuth } from "@shoojs/react";

export const Route = createFileRoute("/admin")({
	component: AdminLayout,
});

function AdminLayout() {
	const { identity, loading, signIn, clearIdentity } = useShooAuth();
	const location = useLocation();

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="text-center animate-fade-in">
					<div className="w-8 h-8 border-3 border-[#F5A623]/30 border-t-[#F5A623] rounded-full animate-spin mx-auto mb-4" />
					<p className="text-gray-500 text-sm">Loading...</p>
				</div>
			</div>
		);
	}

	if (!identity?.userId) {
		return (
			<div className="min-h-screen flex items-center justify-center px-4">
				<div className="glass-card rounded-2xl p-10 text-center max-w-sm animate-scale-in">
					<div className="text-4xl mb-4">🔐</div>
					<h2 className="text-xl font-bold text-gray-900 mb-2">Admin Access</h2>
					<p className="text-gray-500 text-sm mb-6">
						Sign in with your Google account to access the admin panel.
					</p>
					<button
						type="button"
						onClick={() => signIn()}
						className="btn-primary"
					>
						Sign in with Google
					</button>
					<div className="mt-4">
						<Link to="/" className="text-xs text-gray-400 hover:underline">
							← Back to Home
						</Link>
					</div>
				</div>
			</div>
		);
	}

	const navItems: Array<{ to: string; label: string; exact?: boolean }> = [
		{ to: "/admin", label: "Dashboard", exact: true },
		{ to: "/admin/workshops", label: "Workshops" },
		{ to: "/admin/templates", label: "Templates" },
	];

	return (
		<div className="min-h-screen flex flex-col">
			{/* Admin Header */}
			<header className="border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-40">
				<div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
					<div className="flex items-center gap-6">
						<Link
							to="/"
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
									? location.pathname === item.to
									: location.pathname.startsWith(item.to);
								return (
									<Link
										key={item.to}
										to={item.to}
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
							onClick={clearIdentity}
							className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
						>
							Sign out
						</button>
					</div>
				</div>
			</header>

			{/* Content */}
			<main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
				<Outlet />
			</main>
		</div>
	);
}
