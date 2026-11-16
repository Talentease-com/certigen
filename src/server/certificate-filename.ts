/** An ASCII-only, header-safe filename for a certificate PNG. */
export function certificateFilename(name: string): string {
	const safeName = name
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[^A-Za-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "")
		.slice(0, 80);
	return safeName ? `${safeName}_Certificate.png` : "Certificate.png";
}
