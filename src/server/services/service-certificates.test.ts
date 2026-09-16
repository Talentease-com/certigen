import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ existing: null as Record<string, unknown> | null }));
vi.mock("#/db", () => ({ db: {
	select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ id: "template-1", name: "Elevate" }] }) }) }),
	query: { certificates: { findFirst: async () => state.existing } },
	insert: () => ({ values: () => ({ returning: async () => [{ id: "CERT-1" }] }) }),
	update: () => ({ set: () => ({ where: async () => undefined }) }),
} }));
vi.mock("./template-versions", () => ({
	loadCurrentTemplateVersion: async () => ({ id: "version-1" }),
	loadTemplateVersionById: async () => ({ id: "version-1" }),
}));
vi.mock("./certificate-gen", () => ({ generateCertId: () => "CERT-1" }));
vi.mock("./certificate-render", () => ({ renderCertificate: async () => ({
	pngBuffer: Buffer.from("png"), name: "Ada", email: "ada@example.test",
	workshopTitle: "Course", workshopDate: "2026-08-01", verifyUrl: "https://certigen.example/verify/CERT-1",
}) }));
vi.mock("./email", () => ({ sendCertificateEmail: async () => undefined }));

vi.mock("#/server/api-utils", () => ({
	requireServiceApiKeyFromRequest: () => undefined,
	errorResponse: () => new Response("error", { status: 500 }),
	zodErrorResponse: () => new Response("invalid", { status: 400 }),
}));
import { POST } from "#/app/api/service/certificates/route";

const input = {
	templateName: "Elevate",
	recipient: { name: "Ada", email: "ada@example.test" },
	certificate: { title: "Course", date: "2026-08-01" },
	source: { platform: "elevate-lms", tenantId: "1", courseId: "2", certificateId: "3", idempotencyKey: "same" },
};

afterEach(() => { state.existing = null; delete process.env.BASE_URL; });

describe("service certificate URL", () => {
	it("returns the public PNG attachment URL on issue and idempotent repeat", async () => {
		process.env.BASE_URL = "https://certigen.example";
		const issuedResponse = await POST(new Request("https://certigen.example/api/service/certificates", {
			method: "POST", body: JSON.stringify(input), headers: { "Content-Type": "application/json" },
		}));
		expect(issuedResponse.status).toBe(200);
		const issued = await issuedResponse.json();
		expect(issued.downloadUrl).toBe("https://certigen.example/api/certificates/CERT-1/file");
		state.existing = {
			id: "CERT-1", name: "Ada", email: "ada@example.test", certificateTitle: "Course",
			certificateDate: "2026-08-01", templateId: "template-1", externalId: "1:2:3", emailStatus: "sent",
		};
		const repeatedResponse = await POST(new Request("https://certigen.example/api/service/certificates", {
			method: "POST", body: JSON.stringify(input), headers: { "Content-Type": "application/json" },
		}));
		expect(repeatedResponse.status).toBe(200);
		const repeated = await repeatedResponse.json();
		expect(repeated.downloadUrl).toBe(issued.downloadUrl);
	});
});
