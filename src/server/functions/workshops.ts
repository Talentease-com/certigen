import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "#/db";
import { workshops, certificates, templates } from "#/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { nanoid } from "nanoid";
import { requireAdmin } from "../middleware/auth";

const createWorkshopInput = z.object({
	token: z.string(),
	code: z.string().min(1).max(50),
	title: z.string().min(1).max(200),
	date: z.string().min(1),
	templateId: z.string().min(1),
});

export const createWorkshop = createServerFn({ method: "POST" })
	.inputValidator(createWorkshopInput)
	.handler(async ({ data }) => {
		await requireAdmin(data.token);

		const id = nanoid(12);
		await db.insert(workshops).values({
			id,
			code: data.code.toUpperCase(),
			title: data.title,
			date: data.date,
			templateId: data.templateId,
		});

		return { id, code: data.code.toUpperCase() };
	});

const tokenInput = z.object({ token: z.string() });

export const listWorkshops = createServerFn()
	.inputValidator(tokenInput)
	.handler(async ({ data }) => {
		await requireAdmin(data.token);

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
	});

const updateWorkshopInput = z.object({
	token: z.string(),
	id: z.string(),
	title: z.string().optional(),
	date: z.string().optional(),
	templateId: z.string().optional(),
	isActive: z.boolean().optional(),
});

export const updateWorkshop = createServerFn({ method: "POST" })
	.inputValidator(updateWorkshopInput)
	.handler(async ({ data }) => {
		await requireAdmin(data.token);

		const updates: Record<string, unknown> = {};
		if (data.title !== undefined) updates.title = data.title;
		if (data.date !== undefined) updates.date = data.date;
		if (data.templateId !== undefined) updates.templateId = data.templateId;
		if (data.isActive !== undefined) updates.isActive = data.isActive;

		await db.update(workshops).set(updates).where(eq(workshops.id, data.id));

		return { success: true };
	});

const listCertsInput = z.object({
	token: z.string(),
	workshopId: z.string().optional(),
});

export const listCertificates = createServerFn()
	.inputValidator(listCertsInput)
	.handler(async ({ data }) => {
		await requireAdmin(data.token);

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

		if (data.workshopId) {
			query = query.where(eq(certificates.workshopId, data.workshopId));
		}

		return await query;
	});

export const getWorkshopStats = createServerFn()
	.inputValidator(tokenInput)
	.handler(async ({ data }) => {
		await requireAdmin(data.token);

		const [workshopCount] = await db.select({ total: count() }).from(workshops);

		const [certCount] = await db.select({ total: count() }).from(certificates);

		const [templateCount] = await db.select({ total: count() }).from(templates);

		return {
			totalWorkshops: workshopCount.total,
			totalCertificates: certCount.total,
			totalTemplates: templateCount.total,
		};
	});

const deleteWorkshopInput = z.object({ token: z.string(), id: z.string() });

export const deleteWorkshop = createServerFn({ method: "POST" })
	.inputValidator(deleteWorkshopInput)
	.handler(async ({ data }) => {
		await requireAdmin(data.token);

		// Check for existing certificates
		const [existing] = await db
			.select({ total: count() })
			.from(certificates)
			.where(eq(certificates.workshopId, data.id));

		if (existing.total > 0) {
			throw new Error(
				`Cannot delete: ${existing.total} certificate(s) have been issued for this workshop. Deactivate it instead.`,
			);
		}

		await db.delete(workshops).where(eq(workshops.id, data.id));
		return { success: true };
	});
