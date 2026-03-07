"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { certificates, workshops, templates } from "@/db/schema";
import { eq, and, count } from "drizzle-orm";
import {
	generateCertificateImage,
	generateCertId,
	type PlaceholderConfig,
} from "@/lib/certificate-gen";
import { sendCertificateEmail } from "@/lib/email";
import { getCertificateOutputDir, readFile, saveFile } from "@/lib/storage";

const generateCertInput = z.object({
	name: z.string().min(1).max(100),
	email: z.string().email(),
	workshopCode: z.string().min(1),
});

export async function generateCertificate(input: {
	name: string;
	email: string;
	workshopCode: string;
}) {
	const { name, email, workshopCode } = generateCertInput.parse(input);

	const workshop = await db.query.workshops.findFirst({
		where: and(eq(workshops.code, workshopCode), eq(workshops.isActive, true)),
	});

	if (!workshop) {
		throw new Error("Invalid or inactive workshop code.");
	}

	const [existing] = await db
		.select({ total: count() })
		.from(certificates)
		.where(
			and(
				eq(certificates.email, email.toLowerCase()),
				eq(certificates.workshopId, workshop.id),
			),
		);

	if (existing.total >= 2) {
		throw new Error(
			"You have already generated the maximum of 2 certificates for this workshop.",
		);
	}

	const template = workshop.templateId
		? await db.query.templates.findFirst({
				where: eq(templates.id, workshop.templateId),
			})
		: null;

	if (!template) {
		throw new Error("No template configured for this workshop.");
	}

	const placeholderConfigs: PlaceholderConfig[] = JSON.parse(
		template.placeholders,
	);

	const certId = generateCertId();
	const baseUrl = process.env.BASE_URL || "http://localhost:3000";
	const verifyUrl = `${baseUrl}/verify/${certId}`;
	const outputDir = getCertificateOutputDir(workshopCode);

	const values: Record<string, string> = {
		name,
		workshop_title: workshop.title,
		date: workshop.date,
	};

	const templateBuffer = await readFile(template.filePath);

	const { pngBuffer } = await generateCertificateImage({
		templateBuffer,
		templateWidth: template.width,
		templateHeight: template.height,
		placeholders: placeholderConfigs,
		values,
		certId,
		verifyUrl,
	});

	const fileKey = `${outputDir}/${certId}.png`;
	await saveFile(fileKey, pngBuffer);

	await db
		.insert(certificates)
		.values({
			id: certId,
			workshopId: workshop.id,
			name,
			email: email.toLowerCase(),
			filePath: fileKey,
		})
		.onConflictDoUpdate({
			target: [certificates.email, certificates.workshopId],
			set: {
				id: certId,
				name,
				filePath: fileKey,
				issuedAt: new Date(),
			},
		});

	sendCertificateEmail({
		to: email,
		participantName: name,
		workshopTitle: workshop.title,
		workshopDate: workshop.date,
		imageBuffer: pngBuffer,
		verifyUrl,
	}).catch((err) => {
		console.error("Failed to send certificate email:", err);
	});

	const remainingAttempts = 2 - (existing.total + 1);
	return {
		certId,
		downloadUrl: `/api/certificates/${certId}/download`,
		remainingAttempts,
	};
}

export async function getWorkshopByCode(code: string) {
	const normalizedCode = code.trim().toUpperCase();

	const workshop = await db.query.workshops.findFirst({
		where: and(
			eq(workshops.code, normalizedCode),
			eq(workshops.isActive, true),
		),
	});

	if (!workshop) return null;

	return {
		id: workshop.id,
		code: workshop.code,
		title: workshop.title,
		date: workshop.date,
	};
}

export async function verifyCertificateData(id: string) {
	const cert = await db.query.certificates.findFirst({
		where: eq(certificates.id, id),
	});

	if (!cert) return null;

	const workshop = await db.query.workshops.findFirst({
		where: eq(workshops.id, cert.workshopId),
	});

	return {
		id: cert.id,
		name: cert.name,
		email: cert.email,
		workshopTitle: workshop?.title ?? "Unknown Workshop",
		workshopDate: workshop?.date ?? "",
		issuedAt: cert.issuedAt.toISOString(),
	};
}

export async function getRemainingAttempts(email: string, workshopCode: string) {
	const workshop = await db.query.workshops.findFirst({
		where: eq(workshops.code, workshopCode),
	});

	if (!workshop) return 2;

	const [existing] = await db
		.select({ total: count() })
		.from(certificates)
		.where(
			and(
				eq(certificates.email, email.toLowerCase()),
				eq(certificates.workshopId, workshop.id),
			),
		);

	return 2 - existing.total;
}
