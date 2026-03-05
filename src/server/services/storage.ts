import fs from "node:fs";
import path from "node:path";

function getTemplatesDir(): string {
  return process.env.TEMPLATES_DIR || "./data/templates";
}

function getCertificatesDir(): string {
  return process.env.CERTIFICATES_DIR || "./data/certificates";
}

export function ensureDirectories(): void {
  fs.mkdirSync(getTemplatesDir(), { recursive: true });
  fs.mkdirSync(getCertificatesDir(), { recursive: true });
}

export function saveTemplate(
  id: string,
  buffer: Buffer,
  ext: string,
): string {
  const dir = getTemplatesDir();
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${id}${ext}`);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

export function getTemplatePath(id: string, ext: string): string {
  return path.join(getTemplatesDir(), `${id}${ext}`);
}

export function getCertificateOutputDir(workshopCode: string): string {
  const dir = path.join(getCertificatesDir(), workshopCode);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function readFile(filePath: string): Buffer {
  return fs.readFileSync(filePath);
}

export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

export function deleteFile(filePath: string): void {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
