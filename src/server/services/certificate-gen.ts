import sharp from "sharp";
import { encode } from "uqr";
import { nanoid } from "nanoid";
import { PDFDocument } from "pdf-lib";
import fs from "node:fs";
import path from "node:path";
// @ts-expect-error — subpath import targets ESM build; types come from @types/opentype.js
import opentype from "opentype.js/dist/opentype.module.js";
import { saveCertificateFile } from "./storage";

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
  templateBuffer: Buffer;
  templateWidth: number;
  templateHeight: number;
  placeholders: PlaceholderConfig[];
  values: Record<string, string>;
  certId: string;
  verifyUrl: string;
  workshopCode: string;
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

function generateQrSvg(
  url: string,
  size: number,
  darkColor: string,
  lightColor: string,
): string {
  const result = encode(url, { ecc: "H", border: 1 });
  const cellSize = size / result.size;
  let cells = "";
  for (let r = 0; r < result.size; r++) {
    for (let c = 0; c < result.size; c++) {
      if (result.data[r][c]) {
        cells += `<rect x="${c * cellSize}" y="${r * cellSize}" width="${cellSize}" height="${cellSize}" fill="${darkColor}"/>`;
      }
    }
  }
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" style="background:${lightColor}">${cells}</svg>`;
}

export async function generateCertificateImage(
  opts: GenerateCertificateOptions,
): Promise<{ pngStorageKey: string; pdfStorageKey: string }> {
  const {
    templateBuffer,
    templateWidth,
    templateHeight,
    placeholders,
    values,
    certId,
    verifyUrl,
    workshopCode,
  } = opts;

  // Generate QR code as PNG buffer via SVG → sharp
  const qrSvg = generateQrSvg(verifyUrl, 280, "#333333", "#ffffff");
  const qrBuffer = await sharp(Buffer.from(qrSvg))
    .resize(280, 280)
    .png()
    .toBuffer();

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
  const pngBuffer = await sharp(templateBuffer)
    .composite(composites)
    .png({ quality: 90 })
    .toBuffer();

  // Save PNG to storage
  const pngStorageKey = await saveCertificateFile(
    workshopCode,
    certId,
    ".png",
    pngBuffer,
  );

  // Generate PDF with the image as a full page (A4 landscape)
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([841.89, 595.28]);
  const pngImage = await pdfDoc.embedPng(pngBuffer);
  page.drawImage(pngImage, { x: 0, y: 0, width: 841.89, height: 595.28 });
  const pdfBytes = await pdfDoc.save();

  // Save PDF to storage
  const pdfStorageKey = await saveCertificateFile(
    workshopCode,
    certId,
    ".pdf",
    pdfBytes,
  );

  return { pngStorageKey, pdfStorageKey };
}

export function generateCertId(): string {
  return nanoid(12);
}
