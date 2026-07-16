import sharp, { type OverlayOptions } from "sharp";
import QRCode from "qrcode";
import { nanoid } from "nanoid";

import path from "node:path";
import { createStorage } from "unstorage";
import fsDriver from "unstorage/drivers/fs-lite";
// Must use wildcard import — fontkit registers font formats (TTFFont, WOFFFont,
// etc.) as module-level side effects. Named imports cause bundlers to tree-shake
// those registrations, leaving create() unable to parse any format.
import * as fontkit from "fontkit";
import type { CertificateElement, TextElement } from "#/lib/certificate-design";

const fontsDir = path.join(process.cwd(), "public", "fonts");

const fontStorage = createStorage({
	driver: fsDriver({ base: fontsDir }),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- fontkit ships no types
const fontCache: Record<string, any> = {};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- fontkit ships no types
async function getFont(fontFamily: string): Promise<any | null> {
	if (fontCache[fontFamily]) return fontCache[fontFamily];

	const fileMap: Record<string, string> = {
		Inter: "Inter-Regular.ttf",
		Roboto: "Roboto-Regular.ttf",
		"Open Sans": "OpenSans-Regular.ttf",
		Lato: "Lato-Regular.ttf",
		Montserrat: "Montserrat-Regular.ttf",
		"Playfair Display": "PlayfairDisplay-Regular.ttf",
		Merriweather: "Merriweather-Regular.ttf",
		"Great Vibes": "GreatVibes-Regular.ttf",
		"Dancing Script": "DancingScript-Regular.ttf",
		Parisienne: "Parisienne-Regular.ttf",
		Satisfy: "Satisfy-Regular.ttf",
		Caveat: "Caveat-Regular.ttf",
	};

	const fileName = fileMap[fontFamily];
	if (!fileName) return null;

	try {
		const buffer = await fontStorage.getItemRaw(fileName);

		if (buffer) {
			const f = fontkit.create(Buffer.from(buffer as ArrayBuffer));
			fontCache[fontFamily] = f;
			return f;
		}

		return null;
	} catch (err) {
		console.error(`Failed to load font for ${fontFamily}:`, err);
		return null;
	}
}

/**
 * Renders a text element into its own SVG, sized to the element's box
 * (width × a height derived from font size), with the value aligned inside
 * that box. The result is composited at (el.x, el.y) — the box IS the
 * element, so what the editor shows is what gets drawn.
 *
 * `width` and `maxHeight` are the already-clamped-to-canvas dimensions (see
 * clampToCanvas) — a large fontSize can otherwise make the SVG taller than
 * the template itself, which sharp refuses to composite.
 */
async function buildTextSvg(
	el: TextElement,
	value: string,
	width: number,
	maxHeight: number,
): Promise<Buffer> {
	const { fontSize, fontFamily, color, align, opacity } = el;
	const svgHeight = Math.max(1, Math.min(Math.ceil(fontSize * 1.6), maxHeight));

	const font = await getFont(fontFamily);

	if (font) {
		// Use fontkit's layout engine for accurate text measurement
		const run = font.layout(value);
		const scale = fontSize / font.unitsPerEm;

		const textWidth =
			run.positions.reduce(
				(sum: number, pos: { xAdvance: number }) => sum + pos.xAdvance,
				0,
			) * scale;

		let dx = 0;
		if (align === "center") dx = width / 2 - textWidth / 2;
		else if (align === "right") dx = width - textWidth;

		const yOffset = fontSize;

		// Build combined SVG path from all glyphs. Glyph paths are in font
		// units with y-up, so: position at advance offset, scale to font size,
		// flip Y (font y-up → SVG y-down), then translate into the box.
		let svgPaths = "";
		let curX = 0;
		for (let i = 0; i < run.glyphs.length; i++) {
			const glyph = run.glyphs[i];
			const pos = run.positions[i];
			const glyphPath = glyph.path;

			if (glyphPath.commands.length > 0) {
				const transformed = glyphPath
					.translate(curX + pos.xOffset, pos.yOffset)
					.scale(scale, -scale)
					.translate(dx, yOffset);

				const pathData = transformed.toSVG();
				if (pathData) {
					svgPaths += `<path d="${pathData}" fill="${color}" fill-opacity="${opacity}" />`;
				}
			}
			curX += pos.xAdvance;
		}

		return Buffer.from(
			`<svg width="${width}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">${svgPaths}</svg>`,
		);
	}

	// Fallback to standard SVG text if the font file wasn't found
	let textAnchor = "start";
	let dx = 0;
	if (align === "center") {
		textAnchor = "middle";
		dx = width / 2;
	} else if (align === "right") {
		textAnchor = "end";
		dx = width;
	}

	const escapedValue = value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");

	return Buffer.from(
		`<svg width="${width}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
			<text x="${dx}" y="${fontSize}" font-size="${fontSize}px" font-family="'${fontFamily}', sans-serif" fill="${color}" fill-opacity="${opacity}" text-anchor="${textAnchor}" dominant-baseline="alphabetic">${escapedValue}</text>
		</svg>`,
	);
}

/** Scales down an overlay's alpha channel by `opacity` before compositing. */
async function applyOpacity(buffer: Buffer, opacity: number): Promise<Buffer> {
	if (opacity >= 1) return buffer;
	const mask = Buffer.from(
		`<svg><rect width="100%" height="100%" fill="black" fill-opacity="${opacity}"/></svg>`,
	);
	return sharp(buffer)
		.ensureAlpha()
		.composite([{ input: mask, blend: "dest-in" }])
		.png()
		.toBuffer();
}

/**
 * Clamps an element's box to fit inside the template canvas. Elements are
 * meant to stay within bounds (the editor's drag/resize already constrains
 * this), but this is the last line of defense: a template saved before that
 * guard existed, a manually-edited row, or simple float rounding must never
 * be able to crash generation — sharp refuses to composite an overlay that's
 * larger than the base image, so an unclamped element is a hard 500 for a
 * real person trying to get their certificate.
 */
function clampToCanvas(
	x: number,
	y: number,
	width: number,
	height: number,
	canvasWidth: number,
	canvasHeight: number,
) {
	const left = Math.min(Math.max(0, Math.round(x)), Math.max(0, canvasWidth - 1));
	const top = Math.min(Math.max(0, Math.round(y)), Math.max(0, canvasHeight - 1));
	const clampedWidth = Math.max(1, Math.min(Math.round(width), canvasWidth - left));
	const clampedHeight = Math.max(1, Math.min(Math.round(height), canvasHeight - top));
	return { left, top, width: clampedWidth, height: clampedHeight };
}

interface GenerateCertificateOptions {
	templateBuffer: Buffer;
	templateWidth: number;
	templateHeight: number;
	elements: CertificateElement[];
	values: Record<string, string>;
	verifyUrl: string;
	/** Fetches the raw bytes for an image element's `storageKey`. */
	resolveAsset: (storageKey: string) => Promise<Buffer>;
}

export async function generateCertificateImage(
	opts: GenerateCertificateOptions,
): Promise<{ pngBuffer: Buffer }> {
	const {
		templateBuffer,
		templateWidth,
		templateHeight,
		elements,
		values,
		verifyUrl,
		resolveAsset,
	} = opts;

	const composites: OverlayOptions[] = [];

	// zIndex controls paint order — lower first, higher on top.
	const ordered = [...elements].sort((a, b) => a.zIndex - b.zIndex);

	for (const el of ordered) {
		const { left, top, width, height } = clampToCanvas(
			el.x,
			el.y,
			el.width,
			el.height,
			templateWidth,
			templateHeight,
		);

		if (el.type === "text") {
			const value = el.boundTo ? values[el.boundTo] : el.content;
			if (!value) continue;
			const svgBuffer = await buildTextSvg(el, value, width, height);
			composites.push({ input: svgBuffer, top, left });
		} else if (el.type === "image") {
			const raw = await resolveAsset(el.storageKey);
			const resized = await sharp(raw)
				.resize(width, height, { fit: "fill" })
				.ensureAlpha()
				.png()
				.toBuffer();
			composites.push({
				input: await applyOpacity(resized, el.opacity),
				top,
				left,
			});
		} else if (el.type === "qr") {
			// Keep QR codes square even when the box got clamped unevenly.
			const size = Math.min(width, height);
			const qrBuffer = await QRCode.toBuffer(verifyUrl, {
				width: size,
				margin: 1,
				color: { dark: "#333333", light: "#ffffff" },
				errorCorrectionLevel: "H",
			});
			composites.push({
				input: await applyOpacity(qrBuffer, el.opacity),
				top,
				left,
			});
		}
	}

	const pngBuffer = await sharp(templateBuffer)
		.composite(composites)
		.png({ quality: 90 })
		.toBuffer();

	return { pngBuffer };
}

export function generateCertId(): string {
	return nanoid(12);
}
