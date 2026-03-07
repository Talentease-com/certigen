"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function WorkshopNotFound({
	requestedCode,
}: {
	requestedCode: string;
}) {
	const [searchCode, setSearchCode] = useState(requestedCode || "");
	const [isSearching, setIsSearching] = useState(false);
	const router = useRouter();

	const handleSearch = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!searchCode.trim()) return;
		setIsSearching(true);
		router.push(`/workshop/${searchCode.trim().toUpperCase()}`);
	};

	return (
		<div className="min-h-screen flex flex-col">
			<header className="w-full px-6 py-4">
				<div className="max-w-5xl mx-auto flex items-center gap-3">
					<Link
						href="/"
						className="text-2xl font-bold hover:opacity-80 transition-opacity"
					>
						<span className="text-[#F5A623]">talent</span>
						<span className="text-[#D0021B]">e</span>
						<span className="text-[#F5A623]">ase</span>
					</Link>
				</div>
			</header>
			<main className="flex-1 flex items-center justify-center px-4 pb-20">
				<div className="glass-card rounded-2xl p-10 text-center max-w-md w-full animate-scale-in">
					<div className="text-5xl mb-4">&#x1F50D;</div>
					<h2 className="text-xl font-bold text-gray-900 mb-2">
						Workshop Not Found
					</h2>
					<p className="text-gray-500 mb-8 text-sm">
						No active workshop found for <strong>{requestedCode}</strong>. Try
						another code?
					</p>
					<form onSubmit={handleSearch} className="text-left">
						<label className="block mb-2 text-sm font-semibold text-gray-700">
							Workshop Code
						</label>
						<input
							type="text"
							value={searchCode}
							onChange={(e) => setSearchCode(e.target.value)}
							placeholder="e.g. WS-REACT-001"
							className="input-field mb-4 text-center tracking-widest uppercase"
							required
						/>
						<button
							type="submit"
							className="btn-primary w-full flex items-center justify-center gap-2"
							disabled={isSearching || !searchCode.trim()}
						>
							{isSearching ? (
								<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
							) : null}
							Search Again
						</button>
					</form>
				</div>
			</main>
		</div>
	);
}
