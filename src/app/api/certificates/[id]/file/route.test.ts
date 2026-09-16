import { afterEach, describe, expect, it, vi } from "vitest";
import { renderCertificateById } from "#/server/services/certificate-render";
import { db } from "#/db";
import { GET as getFile } from "./route";
import { GET as getJson } from "../download/route";

vi.mock("#/server/services/certificate-render", () => ({ renderCertificateById: vi.fn() }));
vi.mock("#/db", () => ({ db: { query: { certificates: { findFirst: vi.fn() } } } }));

const params = { params: Promise.resolve({ id: "CERT-1" }) };
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2]);

afterEach(() => vi.resetAllMocks());

describe("certificate download HTTP contracts", () => {
	it("returns exact PNG bytes with a safe attachment name and no shared cache", async () => {
		vi.mocked(renderCertificateById).mockResolvedValue({
			pngBuffer: png, name: "Éva \"../\n Smith", filename: "unsafe.png",
			email: "eva@example.com", workshopTitle: "Course", workshopDate: "2026-08-01", verifyUrl: "https://example.test/verify/CERT-1",
		});
		const response = await getFile(new Request("https://example.test/file"), params);
		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("image/png");
		expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="Eva_Smith_Certificate.png"');
		expect(response.headers.get("Cache-Control")).toBe("private, no-store");
		expect(Buffer.from(await response.arrayBuffer())).toEqual(png);
	});

	it("uses a safe fallback filename for a name without ASCII letters", async () => {
		vi.mocked(renderCertificateById).mockResolvedValue({
			pngBuffer: png, name: "💥/\\", filename: "unsafe.png", email: "x@example.com",
			workshopTitle: "Course", workshopDate: "2026-08-01", verifyUrl: "https://example.test/verify/CERT-1",
		});
		const response = await getFile(new Request("https://example.test/file"), params);
		expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="Certificate.png"');
	});

	it("keeps the existing JSON base64 contract", async () => {
		vi.mocked(renderCertificateById).mockResolvedValue({
			pngBuffer: png, name: "Eva", filename: "Eva_Certificate.png",
			email: "eva@example.com", workshopTitle: "Course", workshopDate: "2026-08-01", verifyUrl: "https://example.test/verify/CERT-1",
		});
		const response = await getJson(new Request("https://example.test/download"), params);
		expect(await response.json()).toEqual({ base64: png.toString("base64"), filename: "Eva_Certificate.png" });
	});

	it("returns a generic 500 when the certificate exists but cannot be rendered", async () => {
		vi.mocked(renderCertificateById).mockResolvedValueOnce(null);
		vi.mocked(db.query.certificates.findFirst).mockResolvedValueOnce({ id: "CERT-1" } as never);
		const response = await getFile(new Request("https://example.test/file"), params);
		expect(response.status).toBe(500);
		expect(await response.text()).toBe("Certificate file unavailable");
	});

	it("returns 404 for missing certificates and redacts rendering failures", async () => {
		vi.mocked(renderCertificateById).mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("private storage key"));
		vi.mocked(db.query.certificates.findFirst).mockResolvedValueOnce(undefined);
		const missing = await getFile(new Request("https://example.test/file"), params);
		expect(missing.status).toBe(404);
		const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const failed = await getFile(new Request("https://example.test/file"), params);
		expect(failed.status).toBe(500);
		expect(await failed.text()).not.toContain("private storage key");
		spy.mockRestore();
	});
});
