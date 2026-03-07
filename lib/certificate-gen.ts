import sharp from "sharp";
import QRCode from "qrcode";
import { nanoid } from "nanoid";
import path from "node:path";
import fs from "node:fs";
// Must use wildcard import — fontkit registers font formats (TTFFont, WOFFFont,
// etc.) as module-level side effects. Named imports cause Rollup to tree-shake
// those registrations, leaving create() unable to parse any format.
import * as fontkit from "fontkit";

const fontsDir = path.join(process.cwd(), "fonts");

export interface PlaceholderConfig {
	key: string;
	x: number;
	y: number;
	fontSize: number;
	fontFamily: string;
	color: string;
	align: "left" | "center" | "right";
	maxWidth?: number;
}

// biome-ignore lint: fontkit types not available
const fontCache: Record<string, any> = {};

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getFont(fontFamily: string): Promise<any | null> {
	if (fontCache[fontFamily]) return fontCache[fontFamily];

	const fileName = fileMap[fontFamily];
	if (!fileName) return null;

	try {
		const fontPath = path.join(fontsDir, fileName);
		const buffer = fs.readFileSync(fontPath);
		const f = fontkit.create(buffer);
		fontCache[fontFamily] = f;
		return f;
	} catch (err) {
		console.error(`Failed to load font for ${fontFamily}:`, err);
		return null;
	}
}

async function buildTextSvg(
	placeholder: PlaceholderConfig,
	value: string,
	canvasWidth: number,
): Promise<Buffer> {
	const { x, fontSize, fontFamily, color, align, maxWidth } = placeholder;

	const font = await getFont(fontFamily);

	if (font) {
		const run = font.layout(value);
		const scale = fontSize / font.unitsPerEm;

		const textWidth =
			run.positions.reduce(
				(sum: number, pos: { xAdvance: number }) => sum + pos.xAdvance,
				0,
			) * scale;

		let dx = x;
		if (align === "center") {
			dx = maxWidth
				? x + maxWidth / 2 - textWidth / 2
				: canvasWidth / 2 - textWidth / 2;
		} else if (align === "right") {
			dx = maxWidth ? x + maxWidth - textWidth : canvasWidth - textWidth;
		}

		const yOffset = fontSize * 1.5;

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
					svgPaths += `<path d="${pathData}" fill="${color}" />`;
				}
			}
			curX += pos.xAdvance;
		}

		const svg = `<svg width="${canvasWidth}" height="${fontSize * 3}" xmlns="http://www.w3.org/2000/svg">
      ${svgPaths}
    </svg>`;
		return Buffer.from(svg);
	}

	// Fallback to standard SVG text if font not found
	let textAnchor = "start";
	let dx = x;
	if (align === "center") {
		textAnchor = "middle";
		dx = maxWidth ? x + maxWidth / 2 : canvasWidth / 2;
	} else if (align === "right") {
		textAnchor = "end";
		dx = maxWidth ? x + maxWidth : canvasWidth;
	}

	const escapedValue = value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");

	const svg = `<svg width="${canvasWidth}" height="${fontSize * 3}" xmlns="http://www.w3.org/2000/svg">
    <text
      x="${dx}"
      y="${fontSize * 1.5}"
      font-size="${fontSize}px"
      font-family="'${fontFamily}', sans-serif"
      fill="${color}"
      text-anchor="${textAnchor}"
      dominant-baseline="alphabetic"
    >${escapedValue}</text>
  </svg>`;

	return Buffer.from(svg);
}

interface GenerateCertificateOptions {
	templateBuffer: Buffer;
	templateWidth: number;
	templateHeight: number;
	placeholders: PlaceholderConfig[];
	values: Record<string, string>;
	certId: string;
	verifyUrl: string;
}

export async function generateCertificateImage(
	opts: GenerateCertificateOptions,
): Promise<{ pngBuffer: Buffer }> {
	const {
		templateBuffer,
		templateWidth,
		templateHeight,
		placeholders,
		values,
		verifyUrl,
	} = opts;

	const qrBuffer = await QRCode.toBuffer(verifyUrl, {
		width: 280,
		margin: 1,
		color: { dark: "#333333", light: "#ffffff" },
		errorCorrectionLevel: "H",
	});

	const composites: sharp.OverlayOptions[] = [];

	for (const placeholder of placeholders) {
		const value = values[placeholder.key];
		if (!value) continue;

		const svgBuffer = await buildTextSvg(placeholder, value, templateWidth);
		composites.push({
			input: svgBuffer,
			top: placeholder.y,
			left: placeholder.align === "center" ? 0 : placeholder.x,
		});
	}

	composites.push({
		input: qrBuffer,
		top: templateHeight - 320,
		left: templateWidth - 320,
	});

	const pngBuffer = await sharp(templateBuffer)
		.composite(composites)
		.png({ quality: 90 })
		.toBuffer();

	return { pngBuffer };
}

export function generateCertId(): string {
	return nanoid(12);
}
