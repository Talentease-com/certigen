import { useStorage } from "nitro/storage";

function toBuffer(raw: Buffer | Uint8Array | unknown): Buffer {
  if (Buffer.isBuffer(raw)) return raw;
  if (raw instanceof Uint8Array) return Buffer.from(raw);
  if (raw && typeof raw === "object" && "0" in raw) {
    return Buffer.from(Object.values(raw as Record<string, number>));
  }
  throw new Error("Unexpected raw storage type");
}

export async function saveTemplate(
  id: string,
  buffer: Buffer,
  ext: string,
): Promise<string> {
  const key = `${id}${ext}`;
  const storage = useStorage("templates");
  await storage.setItemRaw(key, buffer);
  return `templates:${key}`;
}

export async function getTemplateBuffer(
  id: string,
  ext: string,
): Promise<Buffer> {
  const key = `${id}${ext}`;
  const storage = useStorage("templates");
  const raw = await storage.getItemRaw(key);
  return toBuffer(raw);
}

export async function saveCertificateFile(
  workshopCode: string,
  certId: string,
  ext: string,
  buffer: Buffer | Uint8Array,
): Promise<string> {
  const key = `${workshopCode}/${certId}${ext}`;
  const storage = useStorage("certificates");
  await storage.setItemRaw(key, Buffer.from(buffer));
  return `certificates:${key}`;
}

export async function readStorageFile(storageKey: string): Promise<Buffer> {
  const [mount, ...rest] = storageKey.split(":");
  const key = rest.join(":");
  const storage = useStorage(mount);
  const raw = await storage.getItemRaw(key);
  return toBuffer(raw);
}

export async function storageFileExists(storageKey: string): Promise<boolean> {
  const [mount, ...rest] = storageKey.split(":");
  const key = rest.join(":");
  const storage = useStorage(mount);
  return await storage.hasItem(key);
}

export async function deleteStorageFile(storageKey: string): Promise<void> {
  const [mount, ...rest] = storageKey.split(":");
  const key = rest.join(":");
  const storage = useStorage(mount);
  if (await storage.hasItem(key)) {
    await storage.removeItem(key);
  }
}
