import { and, eq } from "drizzle-orm";
import { db } from "#/db";
import { templateVersions } from "#/db/schema";

export type TemplateVersion = typeof templateVersions.$inferSelect;

export async function loadCurrentTemplateVersion(
	templateId: string,
): Promise<TemplateVersion | null> {
	return (
		(await db.query.templateVersions.findFirst({
			where: and(
				eq(templateVersions.templateId, templateId),
				eq(templateVersions.isCurrent, true),
			),
		})) ?? null
	);
}

export async function loadTemplateVersionById(
	versionId: string,
): Promise<TemplateVersion | null> {
	return (
		(await db.query.templateVersions.findFirst({
			where: eq(templateVersions.id, versionId),
		})) ?? null
	);
}
