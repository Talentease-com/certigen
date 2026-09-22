import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	send: vi.fn().mockResolvedValue({ data: null, error: { message: "provider rejected" } }),
}));

vi.mock("resend", () => ({
	Resend: class {
		emails = { send: state.send };
	},
}));

import { sendCertificateEmail } from "./email";

describe("certificate email provider", () => {
	it("passes the issued artifact key and surfaces provider failures", async () => {
		await expect(sendCertificateEmail({
			to: "learner@example.test", participantName: "Learner", workshopTitle: "Course",
			workshopDate: "2026-08-01", imageBuffer: Buffer.from("png"),
			verifyUrl: "https://certigen.example/verify/CERT-1", idempotencyKey: "certificate:CERT-1",
		})).rejects.toThrow("provider rejected");
		expect(state.send).toHaveBeenCalledWith(expect.any(Object), {
			idempotencyKey: "certificate:CERT-1",
		});
	});
});
