import type { Metadata } from "next";
import { verifyCertificateData } from "@/actions/certificate-actions";
import Link from "next/link";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ id: string }>;
}): Promise<Metadata> {
	const { id } = await params;
	const cert = await verifyCertificateData(id);

	if (!cert) {
		return { title: "Certificate Not Found — Certigen" };
	}

	return {
		title: `Certificate — ${cert.name} | Certigen`,
		description: `Verified certificate of completion for ${cert.name} — ${cert.workshopTitle}`,
		openGraph: {
			title: `Certificate — ${cert.name}`,
			description: `${cert.name} completed "${cert.workshopTitle}" on ${cert.workshopDate}. Issued by Talentease.`,
		},
	};
}

export default async function VerifyPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const cert = await verifyCertificateData(id);

	if (!cert) {
		return (
			<div className="min-h-screen flex items-center justify-center px-4">
				<div className="glass-card rounded-2xl p-10 text-center max-w-md animate-scale-in">
					<div className="text-5xl mb-4">&#x274C;</div>
					<h2 className="text-xl font-bold text-gray-900 mb-2">
						Certificate Not Found
					</h2>
					<p className="text-gray-500 mb-6">
						This certificate ID is invalid or does not exist in our system.
					</p>
					<Link href="/" className="btn-primary">
						&larr; Back to Home
					</Link>
				</div>
			</div>
		);
	}

	const issuedDate = new Date(cert.issuedAt).toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});

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

			{/* Verification Card */}
			<main className="flex-1 flex items-center justify-center px-4 pb-20">
				<div className="w-full max-w-lg animate-fade-in-up">
					{/* Badge */}
					<div className="text-center mb-6">
						<span className="verified-badge">
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2.5"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
								<polyline points="22 4 12 14.01 9 11.01" />
							</svg>
							Verified Certificate
						</span>
					</div>

					{/* Card */}
					<div className="glass-card rounded-2xl overflow-hidden">
						{/* Gradient header */}
						<div className="bg-gradient-to-r from-[#F5A623] to-[#D0021B] px-8 py-6 text-center">
							<h1 className="text-2xl font-bold text-white mb-1">
								Certificate of Completion
							</h1>
							<p className="text-white/80 text-sm">Talentease</p>
						</div>

						{/* Details */}
						<div className="p-8 space-y-5">
							<div className="text-center">
								<p className="text-sm text-gray-500 mb-1">Awarded to</p>
								<p className="text-2xl font-bold text-gray-900">{cert.name}</p>
							</div>

							<div className="h-px bg-gray-100" />

							<div className="grid grid-cols-2 gap-4">
								<div>
									<p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">
										Workshop
									</p>
									<p className="text-sm font-semibold text-gray-800">
										{cert.workshopTitle}
									</p>
								</div>
								<div>
									<p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">
										Workshop Date
									</p>
									<p className="text-sm font-semibold text-gray-800">
										{cert.workshopDate}
									</p>
								</div>
								<div>
									<p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">
										Issued On
									</p>
									<p className="text-sm font-semibold text-gray-800">
										{issuedDate}
									</p>
								</div>
								<div>
									<p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">
										Certificate ID
									</p>
									<p className="text-sm font-mono font-semibold text-gray-800">
										{cert.id}
									</p>
								</div>
							</div>
						</div>
					</div>

					<p className="text-center text-xs text-gray-400 mt-6">
						This certificate was issued by Talentease and is digitally
						verifiable via QR code.
					</p>
				</div>
			</main>
		</div>
	);
}
