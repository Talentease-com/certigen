import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { renderCertificateById } from "#/server/services/certificate-render";
import { db } from "#/db";
import { GET } from "./route";

vi.mock("#/server/services/certificate-render", () => ({ renderCertificateById: vi.fn() }));
vi.mock("#/db", () => ({ db: { query: { certificates: { findFirst: vi.fn() } } } }));

const params = { params: Promise.resolve({ id: "CERT-1" }) };

async function pngOfSize(width: number, height: number): Promise<Buffer> {
	return sharp({
		create: { width, height, channels: 3, background: { r: 245, g: 166, b: 35 } },
	})
		.png()
		.toBuffer();
}

function rendered(pngBuffer: Buffer) {
	return {
		pngBuffer, name: "Eva Smith", filename: "Eva_Smith_Certificate.png", email: "eva@example.com",
		workshopTitle: "Course", workshopDate: "2026-08-01", verifyUrl: "https://example.test/verify/CERT-1",
	};
}

afterEach(() => vi.resetAllMocks());

describe("certificate image HTTP contract", () => {
	it("serves the full PNG inline with public CDN caching", async () => {
		const png = await pngOfSize(3200, 2000);
		vi.mocked(renderCertificateById).mockResolvedValue(rendered(png));

		const response = await GET(new Request("https://example.test/api/certificates/CERT-1/image"), params);

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("image/png");
		expect(response.headers.get("Content-Disposition")).toBe('inline; filename="Eva_Smith_Certificate.png"');
		expect(response.headers.get("Cache-Control")).toBe(
			"public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
		);
		expect(Buffer.from(await response.arrayBuffer())).toEqual(png);
	});

	it("serves a 1600px-wide PNG preview that keeps the aspect ratio", async () => {
		vi.mocked(renderCertificateById).mockResolvedValue(rendered(await pngOfSize(3200, 2000)));

		const response = await GET(
			new Request("https://example.test/api/certificates/CERT-1/image?size=preview"),
			params,
		);

		expect(response.headers.get("Content-Type")).toBe("image/png");
		const { format, width, height } = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
		expect({ format, width, height }).toEqual({ format: "png", width: 1600, height: 1000 });
	});

	it("never enlarges a certificate that is already narrower than the preview", async () => {
		vi.mocked(renderCertificateById).mockResolvedValue(rendered(await pngOfSize(1200, 800)));

		const response = await GET(
			new Request("https://example.test/api/certificates/CERT-1/image?size=preview"),
			params,
		);

		const { width, height } = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
		expect({ width, height }).toEqual({ width: 1200, height: 800 });
	});

	it("returns 404 for a certificate that does not exist", async () => {
		vi.mocked(renderCertificateById).mockResolvedValue(null);
		vi.mocked(db.query.certificates.findFirst).mockResolvedValue(undefined);

		const response = await GET(new Request("https://example.test/api/certificates/CERT-1/image"), params);

		expect(response.status).toBe(404);
	});

	it("returns an uncached generic 500 when an existing certificate cannot be rendered", async () => {
		vi.mocked(renderCertificateById).mockResolvedValue(null);
		vi.mocked(db.query.certificates.findFirst).mockResolvedValue({ id: "CERT-1" } as never);

		const response = await GET(new Request("https://example.test/api/certificates/CERT-1/image"), params);

		expect(response.status).toBe(500);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(await response.text()).toBe("Certificate image unavailable");
	});

	it("redacts rendering errors from the response", async () => {
		vi.mocked(renderCertificateById).mockRejectedValue(new Error("private storage key"));
		vi.spyOn(console, "error").mockImplementation(() => undefined);

		const response = await GET(new Request("https://example.test/api/certificates/CERT-1/image"), params);

		expect(response.status).toBe(500);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(await response.text()).toBe("Certificate image unavailable");
	});
});
