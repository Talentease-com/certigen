"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function HomeForm() {
	const [code, setCode] = useState("");
	const [isNavigating, setIsNavigating] = useState(false);
	const [error, setError] = useState("");
	const router = useRouter();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!code.trim()) return;

		setIsNavigating(true);
		setError("");

		try {
			router.push(`/workshop/${code.trim().toUpperCase()}`);
		} catch {
			setError("Unable to process request right now. Please try again.");
			setIsNavigating(false);
		}
	};

	return (
		<form onSubmit={handleSubmit}>
			<div className="glass-card rounded-2xl p-8">
				<label className="block mb-2 text-sm font-semibold text-gray-700">
					Workshop Code
				</label>
				<input
					type="text"
					value={code}
					onChange={(e) => setCode(e.target.value)}
					placeholder="e.g. WS-REACT-001"
					className="input-field mb-1 text-center text-lg tracking-widest uppercase"
					autoFocus
					required
				/>
				<p className="text-xs text-gray-400 mb-6 text-center">
					This code was shared with you at the end of the workshop.
				</p>

				{error && (
					<div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
						{error}
					</div>
				)}

				<button
					type="submit"
					className="btn-primary w-full text-base flex items-center justify-center gap-2"
					disabled={isNavigating || !code.trim()}
				>
					{isNavigating ? (
						<>
							<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
							Searching...
						</>
					) : (
						<>Continue &rarr;</>
					)}
				</button>
			</div>
		</form>
	);
}
