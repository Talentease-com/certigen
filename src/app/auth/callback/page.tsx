"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useShooAuth } from "@shoojs/react";

export default function AuthCallback() {
	const { handleCallback, clearIdentity } = useShooAuth({
		autoHandleCallback: false,
		autoSessionMonitor: false,
	});
	const router = useRouter();
	const started = useRef(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (started.current) return;
		started.current = true;

		handleCallback({ redirectTo: "/admin", fallbackPath: "/admin" })
			.then((token) => {
				if (!token) {
					throw new Error("The sign-in callback did not include an authorization code.");
				}
			})
			.catch((err) => {
				console.error("Auth callback failed:", err);
				clearIdentity();
				setError(err instanceof Error ? err.message : "Sign-in failed.");
			});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	if (error) {
		return (
			<div className="min-h-screen flex items-center justify-center px-4">
				<div className="glass-card rounded-2xl p-10 text-center max-w-sm animate-scale-in">
					<h1 className="text-xl font-bold text-gray-900 mb-2">Sign-in failed</h1>
					<p className="text-gray-500 text-sm mb-6">{error}</p>
					<button
						type="button"
						onClick={() => router.replace("/admin")}
						className="btn-primary"
					>
						Back to sign in
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen flex items-center justify-center">
			<div className="text-center animate-fade-in">
				<div className="w-8 h-8 border-3 border-[#F5A623]/30 border-t-[#F5A623] rounded-full animate-spin mx-auto mb-4" />
				<p className="text-gray-500 text-sm">Completing sign in...</p>
			</div>
		</div>
	);
}
