import sharp from "sharp";
import QRCode from "qrcode";
import { nanoid } from "nanoid";
import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";
import opentype from "opentype.js";

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

interface GenerateCertificateOptions {
  templatePath: string;
  templateWidth: number;
  templateHeight: number;
  placeholders: PlaceholderConfig[];
  values: Record<string, string>;
  certId: string;
  verifyUrl: string;
  outputDir: string;
}

function getFontPath(fontFamily: string): string | null {
  const map: Record<string, string> = {
    "Inter": "Inter-Regular.ttf",
    "Roboto": "Roboto-Regular.ttf",
    "Open Sans": "OpenSans-Regular.ttf",
    "Lato": "Lato-Regular.ttf",
    "Montserrat": "Montserrat-Regular.ttf",
    "Playfair Display": "PlayfairDisplay-Regular.ttf",
    "Merriweather": "Merriweather-Regular.ttf",
    "Great Vibes": "GreatVibes-Regular.ttf",
    "Dancing Script": "DancingScript-Regular.ttf",
    "Parisienne": "Parisienne-Regular.ttf",
    "Satisfy": "Satisfy-Regular.ttf",
    "Caveat": "Caveat-Regular.ttf",
  };
  const file = map[fontFamily];
  return file ? path.join(process.cwd(), "public", "fonts", file) : null;
}

const fontCache: Record<string, opentype.Font> = {};

function getFont(fontFamily: string): opentype.Font | null {
  if (fontCache[fontFamily]) return fontCache[fontFamily];
  const p = getFontPath(fontFamily);
  if (!p || !fs.existsSync(p)) return null;
  try {
    const f = opentype.loadSync(p);
    fontCache[fontFamily] = f;
    return f;
  } catch (err) {
    console.error(`Failed to load opentype font for ${fontFamily}:`, err);
    return null;
  }
}

function buildTextSvg(
  placeholder: PlaceholderConfig,
  value: string,
  canvasWidth: number,
): Buffer {
  const {
    x,
    y,
    fontSize,
    fontFamily,
    color,
    align,
    maxWidth,
  } = placeholder;

  const font = getFont(fontFamily);

  if (font) {
    const textWidth = font.getAdvanceWidth(value, fontSize);
    let dx = x;
    if (align === "center") {
      dx = maxWidth ? x + maxWidth / 2 - textWidth / 2 : canvasWidth / 2 - textWidth / 2;
    } else if (align === "right") {
      dx = maxWidth ? x + maxWidth - textWidth : canvasWidth - textWidth;
    }

    // Typical baseline is around ~1x to 1.5x font size down from the top inside a bounding box
    const yOffset = fontSize * 1.5;
    const pathObj = font.getPath(value, dx, yOffset, fontSize);
    const svgPathData = pathObj.toPathData(2);

    const svg = `<svg width="${canvasWidth}" height="${fontSize * 3}" xmlns="http://www.w3.org/2000/svg">
      <path d="${svgPathData}" fill="${color}" />
    </svg>`;
    return Buffer.from(svg);
  }

  // Fallback to standard SVG text if font not found or opentype fails
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

export async function generateCertificateImage(
  opts: GenerateCertificateOptions,
): Promise<{ pngPath: string; pdfPath: string }> {
  const {
    templatePath,
    templateWidth,
    templateHeight,
    placeholders,
    values,
    certId,
    verifyUrl,
    outputDir,
  } = opts;

  // Generate QR code as PNG buffer
  const qrBuffer = await QRCode.toBuffer(verifyUrl, {
    width: 280,
    margin: 1,
    color: { dark: "#333333", light: "#ffffff" },
    errorCorrectionLevel: "H",
  });

  // Build composite layers
  const composites: sharp.OverlayOptions[] = [];

  // Add text overlays
  for (const placeholder of placeholders) {
    const value = values[placeholder.key];
    if (!value) continue;

    const svgBuffer = buildTextSvg(placeholder, value, templateWidth);
    composites.push({
      input: svgBuffer,
      top: placeholder.y,
      left: placeholder.align === "center" ? 0 : placeholder.x,
    });
  }

  // Add QR code (bottom-right corner, with padding)
  composites.push({
    input: qrBuffer,
    top: templateHeight - 320,
    left: templateWidth - 320,
  });

  // Composite everything onto the template
  const pngBuffer = await sharp(templatePath)
    .composite(composites)
    .png({ quality: 90 })
    .toBuffer();

  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  // Save PNG
  const pngPath = path.join(outputDir, `${certId}.png`);
  fs.writeFileSync(pngPath, pngBuffer);

  // Generate PDF with the image as a full page (A4 landscape)
  const pdfPath = path.join(outputDir, `${certId}.pdf`);
  await new Promise<void>((resolve, reject) => {
    // A4 landscape: width=841.89pt, height=595.28pt
    const doc = new PDFDocument({
      size: [841.89, 595.28],
      margin: 0,
    });
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);
    doc.image(pngBuffer, 0, 0, { width: 841.89, height: 595.28 });
    doc.end();
    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  return { pngPath, pdfPath };
}

export function generateCertId(): string {
  return nanoid(12);
}
