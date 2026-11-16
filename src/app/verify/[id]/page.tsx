import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "#/db";
import { certificates, workshops } from "#/db/schema";
import { Logo } from "#/components/logo";
import { loadTemplateVersionById } from "#/server/services/template-versions";
import { CertificateImage } from "./certificate-image";

function baseUrl() {
	return process.env.BASE_URL || "http://localhost:3000";
}

function certificateImageUrls(id: string) {
	const image = `/api/certificates/${encodeURIComponent(id)}/image`;
	return {
		full: image,
		preview: `${image}?size=preview`,
		download: `/api/certificates/${encodeURIComponent(id)}/file`,
	};
}

function certificateImageAlt(cert: { name: string; workshopTitle: string }) {
	return `Certificate of completion for ${cert.name} — ${cert.workshopTitle}`;
}

async function getCertificate(id: string) {
	const cert = await db.query.certificates.findFirst({
		where: eq(certificates.id, id),
	});
	if (!cert) return null;

	const workshop = cert.workshopId
		? await db.query.workshops.findFirst({
				where: eq(workshops.id, cert.workshopId),
			})
		: null;

	// Template dimensions let the image reserve its space before it renders.
	const version = await loadTemplateVersionById(cert.templateVersionId);

	return {
		id: cert.id,
		name: cert.name,
		email: cert.email,
		workshopTitle: cert.certificateTitle ?? workshop?.title ?? "Unknown Certificate",
		workshopDate: cert.certificateDate ?? workshop?.date ?? "",
		issuedAt: cert.issuedAt.toISOString(),
		imageWidth: version?.width,
		imageHeight: version?.height,
	};
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ id: string }>;
}): Promise<Metadata> {
	const { id } = await params;
	const cert = await getCertificate(id);

	if (!cert) {
		return { title: "Certificate Not Found — Certigen" };
	}

	const shareTitle = `Certificate — ${cert.name}`;
	const shareDescription = `${cert.name} completed "${cert.workshopTitle}" on ${cert.workshopDate}. Issued by Talentease.`;
	const image = {
		url: `${baseUrl()}${certificateImageUrls(cert.id).preview}`,
		alt: certificateImageAlt(cert),
	};

	return {
		title: `Certificate — ${cert.name} | Certigen`,
		description: `Verified certificate of completion for ${cert.name} — ${cert.workshopTitle}`,
		openGraph: {
			title: shareTitle,
			description: shareDescription,
			images: [image],
		},
		twitter: {
			card: "summary_large_image",
			title: shareTitle,
			description: shareDescription,
			images: [image],
		},
	};
}

export default async function VerifyPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const cert = await getCertificate(id);

	if (!cert) {
		return (
			<div className="min-h-screen flex items-center justify-center px-4">
				<div className="glass-card rounded-2xl p-10 text-center max-w-md animate-scale-in">
					<div className="text-5xl mb-4">❌</div>
					<h2 className="text-xl font-bold text-gray-900 mb-2">
						Certificate Not Found
					</h2>
					<p className="text-gray-500 mb-6">
						This certificate ID is invalid or does not exist in our system.
					</p>
					<Link href="/" className="btn-primary">
						← Back to Home
					</Link>
				</div>
			</div>
		);
	}

	const urls = certificateImageUrls(cert.id);
	const issuedDate = new Date(cert.issuedAt).toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});

	return (
		<div className="min-h-screen flex flex-col">
			<header className="w-full px-6 py-4">
				<div className="max-w-5xl mx-auto flex items-center gap-3">
					<Logo />
				</div>
			</header>

			<main className="flex-1 flex items-center justify-center px-4 pb-20">
				<div className="w-full max-w-4xl animate-fade-in-up">
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

					<CertificateImage
						src={urls.preview}
						fullSizeHref={urls.full}
						alt={certificateImageAlt(cert)}
						width={cert.imageWidth}
						height={cert.imageHeight}
						downloadHref={urls.download}
					/>

					<div className="glass-card rounded-2xl overflow-hidden max-w-lg mx-auto">
						<h1 className="sr-only">Certificate of Completion</h1>

						<div className="p-8 space-y-5">
							<div className="text-center">
								<p className="text-sm text-gray-500 mb-1">Awarded to</p>
								<p className="text-2xl font-bold text-gray-900">{cert.name}</p>
							</div>

							<div className="h-px bg-gray-100" />

							<div className="grid grid-cols-2 gap-4">
								<div>
									<p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">
										Certificate
									</p>
									<p className="text-sm font-semibold text-gray-800">
										{cert.workshopTitle}
									</p>
								</div>
								<div>
									<p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">
										Completion Date
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
