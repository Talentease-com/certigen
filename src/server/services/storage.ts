// @ts-ignore
import { useStorage } from "nitro/storage";

export async function ensureDirectories(): Promise<void> {
  // Nitro storage handles directory creation automatically with most drivers
}

export async function saveTemplate(
  id: string,
  buffer: Buffer,
  ext: string,
): Promise<string> {
  const key = `data:templates:${id}${ext}`;
  // @ts-ignore
  await useStorage().setItemRaw(key, buffer);
  return key;
}

export function getTemplatePath(id: string, ext: string): string {
  return `data:templates:${id}${ext}`;
}

export function getCertificateOutputDir(workshopCode: string): string {
  return `data:certificates:${workshopCode}`;
}

export async function saveFile(key: string, buffer: Buffer): Promise<void> {
  // @ts-ignore
  await useStorage().setItemRaw(key, buffer);
}

export async function readFile(key: string): Promise<Buffer> {
  // @ts-ignore
  const data = await useStorage().getItemRaw(key);
  if (!data) throw new Error(`File not found: ${key}`);
  return Buffer.from(data);
}

export async function fileExists(key: string): Promise<boolean> {
  // @ts-ignore
  return await useStorage().hasItem(key);
}

export async function deleteFile(key: string): Promise<void> {
  // @ts-ignore
  await useStorage().removeItem(key);
}
