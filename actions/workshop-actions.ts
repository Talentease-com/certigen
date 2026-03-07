"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { workshops, certificates, templates } from "@/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { nanoid } from "nanoid";
import { requireAdmin } from "@/lib/auth-utils";
import { revalidatePath } from "next/cache";

const createWorkshopInput = z.object({
	code: z.string().min(1).max(50),
	title: z.string().min(1).max(200),
	date: z.string().min(1),
	templateId: z.string().min(1),
});

export async function createWorkshop(input: {
	code: string;
	title: string;
	date: string;
	templateId: string;
}) {
	await requireAdmin();
	const data = createWorkshopInput.parse(input);

	const id = nanoid(12);
	await db.insert(workshops).values({
		id,
		code: data.code.toUpperCase(),
		title: data.title,
		date: data.date,
		templateId: data.templateId,
	});

	revalidatePath("/admin/workshops");
	return { id, code: data.code.toUpperCase() };
}

export async function listWorkshops() {
	await requireAdmin();

	return await db
		.select({
			id: workshops.id,
			code: workshops.code,
			title: workshops.title,
			date: workshops.date,
			templateId: workshops.templateId,
			isActive: workshops.isActive,
			createdAt: workshops.createdAt,
		})
		.from(workshops)
		.orderBy(desc(workshops.createdAt));
}

export async function updateWorkshop(input: {
	id: string;
	title?: string;
	date?: string;
	templateId?: string;
	isActive?: boolean;
}) {
	await requireAdmin();

	const updates: Record<string, unknown> = {};
	if (input.title !== undefined) updates.title = input.title;
	if (input.date !== undefined) updates.date = input.date;
	if (input.templateId !== undefined) updates.templateId = input.templateId;
	if (input.isActive !== undefined) updates.isActive = input.isActive;

	await db.update(workshops).set(updates).where(eq(workshops.id, input.id));

	revalidatePath("/admin/workshops");
	return { success: true };
}

export async function deleteWorkshop(id: string) {
	await requireAdmin();

	const [existing] = await db
		.select({ total: count() })
		.from(certificates)
		.where(eq(certificates.workshopId, id));

	if (existing.total > 0) {
		throw new Error(
			`Cannot delete: ${existing.total} certificate(s) have been issued for this workshop. Deactivate it instead.`,
		);
	}

	await db.delete(workshops).where(eq(workshops.id, id));

	revalidatePath("/admin/workshops");
	return { success: true };
}

export async function listCertificates(workshopId?: string) {
	await requireAdmin();

	let query = db
		.select({
			id: certificates.id,
			name: certificates.name,
			email: certificates.email,
			issuedAt: certificates.issuedAt,
			workshopTitle: workshops.title,
			workshopCode: workshops.code,
			workshopDate: workshops.date,
		})
		.from(certificates)
		.innerJoin(workshops, eq(certificates.workshopId, workshops.id))
		.orderBy(desc(certificates.issuedAt))
		.$dynamic();

	if (workshopId) {
		query = query.where(eq(certificates.workshopId, workshopId));
	}

	return await query;
}

export async function getWorkshopStats() {
	await requireAdmin();

	const [workshopCount] = await db.select({ total: count() }).from(workshops);
	const [certCount] = await db.select({ total: count() }).from(certificates);
	const [templateCount] = await db.select({ total: count() }).from(templates);

	return {
		totalWorkshops: workshopCount.total,
		totalCertificates: certCount.total,
		totalTemplates: templateCount.total,
	};
}
