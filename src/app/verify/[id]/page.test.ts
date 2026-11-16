import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "#/db";
import { generateMetadata } from "./page";

vi.mock("#/db", () => ({
	db: {
		query: {
			certificates: { findFirst: vi.fn() },
			workshops: { findFirst: vi.fn() },
			templateVersions: { findFirst: vi.fn() },
		},
	},
}));

const params = { params: Promise.resolve({ id: "CERT-1" }) };

beforeEach(() => vi.stubEnv("BASE_URL", "https://certigen.example"));
afterEach(() => {
	vi.unstubAllEnvs();
	vi.resetAllMocks();
});

describe("verify page link previews", () => {
	it("shows the certificate preview image when the link is shared", async () => {
		vi.mocked(db.query.certificates.findFirst).mockResolvedValue({
			id: "CERT-1", name: "Eva Smith", email: "eva@example.com", workshopId: null,
			certificateTitle: "Leadership Essentials", certificateDate: "August 1, 2026",
			issuedAt: new Date("2026-08-01T00:00:00Z"),
		} as never);

		const metadata = await generateMetadata(params);

		const image = {
			url: "https://certigen.example/api/certificates/CERT-1/image?size=preview",
			alt: "Certificate of completion for Eva Smith — Leadership Essentials",
		};
		expect(metadata.openGraph?.images).toEqual([image]);
		expect(metadata.twitter).toEqual({
			card: "summary_large_image",
			title: "Certificate — Eva Smith",
			description: 'Eva Smith completed "Leadership Essentials" on August 1, 2026. Issued by Talentease.',
			images: [image],
		});
	});

	it("has no preview image for a certificate that does not exist", async () => {
		vi.mocked(db.query.certificates.findFirst).mockResolvedValue(undefined);

		const metadata = await generateMetadata(params);

		expect(metadata.title).toBe("Certificate Not Found — Certigen");
		expect(metadata.openGraph).toBeUndefined();
		expect(metadata.twitter).toBeUndefined();
	});
});
