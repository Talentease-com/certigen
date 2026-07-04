"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useShooAuth } from "@shoojs/react";

export default function AuthCallback() {
	const { handleCallback } = useShooAuth();
	const router = useRouter();

	useEffect(() => {
		handleCallback()
			.then(() => {
				router.push("/admin");
			})
			.catch((err) => {
				console.error("Auth callback failed:", err);
				router.push("/admin");
			});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<div className="min-h-screen flex items-center justify-center">
			<div className="text-center animate-fade-in">
				<div className="w-8 h-8 border-3 border-[#F5A623]/30 border-t-[#F5A623] rounded-full animate-spin mx-auto mb-4" />
				<p className="text-gray-500 text-sm">Completing sign in...</p>
			</div>
		</div>
	);
}
