import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ existing: null as Record<string, unknown> | null, emails: 0, updates: 0 }));
vi.mock("#/db", () => ({ db: {
	select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ id: "template-1", name: "Elevate" }] }) }) }),
	query: { certificates: { findFirst: async () => state.existing } },
	insert: () => ({ values: () => ({ returning: async () => [{ id: "CERT-1" }] }) }),
	update: () => ({ set: () => ({ where: async () => { state.updates++; } }) }),
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
vi.mock("./email", () => ({ sendCertificateEmail: async () => { state.emails++; } }));

vi.mock("#/server/api-utils", () => ({
	requireServiceApiKeyFromRequest: (request: Request) => {
		if (request.headers.get("Authorization") !== "Bearer secret") {
			throw Object.assign(new Error("Unauthorized"), { status: 401 });
		}
	},
	errorResponse: (err: { message: string; status?: number }) => new Response(err.message, { status: err.status ?? 500 }),
	zodErrorResponse: () => new Response("invalid", { status: 400 }),
}));
import { GET, POST } from "#/app/api/service/certificates/route";

const input = {
	templateName: "Elevate",
	recipient: { name: "Ada", email: "ada@example.test" },
	certificate: { title: "Course", date: "2026-08-01" },
	source: { platform: "elevate-lms", tenantId: "1", courseId: "2", certificateId: "3", idempotencyKey: "same" },
};

afterEach(() => { state.existing = null; state.emails = 0; state.updates = 0; delete process.env.BASE_URL; });

describe("service certificate URL", () => {
	it("returns the public PNG attachment URL on issue and idempotent repeat", async () => {
		process.env.BASE_URL = "https://certigen.example";
		const issuedResponse = await POST(new Request("https://certigen.example/api/service/certificates", {
			method: "POST", body: JSON.stringify(input), headers: { "Content-Type": "application/json", Authorization: "Bearer secret" },
		}));
		expect(issuedResponse.status).toBe(200);
		const issued = await issuedResponse.json();
		expect(issued.downloadUrl).toBe("https://certigen.example/api/certificates/CERT-1/file");
		state.existing = {
			id: "CERT-1", name: "Ada", email: "ada@example.test", certificateTitle: "Course",
			certificateDate: "2026-08-01", templateId: "template-1", externalId: "1:2:3", emailStatus: "sent",
		};
		const repeatedResponse = await POST(new Request("https://certigen.example/api/service/certificates", {
			method: "POST", body: JSON.stringify(input), headers: { "Content-Type": "application/json", Authorization: "Bearer secret" },
		}));
		expect(repeatedResponse.status).toBe(200);
		const repeated = await repeatedResponse.json();
		expect(repeated.downloadUrl).toBe(issued.downloadUrl);
	});

	it("retrieves the original issued links by service identity without email or mutation", async () => {
		process.env.BASE_URL = "https://certigen.example";
		state.existing = {
			id: "CERT-1", name: "Original Learner", email: "original@example.test",
			certificateTitle: "Original Course", certificateDate: "2026-08-01", emailStatus: "failed",
		};
		const url = "https://certigen.example/api/service/certificates?platform=elevate-lms&idempotencyKey=same";
		const request = () => new Request(url, { headers: { Authorization: "Bearer secret" } });
		const first = await GET(request());
		const second = await GET(request());
		expect(first.status).toBe(200);
		expect(first.headers.get("Cache-Control")).toBe("no-store");
		expect(await first.json()).toEqual(await second.json());
		expect(state.emails).toBe(0);
		expect(state.updates).toBe(0);
		expect(await GET(new Request(url))).toHaveProperty("status", 401);
		state.existing = null;
		expect((await GET(request())).status).toBe(404);
	});
});
