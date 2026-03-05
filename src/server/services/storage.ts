import { createStorage } from "unstorage";
import s3Driver from "unstorage/drivers/s3";
import fsDriver from "unstorage/drivers/fs";

const isProd = process.env.NODE_ENV === "production";

// Create an unstorage instance. Fallback to process.env.CF_ACCOUNT_ID if S3_ENDPOINT is not provided.
const storage = createStorage({
  driver: isProd
    ? s3Driver({
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
        bucket: process.env.S3_BUCKET!,
        endpoint: process.env.S3_ENDPOINT || (process.env.CF_ACCOUNT_ID ? `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com` : ""),
        region: process.env.S3_REGION || "auto",
      })
    : fsDriver({
        base: "./data",
      }),
});

export async function ensureDirectories(): Promise<void> {
  // Nitro/Unstorage S3 driver handles directory paths automatically
}

export async function saveTemplate(
  id: string,
  buffer: Buffer,
  ext: string,
): Promise<string> {
  const key = `templates/${id}${ext}`;
  await storage.setItemRaw(key, buffer);
  return key;
}

export function getTemplatePath(id: string, ext: string): string {
  return `templates/${id}${ext}`;
}

export function getCertificateOutputDir(workshopCode: string): string {
  return `certificates/${workshopCode}`;
}

export async function saveFile(key: string, buffer: Buffer): Promise<void> {
  await storage.setItemRaw(key, buffer);
}

export async function readFile(key: string): Promise<Buffer> {
  const data = await storage.getItemRaw(key);
  if (!data) throw new Error(`File not found: ${key}`);
  return Buffer.from(data as any);
}

export async function fileExists(key: string): Promise<boolean> {
  return await storage.hasItem(key);
}

export async function deleteFile(key: string): Promise<void> {
  await storage.removeItem(key);
}
