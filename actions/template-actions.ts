"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { templates, workshops } from "@/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { nanoid } from "nanoid";
import { requireAdmin } from "@/lib/auth-utils";
import { saveTemplate, readFile, deleteFile } from "@/lib/storage";
import { revalidatePath } from "next/cache";

const uploadTemplateInput = z.object({
	name: z.string().min(1),
	imageData: z.string(),
	imageExt: z.string().default(".png"),
	placeholders: z.string(),
	width: z.number().default(3508),
	height: z.number().default(2480),
});

export async function uploadTemplate(input: {
	name: string;
	imageData: string;
	imageExt?: string;
	placeholders: string;
	width?: number;
	height?: number;
}) {
	await requireAdmin();
	const data = uploadTemplateInput.parse(input);

	const id = nanoid(12);
	const buffer = Buffer.from(data.imageData, "base64");
	const filePath = await saveTemplate(id, buffer, data.imageExt);

	await db.insert(templates).values({
		id,
		name: data.name,
		filePath,
		placeholders: data.placeholders,
		width: data.width,
		height: data.height,
	});

	revalidatePath("/admin/templates");
	return { id, name: data.name };
}

export async function listTemplates() {
	await requireAdmin();

	return await db
		.select({
			id: templates.id,
			name: templates.name,
			width: templates.width,
			height: templates.height,
			placeholders: templates.placeholders,
			createdAt: templates.createdAt,
		})
		.from(templates)
		.orderBy(desc(templates.createdAt));
}

export async function updateTemplate(input: {
	id: string;
	name?: string;
	placeholders?: string;
	imageData?: string;
	imageExt?: string;
}) {
	await requireAdmin();

	const updates: Record<string, unknown> = {};
	if (input.name !== undefined) updates.name = input.name;
	if (input.placeholders !== undefined)
		updates.placeholders = input.placeholders;

	if (input.imageData) {
		const buffer = Buffer.from(input.imageData, "base64");
		const ext = input.imageExt || ".png";
		const filePath = await saveTemplate(input.id, buffer, ext);
		updates.filePath = filePath;
	}

	await db.update(templates).set(updates).where(eq(templates.id, input.id));

	revalidatePath("/admin/templates");
	return { success: true };
}

export async function deleteTemplate(id: string) {
	await requireAdmin();

	const [refs] = await db
		.select({ total: count() })
		.from(workshops)
		.where(eq(workshops.templateId, id));

	if (refs.total > 0) {
		throw new Error(
			`Cannot delete: ${refs.total} workshop(s) use this template. Reassign them first.`,
		);
	}

	const template = await db.query.templates.findFirst({
		where: eq(templates.id, id),
	});

	if (template) {
		await deleteFile(template.filePath);
		await db.delete(templates).where(eq(templates.id, id));
	}

	revalidatePath("/admin/templates");
	return { success: true };
}

export async function testPreviewTemplate(input: {
	templateId?: string;
	imageData?: string;
	imageExt?: string;
	placeholders: string;
	width: number;
	height: number;
}) {
	await requireAdmin();

	const { generateCertificateImage, generateCertId } = await import(
		"@/lib/certificate-gen"
	);

	let templateBuffer: Buffer;

	if (input.imageData) {
		templateBuffer = Buffer.from(input.imageData, "base64");
	} else if (input.templateId) {
		const template = await db.query.templates.findFirst({
			where: eq(templates.id, input.templateId),
		});
		if (!template) throw new Error("Template not found");
		templateBuffer = await readFile(template.filePath);
	} else {
		throw new Error("Provide either templateId or imageData");
	}

	const placeholders = JSON.parse(input.placeholders);
	const certId = generateCertId();

	const { pngBuffer } = await generateCertificateImage({
		templateBuffer,
		templateWidth: input.width,
		templateHeight: input.height,
		placeholders,
		values: {
			name: "Jane Doe",
			workshop_title: "Sample Workshop Title",
			date: new Date().toLocaleDateString("en-US", {
				year: "numeric",
				month: "long",
				day: "numeric",
			}),
		},
		certId,
		verifyUrl: "https://certify.talentease.com/verify/example",
	});

	return { base64: pngBuffer.toString("base64") };
}
