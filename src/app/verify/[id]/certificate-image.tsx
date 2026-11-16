"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The rendered certificate, linking to the full-size image, with a download
 * button. Hides itself (button included) if the image can't be rendered: the
 * verified details stand on their own, so a broken image must never make a
 * valid certificate look invalid.
 */
export function CertificateImage({
	src,
	fullSizeHref,
	downloadHref,
	alt,
	width,
	height,
}: {
	src: string;
	fullSizeHref: string;
	downloadHref: string;
	alt: string;
	width?: number;
	height?: number;
}) {
	const [failed, setFailed] = useState(false);
	const imgRef = useRef<HTMLImageElement>(null);

	// The image can fail before hydration attaches onError; catch that case.
	useEffect(() => {
		const img = imgRef.current;
		if (img?.complete && img.naturalWidth === 0) setFailed(true);
	}, []);

	if (failed) return null;

	return (
		<div className="mb-6">
			<a
				href={fullSizeHref}
				target="_blank"
				rel="noopener noreferrer"
				className="block glass-card rounded-2xl overflow-hidden p-2 sm:p-3"
				title="Open full-size certificate"
			>
				{/* eslint-disable-next-line @next/next/no-img-element -- already resized and CDN-cached by our own route */}
				<img
					ref={imgRef}
					src={src}
					alt={alt}
					width={width}
					height={height}
					onError={() => setFailed(true)}
					className="block w-full h-auto rounded-xl bg-gray-50"
				/>
			</a>
			<div className="flex justify-center mt-6">
				<a href={downloadHref} className="btn-secondary">
					Download PNG
				</a>
			</div>
		</div>
	);
}
