import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useShooAuth } from "@shoojs/react";
import { useEffect } from "react";

export const Route = createFileRoute("/auth/callback")({
	component: AuthCallback,
});

function AuthCallback() {
	const { handleCallback, loading } = useShooAuth();
	const navigate = useNavigate();

	useEffect(() => {
		handleCallback()
			.then(() => {
				navigate({ to: "/admin" });
			})
			.catch((err) => {
				console.error("Auth callback failed:", err);
				navigate({ to: "/admin" });
			});
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
