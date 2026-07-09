"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useShooAuth } from "@shoojs/react";
import { Logo } from "#/components/logo";
import { ApiError, apiGet } from "#/lib/api-client";
import { useAuthStore } from "#/store/auth-store";

const navItems: Array<{ to: string; label: string; exact?: boolean }> = [
	{ to: "/admin", label: "Dashboard", exact: true },
	{ to: "/admin/workshops", label: "Workshops" },
	{ to: "/admin/templates", label: "Templates" },
];

type AuthorizationState = "idle" | "checking" | "authorized" | "denied" | "error";

export default function AdminLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const { identity, loading, signIn, clearIdentity } = useShooAuth();
	const pathname = usePathname();
	const setIdentity = useAuthStore((s) => s.setIdentity);
	const [authorization, setAuthorization] =
		useState<AuthorizationState>("idle");
	const [checkedToken, setCheckedToken] = useState<string | null>(null);
	const [authorizationError, setAuthorizationError] = useState<string | null>(
		null,
	);
	const [retryCount, setRetryCount] = useState(0);

	useEffect(() => {
		if (loading) return;

		if (!identity?.token || !identity.userId) {
			setIdentity({ token: null, userId: null });
			return;
		}

		let cancelled = false;
		setIdentity({ token: null, userId: null });

		void apiGet<{ user: { id: string; name: string | null } }>(
			"/api/admin/session",
			identity.token,
		)
			.then(() => {
				if (cancelled) return;
				setIdentity({ token: identity.token ?? null, userId: identity.userId });
				setCheckedToken(identity.token ?? null);
				setAuthorizationError(null);
				setAuthorization("authorized");
			})
			.catch((err) => {
				if (cancelled) return;

				if (err instanceof ApiError && err.status === 401) {
					clearIdentity();
					setCheckedToken(null);
					setAuthorization("idle");
					return;
				}

				if (err instanceof ApiError && err.status === 403) {
					setCheckedToken(identity.token ?? null);
					setAuthorization("denied");
					return;
				}

				setCheckedToken(identity.token ?? null);
				setAuthorizationError(
					err instanceof Error ? err.message : "Unable to verify admin access.",
				);
				setAuthorization("error");
			});

		return () => {
			cancelled = true;
		};
	}, [
		clearIdentity,
		identity?.token,
		identity?.userId,
		loading,
		retryCount,
		setIdentity,
	]);

	const signOut = useCallback(() => {
		setIdentity({ token: null, userId: null });
		setCheckedToken(null);
		clearIdentity();
	}, [clearIdentity, setIdentity]);

	const authorizationForIdentity =
		identity?.token && checkedToken !== identity.token
			? "checking"
			: authorization;

	const retryAuthorization = () => {
		setCheckedToken(null);
		setRetryCount((count) => count + 1);
	};

	if (loading || authorizationForIdentity === "checking") {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="text-center animate-fade-in">
					<div className="w-8 h-8 border-3 border-[#F5A623]/30 border-t-[#F5A623] rounded-full animate-spin mx-auto mb-4" />
					<p className="text-gray-500 text-sm">Loading...</p>
				</div>
			</div>
		);
	}

	if (!identity?.userId || !identity.token) {
		return (
			<div className="min-h-screen flex items-center justify-center px-4">
				<div className="glass-card rounded-2xl p-10 text-center max-w-sm animate-scale-in">
					<div className="text-4xl mb-4">🔐</div>
					<h2 className="text-xl font-bold text-gray-900 mb-2">Admin Access</h2>
					<p className="text-gray-500 text-sm mb-6">
						Sign in with your Google account to access the admin panel.
					</p>
					<button type="button" onClick={() => signIn()} className="btn-primary">
						Sign in with Google
					</button>
					<div className="mt-4">
						<Link href="/" className="text-xs text-gray-400 hover:underline">
							← Back to Home
						</Link>
					</div>
				</div>
			</div>
		);
	}

	if (authorizationForIdentity === "denied") {
		return (
			<div className="min-h-screen flex items-center justify-center px-4">
				<div className="glass-card rounded-2xl p-10 text-center max-w-sm animate-scale-in">
					<h1 className="text-xl font-bold text-gray-900 mb-2">Access denied</h1>
					<p className="text-gray-500 text-sm mb-6">
						You are signed in, but this identity is not registered as a Certigen
						administrator.
					</p>
					<div className="flex justify-center gap-3">
						<button
							type="button"
							onClick={signOut}
							className="btn-secondary"
						>
							Sign out
						</button>
						<button
							type="button"
							onClick={retryAuthorization}
							className="btn-primary"
						>
							Retry
						</button>
					</div>
				</div>
			</div>
		);
	}

	if (authorizationForIdentity === "error") {
		return (
			<div className="min-h-screen flex items-center justify-center px-4">
				<div className="glass-card rounded-2xl p-10 text-center max-w-sm animate-scale-in">
					<h1 className="text-xl font-bold text-gray-900 mb-2">
						Unable to verify access
					</h1>
					<p className="text-gray-500 text-sm mb-6">
						{authorizationError ?? "Try again in a moment."}
					</p>
					<div className="flex justify-center gap-3">
						<button type="button" onClick={signOut} className="btn-secondary">
							Sign out
						</button>
						<button
							type="button"
							onClick={retryAuthorization}
							className="btn-primary"
						>
							Retry
						</button>
					</div>
				</div>
			</div>
		);
	}

	if (authorizationForIdentity !== "authorized") {
		return null;
	}

	return (
		<div className="min-h-screen flex flex-col">
			<header className="border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-40">
				<div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
					<div className="flex items-center gap-6">
						<Logo className="text-xl" />
						<span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
							Admin
						</span>
					</div>
					<div className="flex items-center gap-4">
						<nav className="hidden sm:flex items-center gap-1">
							{navItems.map((item) => {
								const isActive = item.exact
									? pathname === item.to
									: pathname.startsWith(item.to);
								return (
									<Link
										key={item.to}
										href={item.to}
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
							onClick={signOut}
							className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
						>
							Sign out
						</button>
					</div>
				</div>
			</header>

			<main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">{children}</main>
		</div>
	);
}
