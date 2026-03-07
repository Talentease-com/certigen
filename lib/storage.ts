import {
	S3Client,
	PutObjectCommand,
	GetObjectCommand,
	DeleteObjectCommand,
	HeadObjectCommand,
} from "@aws-sdk/client-s3";
import fs from "node:fs/promises";
import path from "node:path";

const isProd = process.env.NODE_ENV === "production";

const s3Client = isProd
	? new S3Client({
			region: process.env.S3_REGION || "auto",
			endpoint:
				process.env.S3_ENDPOINT ||
				(process.env.CF_ACCOUNT_ID
					? `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`
					: undefined),
			credentials: {
				accessKeyId: process.env.S3_ACCESS_KEY_ID!,
				secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
			},
		})
	: null;

const LOCAL_BASE = path.join(process.cwd(), "data");

function assertSafeKey(key: string) {
	if (key.includes("..") || path.isAbsolute(key)) {
		throw new Error(`Invalid storage key: ${key}`);
	}
}

const CONTENT_TYPES: Record<string, string> = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
	".gif": "image/gif",
};

function getContentType(key: string): string {
	const ext = path.extname(key).toLowerCase();
	return CONTENT_TYPES[ext] || "application/octet-stream";
}

async function ensureLocalDir(filePath: string) {
	const dir = path.dirname(filePath);
	await fs.mkdir(dir, { recursive: true });
}

export async function saveFile(key: string, buffer: Buffer): Promise<void> {
	assertSafeKey(key);
	if (isProd && s3Client) {
		await s3Client.send(
			new PutObjectCommand({
				Bucket: process.env.S3_BUCKET!,
				Key: key,
				Body: buffer,
				ContentType: getContentType(key),
			}),
		);
	} else {
		const filePath = path.join(LOCAL_BASE, key);
		await ensureLocalDir(filePath);
		await fs.writeFile(filePath, buffer);
	}
}

export async function readFile(key: string): Promise<Buffer> {
	assertSafeKey(key);
	if (isProd && s3Client) {
		const response = await s3Client.send(
			new GetObjectCommand({
				Bucket: process.env.S3_BUCKET!,
				Key: key,
			}),
		);
		if (!response.Body) throw new Error(`File not found: ${key}`);
		const bytes = await response.Body.transformToByteArray();
		return Buffer.from(bytes);
	}
	const filePath = path.join(LOCAL_BASE, key);
	return fs.readFile(filePath);
}

export async function readFileStream(
	key: string,
): Promise<ReadableStream<Uint8Array>> {
	assertSafeKey(key);
	if (isProd && s3Client) {
		const response = await s3Client.send(
			new GetObjectCommand({
				Bucket: process.env.S3_BUCKET!,
				Key: key,
			}),
		);
		if (!response.Body) throw new Error(`File not found: ${key}`);
		return response.Body.transformToWebStream() as ReadableStream<Uint8Array>;
	}
	const filePath = path.join(LOCAL_BASE, key);
	const buffer = await fs.readFile(filePath);
	return new ReadableStream({
		start(controller) {
			controller.enqueue(new Uint8Array(buffer));
			controller.close();
		},
	});
}

export async function deleteFile(key: string): Promise<void> {
	assertSafeKey(key);
	if (isProd && s3Client) {
		await s3Client.send(
			new DeleteObjectCommand({
				Bucket: process.env.S3_BUCKET!,
				Key: key,
			}),
		);
	} else {
		const filePath = path.join(LOCAL_BASE, key);
		await fs.unlink(filePath).catch(() => {});
	}
}

export async function fileExists(key: string): Promise<boolean> {
	assertSafeKey(key);
	if (isProd && s3Client) {
		try {
			await s3Client.send(
				new HeadObjectCommand({
					Bucket: process.env.S3_BUCKET!,
					Key: key,
				}),
			);
			return true;
		} catch {
			return false;
		}
	}
	const filePath = path.join(LOCAL_BASE, key);
	return fs
		.access(filePath)
		.then(() => true)
		.catch(() => false);
}

export async function saveTemplate(
	id: string,
	buffer: Buffer,
	ext: string,
): Promise<string> {
	const key = `templates/${id}${ext}`;
	await saveFile(key, buffer);
	return key;
}

export function getCertificateOutputDir(workshopCode: string): string {
	return `certificates/${workshopCode}`;
}
