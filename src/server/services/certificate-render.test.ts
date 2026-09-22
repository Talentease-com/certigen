import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "#/db";
import { generateCertificateImage } from "./certificate-gen";
import {
	renderCertificate,
	renderCertificateById,
} from "./certificate-render";
import { readFile } from "./storage";
import { loadTemplateVersionById } from "./template-versions";

vi.mock("#/db", () => ({
	db: {
		query: {
			certificates: { findFirst: vi.fn() },
			workshops: { findFirst: vi.fn() },
		},
	},
}));

vi.mock("./certificate-gen", () => ({
	generateCertificateImage: vi.fn(),
}));

vi.mock("./storage", () => ({
	readFile: vi.fn(),
}));

vi.mock("./template-versions", () => ({
	loadTemplateVersionById: vi.fn(),
}));

const certificate = {
	id: "certificate-1",
	workshopId: "workshop-1",
	templateId: "template-1",
	templateVersionId: "version-1",
	sourcePlatform: null,
	externalId: null,
	idempotencyKey: null,
	certificateTitle: "Original Workshop",
	certificateDate: "July 31, 2026",
	name: "Original Name",
	email: "person@example.com",
	legacyFilePath: null,
	emailStatus: "sent",
	emailSentAt: null,
	emailError: null,
	issuedAt: new Date("2026-07-31T00:00:00Z"),
};

const workshop = {
	id: "workshop-1",
	code: "WORKSHOP",
	title: "Current Workshop",
	date: "August 1, 2026",
	templateId: "template-1",
	isActive: true,
	createdAt: new Date("2026-07-01T00:00:00Z"),
};

const version = {
	id: "version-1",
	templateId: "template-1",
	versionNumber: 1,
	filePath: "templates/template-1/version-1.png",
	design: '{"elements":[]}',
	width: 1200,
	height: 800,
	isCurrent: false,
	createdAt: new Date("2026-07-01T00:00:00Z"),
};

afterEach(() => {
	vi.resetAllMocks();
});

describe("immutable certificate rendering", () => {
	it("serves the exact legacy image without loading a template version", async () => {
		const legacy = Buffer.from("original image");
		vi.mocked(db.query.certificates.findFirst).mockResolvedValue({
			...certificate,
			legacyFilePath: "certificates/original.png",
		});
		vi.mocked(db.query.workshops.findFirst).mockResolvedValue(workshop);
		vi.mocked(readFile).mockResolvedValue(legacy);

		const rendered = await renderCertificateById(certificate.id);

		expect(rendered?.pngBuffer).toBe(legacy);
		expect(rendered).toMatchObject({
			name: certificate.name,
			workshopTitle: certificate.certificateTitle,
			workshopDate: certificate.certificateDate,
		});
		expect(loadTemplateVersionById).not.toHaveBeenCalled();
	});

	it("falls back to the pinned revision when a legacy image is missing", async () => {
		const generated = Buffer.from("generated image");
		vi.spyOn(console, "warn").mockImplementation(() => undefined);
		vi.mocked(db.query.certificates.findFirst).mockResolvedValue({
			...certificate,
			legacyFilePath: "certificates/missing.png",
		});
		vi.mocked(db.query.workshops.findFirst).mockResolvedValue(workshop);
		vi.mocked(readFile)
			.mockRejectedValueOnce(new Error("not found"))
			.mockResolvedValueOnce(Buffer.from("background"));
		vi.mocked(loadTemplateVersionById).mockResolvedValue(version);
		vi.mocked(generateCertificateImage).mockResolvedValue({
			pngBuffer: generated,
		});

		const rendered = await renderCertificateById(certificate.id);

		expect(loadTemplateVersionById).toHaveBeenCalledWith("version-1");
		expect(rendered?.pngBuffer).toBe(generated);
	});

	it("formats an ISO completion timestamp as a UTC calendar date", async () => {
		const issuedAt = "2026-04-17T11:13:04.529Z";
		const serviceCertificate = {
			...certificate,
			workshopId: null,
			certificateDate: issuedAt,
		};
		vi.mocked(readFile).mockResolvedValue(Buffer.from("background"));
		vi.mocked(generateCertificateImage).mockResolvedValue({
			pngBuffer: Buffer.from("generated"),
		});

		const rendered = await renderCertificate(serviceCertificate, null, version);

		expect(generateCertificateImage).toHaveBeenCalledWith(
			expect.objectContaining({
				values: expect.objectContaining({ date: "April 17, 2026" }),
			}),
		);
		expect(rendered?.workshopDate).toBe("April 17, 2026");
		expect(serviceCertificate.certificateDate).toBe(issuedAt);
	});

	it("uses the UTC date when an offset timestamp crosses midnight", async () => {
		vi.mocked(readFile).mockResolvedValue(Buffer.from("background"));
		vi.mocked(generateCertificateImage).mockResolvedValue({
			pngBuffer: Buffer.from("generated"),
		});

		const rendered = await renderCertificate(
			{ ...certificate, workshopId: null, certificateDate: "2026-04-17T23:30:00-02:00" },
			null,
			version,
		);

		expect(generateCertificateImage).toHaveBeenCalledWith(
			expect.objectContaining({
				values: expect.objectContaining({ date: "April 18, 2026" }),
			}),
		);
		expect(rendered?.workshopDate).toBe("April 18, 2026");
	});

	it("renders dynamic values from the certificate snapshot and pinned revision", async () => {
		vi.mocked(readFile).mockResolvedValue(Buffer.from("background"));
		vi.mocked(generateCertificateImage).mockResolvedValue({
			pngBuffer: Buffer.from("generated"),
		});

		await renderCertificate(certificate, workshop, version);

		expect(generateCertificateImage).toHaveBeenCalledWith(
			expect.objectContaining({
				templateWidth: version.width,
				templateHeight: version.height,
				values: {
					name: certificate.name,
					workshop_title: certificate.certificateTitle,
					date: certificate.certificateDate,
				},
			}),
		);
	});
});
