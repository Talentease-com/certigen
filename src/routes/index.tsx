import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/")({
	component: HomePage,
});

function HomePage() {
	const [code, setCode] = useState("");
	const [isNavigating, setIsNavigating] = useState(false);
	const [error, setError] = useState("");
	const navigate = useNavigate();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!code.trim()) return;

		setIsNavigating(true);
		setError("");

		try {
			await navigate({
				to: "/workshop/$code",
				params: { code: code.trim().toUpperCase() },
			});
		} catch (err: any) {
			console.error(err);
			setError("Unable to process request right now. Please try again.");
		} finally {
			setIsNavigating(false);
		}
	};

	return (
		<div className="min-h-screen flex flex-col">
			{/* Header */}
			<header className="w-full px-6 py-4">
				<div className="max-w-5xl mx-auto flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="text-2xl font-bold">
							<span className="text-[#F5A623]">talent</span>
							<span className="text-[#D0021B]">e</span>
							<span className="text-[#F5A623]">ase</span>
						</div>
						<span className="text-xs font-medium text-gray-400 tracking-wider uppercase hidden sm:block">
							Certigen
						</span>
					</div>
					<a
						href="/admin"
						className="text-sm text-gray-400 hover:text-[#F5A623] transition-colors"
					>
						Admin
					</a>
				</div>
			</header>

			{/* Main */}
			<main className="flex-1 flex items-center justify-center px-4 pb-20">
				<div className="w-full max-w-md animate-fade-in-up">
					{/* Hero */}
					<div className="text-center mb-10">
						<div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-50 text-[#D4900F] text-xs font-semibold tracking-wide uppercase mb-6">
							<span className="w-1.5 h-1.5 rounded-full bg-[#F5A623] animate-pulse-glow" />
							Certificate of Completion
						</div>
						<h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3 tracking-tight">
							Get Your Certificate
						</h1>
						<p className="text-gray-500 text-base leading-relaxed">
							Enter your workshop code to generate your certificate of
							completion from Talentease.
						</p>
					</div>

					{/* Form */}
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

					{/* Footer text */}
					<p className="text-center text-xs text-gray-400 mt-8">
						Talentease — Creating Tomorrow's Leaders Today
					</p>
				</div>
			</main>
		</div>
	);
}
