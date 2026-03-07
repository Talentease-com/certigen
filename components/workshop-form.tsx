"use client";

import { useState } from "react";
import Link from "next/link";
import { generateCertificate } from "@/actions/certificate-actions";

interface Workshop {
	id: string;
	code: string;
	title: string;
	date: string;
}

export function WorkshopFormClient({ workshop }: { workshop: Workshop }) {
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [loading, setLoading] = useState(false);
	const [showConfirm, setShowConfirm] = useState(false);
	const [result, setResult] = useState<{
		certId: string;
		downloadUrl: string;
		remainingAttempts: number;
	} | null>(null);
	const [error, setError] = useState("");
	const [isDownloading, setIsDownloading] = useState(false);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setShowConfirm(true);
	};

	const handleConfirm = async () => {
		setShowConfirm(false);
		setLoading(true);
		setError("");

		try {
			const res = await generateCertificate({
				name: name.trim(),
				email: email.trim(),
				workshopCode: workshop.code,
			});
			setResult(res);
			setPreviewUrl(res.downloadUrl);
		} catch (err: unknown) {
			const message =
				err instanceof Error ? err.message : "Something went wrong.";
			setError(message);
		} finally {
			setLoading(false);
		}
	};

	const handleDownload = async () => {
		if (!result || isDownloading) return;
		setIsDownloading(true);
		try {
			const a = document.createElement("a");
			a.href = result.downloadUrl;
			a.download = `${name.replace(/\s+/g, "_")}_Certificate.png`;
			a.click();
		} catch {
			alert("Failed to download certificate");
		} finally {
			setIsDownloading(false);
		}
	};

	// Success state
	if (result) {
		return (
			<div className="min-h-screen py-10 px-4 flex flex-col items-center">
				<div className="w-full max-w-5xl mb-8 flex items-center justify-between">
					<Link
						href="/"
						className="text-2xl font-bold hover:opacity-80 transition-opacity"
					>
						<span className="text-[#F5A623]">talent</span>
						<span className="text-[#D0021B]">e</span>
						<span className="text-[#F5A623]">ase</span>
					</Link>
				</div>

				<div className="success-card max-w-2xl w-full animate-scale-in text-center p-8 border border-green-100 bg-white shadow-xl/10 shadow-green-900/10">
					<div className="text-5xl mb-4">&#x1F389;</div>
					<h2 className="text-2xl font-bold text-green-800 mb-2">
						Certificate Generated!
					</h2>
					<p className="text-green-700 mb-8 max-w-md mx-auto">
						We&apos;ve emailed a copy to <strong>{email}</strong>. You can also
						download it right here.
					</p>

					{/* Image Preview */}
					<div className="bg-gray-50 rounded-xl mb-8 relative flex items-center justify-center min-h-[300px] shadow-inner overflow-hidden border border-gray-100 p-2">
						{previewUrl ? (
							// eslint-disable-next-line @next/next/no-img-element
							<img
								src={previewUrl}
								alt="Certificate Preview"
								className="w-full h-auto rounded-lg shadow-sm block animate-fade-in"
							/>
						) : (
							<div className="flex flex-col items-center gap-3 text-gray-500">
								<div className="w-8 h-8 border-4 border-gray-300 border-t-green-500 rounded-full animate-spin" />
								<span className="text-sm font-medium">Loading preview...</span>
							</div>
						)}
					</div>

					<button
						type="button"
						onClick={handleDownload}
						disabled={isDownloading}
						className="btn-primary mb-4 w-full sm:w-auto px-8 py-3 flex items-center justify-center gap-2 mx-auto"
					>
						{isDownloading ? (
							<>
								<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
								Downloading...
							</>
						) : (
							<>&#x2B07; Download Image</>
						)}
					</button>

					{result.remainingAttempts > 0 && (
						<p className="text-sm text-green-600 mt-4">
							You have <strong>{result.remainingAttempts} attempt(s)</strong>{" "}
							remaining for this workshop.
						</p>
					)}
					{result.remainingAttempts === 0 && (
						<p className="text-sm text-amber-600 mt-4">
							&#x26A0;&#xFE0F; No attempts remaining. This was your last
							certificate for this workshop.
						</p>
					)}
					<div className="mt-8">
						<Link
							href="/"
							className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
						>
							&larr; Back to Home
						</Link>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen flex flex-col">
			{/* Header */}
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

			{/* Main */}
			<main className="flex-1 flex items-center justify-center px-4 pb-20">
				<div className="w-full max-w-lg animate-fade-in-up">
					{/* Workshop info */}
					<div className="text-center mb-6">
						<span className="inline-block px-3 py-1 rounded-full bg-orange-50 text-[#D4900F] text-xs font-semibold tracking-wider uppercase mb-4">
							{workshop.code}
						</span>
						<h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
							{workshop.title}
						</h1>
						<p className="text-gray-500 text-sm">{workshop.date}</p>
					</div>

					{/* Warning */}
					<div className="warning-banner mb-6">
						<span className="text-lg flex-shrink-0">&#x26A0;&#xFE0F;</span>
						<div>
							<strong className="block text-sm">Important</strong>
							You can generate a maximum of <strong>2 certificates</strong> per
							email for this workshop. Please double-check your name and email
							carefully before submitting.
						</div>
					</div>

					{/* Form */}
					<form onSubmit={handleSubmit}>
						<div className="glass-card rounded-2xl p-8">
							<div className="mb-5">
								<label className="block mb-1.5 text-sm font-semibold text-gray-700">
									Full Name
								</label>
								<input
									type="text"
									value={name}
									onChange={(e) => setName(e.target.value)}
									placeholder="As it should appear on the certificate"
									className="input-field"
									required
									minLength={2}
									maxLength={100}
								/>
							</div>

							<div className="mb-6">
								<label className="block mb-1.5 text-sm font-semibold text-gray-700">
									Email Address
								</label>
								<input
									type="email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									placeholder="your@email.com"
									className="input-field"
									required
								/>
								<p className="text-xs text-gray-400 mt-1.5">
									The certificate will be sent to this email.
								</p>
							</div>

							{error && (
								<div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
									{error}
								</div>
							)}

							<button
								type="submit"
								className="btn-primary w-full"
								disabled={loading || !name.trim() || !email.trim()}
							>
								{loading ? (
									<>
										<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
										Generating...
									</>
								) : (
									"Generate Certificate"
								)}
							</button>
						</div>
					</form>
				</div>
			</main>

			{/* Confirmation Modal */}
			{showConfirm && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in p-4">
					<div className="glass-card rounded-2xl p-8 max-w-md w-full animate-scale-in">
						<h3 className="text-lg font-bold text-gray-900 mb-4">
							Confirm Your Details
						</h3>
						<p className="text-sm text-gray-600 mb-4">
							Please verify the information below. The certificate will be
							generated with these exact details.
						</p>
						<div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-2">
							<div className="flex justify-between text-sm">
								<span className="text-gray-500">Name</span>
								<span className="font-semibold text-gray-900">{name}</span>
							</div>
							<div className="flex justify-between text-sm">
								<span className="text-gray-500">Email</span>
								<span className="font-semibold text-gray-900">{email}</span>
							</div>
							<div className="flex justify-between text-sm">
								<span className="text-gray-500">Workshop</span>
								<span className="font-semibold text-gray-900">
									{workshop.title}
								</span>
							</div>
						</div>
						<div className="flex gap-3">
							<button
								type="button"
								className="btn-secondary flex-1"
								onClick={() => setShowConfirm(false)}
							>
								Edit
							</button>
							<button
								type="button"
								className="btn-primary flex-1"
								onClick={handleConfirm}
							>
								Confirm & Generate
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
