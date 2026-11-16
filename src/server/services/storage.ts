import { AwsClient } from "aws4fetch";
import { createStorage, type Driver } from "unstorage";
import s3Driver, { type S3DriverOptions } from "unstorage/drivers/s3";
import fsDriver from "unstorage/drivers/fs";

const isProd = process.env.NODE_ENV === "production";

/**
 * The stock S3 driver passes a signed `Request` to `fetch`. Inside a Next.js
 * route, the patched `fetch` rebuilds that Request from its stream body, so the
 * upload goes out chunked with no Content-Length and R2 answers
 * 411 MissingContentLength. Writes here pass the URL and the byte body instead,
 * which keeps the length. Reads, lists and deletes stay on the stock driver.
 */
function r2Driver(options: S3DriverOptions): Driver {
	const base = s3Driver(options);
	const aws = new AwsClient({
		service: "s3",
		accessKeyId: options.accessKeyId,
		secretAccessKey: options.secretAccessKey,
		region: options.region,
	});
	const baseURL = `${options.endpoint.replace(/\/$/, "")}/${options.bucket}`;

	const putObject = async (key: string, value: unknown) => {
		const url = `${baseURL}/${key.replace(/[:/\\]/g, "/").replace(/^\/|\/$/g, "")}`;
		const body: string | Uint8Array<ArrayBuffer> =
			typeof value === "string"
				? value
				: value instanceof Uint8Array
					? (value as Uint8Array<ArrayBuffer>)
					: value instanceof ArrayBuffer
						? new Uint8Array(value)
						: String(value);
		const signed = await aws.sign(url, { method: "PUT", body });
		const res = await fetch(signed.url, { method: "PUT", headers: signed.headers, body });
		if (!res.ok) {
			throw new Error(
				`[unstorage] [s3] [PUT] ${url}: ${res.status} ${res.statusText} ${await res.text()}`,
			);
		}
	};

	return { ...base, setItem: putObject, setItemRaw: putObject };
}

// Create an unstorage instance. Fallback to process.env.CF_ACCOUNT_ID if S3_ENDPOINT is not provided.
const storage = createStorage({
	driver: isProd
		? r2Driver({
				accessKeyId: process.env.S3_ACCESS_KEY_ID!,
				secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
				bucket: process.env.S3_BUCKET!,
				endpoint:
					process.env.S3_ENDPOINT ||
					(process.env.CF_ACCOUNT_ID
						? `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`
						: ""),
				region: process.env.S3_REGION || "auto",
			})
		: fsDriver({
				base: "./data",
			}),
});

export async function saveTemplateVersionBackground(
	templateId: string,
	versionId: string,
	buffer: Buffer,
	ext: string,
): Promise<string> {
	const key = `templates/${templateId}/versions/${versionId}/background${ext}`;
	await storage.setItemRaw(key, buffer);
	return key;
}

/** Saves an extra design asset (logo, signature, seal, ...) for a template. */
export async function saveTemplateAsset(
	templateId: string,
	assetId: string,
	buffer: Buffer,
	ext: string,
): Promise<string> {
	const key = `templates/${templateId}/assets/${assetId}${ext}`;
	await storage.setItemRaw(key, buffer);
	return key;
}

export async function readFile(key: string): Promise<Buffer> {
	const data = await storage.getItemRaw(key);
	if (!data) throw new Error(`File not found: ${key}`);
	return Buffer.from(data as ArrayBuffer);
}
