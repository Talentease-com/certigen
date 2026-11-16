import http from "node:http";
import type { AddressInfo } from "node:net";
import { createPatchedFetcher } from "next/dist/server/lib/patch-fetch.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Cloudflare R2 rejects a PUT with no Content-Length (chunked upload) with
// 411 MissingContentLength. This fake does the same so the test catches it.
type Received = { method?: string; contentLength?: string; body: Buffer };

function startFakeR2() {
	const received: Received[] = [];
	const server = http.createServer((req, res) => {
		const chunks: Buffer[] = [];
		req.on("data", (chunk) => chunks.push(chunk));
		req.on("end", () => {
			const contentLength = req.headers["content-length"];
			received.push({ method: req.method, contentLength, body: Buffer.concat(chunks) });
			if (req.method === "PUT" && contentLength === undefined) {
				res.writeHead(411, "Length Required");
				res.end("<Error><Code>MissingContentLength</Code></Error>");
				return;
			}
			res.writeHead(200);
			res.end();
		});
	});
	return new Promise<{ server: http.Server; received: Received[]; endpoint: string }>((resolve) => {
		server.listen(0, "127.0.0.1", () => {
			const { port } = server.address() as AddressInfo;
			resolve({ server, received, endpoint: `http://127.0.0.1:${port}` });
		});
	});
}

describe("template storage on S3-compatible object storage (R2)", () => {
	const originalFetch = globalThis.fetch;
	let fake: Awaited<ReturnType<typeof startFakeR2>>;

	beforeEach(async () => {
		fake = await startFakeR2();
		vi.resetModules();
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("S3_ACCESS_KEY_ID", "test-key");
		vi.stubEnv("S3_SECRET_ACCESS_KEY", "test-secret");
		vi.stubEnv("S3_BUCKET", "certigen-data");
		vi.stubEnv("S3_ENDPOINT", fake.endpoint);
		vi.stubEnv("S3_REGION", "auto");
		// Route handlers run with Next.js's patched fetch, which rebuilds a
		// Request input from its stream body and so drops the known length.
		const workStore = { route: "/api/admin/templates", pendingRevalidates: {}, nextFetchId: 1 };
		globalThis.fetch = createPatchedFetcher(originalFetch, {
			workAsyncStorage: { getStore: () => workStore },
			workUnitAsyncStorage: { getStore: () => undefined },
		} as never) as typeof fetch;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.unstubAllEnvs();
		fake.server.close();
	});

	it("uploads a template background with a Content-Length inside a Next.js route", async () => {
		const { saveTemplateVersionBackground } = await import("./storage");
		const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

		const key = await saveTemplateVersionBackground("GJ2dIhT4voy2", "kOxk_9LI4szB", png, ".png");

		expect(key).toBe("templates/GJ2dIhT4voy2/versions/kOxk_9LI4szB/background.png");
		expect(fake.received).toHaveLength(1);
		expect(fake.received[0]).toMatchObject({ method: "PUT", contentLength: String(png.length) });
		expect(fake.received[0].body).toEqual(png);
	});

	it("uploads a template asset with a Content-Length inside a Next.js route", async () => {
		const { saveTemplateAsset } = await import("./storage");
		const logo = Buffer.from("logo-bytes");

		await saveTemplateAsset("GJ2dIhT4voy2", "asset1", logo, ".png");

		expect(fake.received[0]).toMatchObject({ method: "PUT", contentLength: String(logo.length) });
		expect(fake.received[0].body).toEqual(logo);
	});
});
