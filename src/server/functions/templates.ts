import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "#/db";
import { templates } from "#/db/schema";
import { eq, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { requireAdmin } from "../middleware/auth";
import {
  saveTemplate,
  deleteStorageFile,
  readStorageFile,
} from "../services/storage";

const uploadTemplateInput = z.object({
  token: z.string(),
  name: z.string().min(1),
  imageData: z.string(), // Base64
  imageExt: z.string().default(".png"),
  placeholders: z.string(), // JSON
  width: z.number().default(3508),
  height: z.number().default(2480),
});

export const uploadTemplate = createServerFn({ method: "POST" })
  .inputValidator(uploadTemplateInput)
  .handler(async ({ data }) => {
    await requireAdmin(data.token);

    const id = nanoid(12);
    const buffer = Buffer.from(data.imageData, "base64");
    const storageKey = await saveTemplate(id, buffer, data.imageExt);

    await db.insert(templates).values({
      id,
      name: data.name,
      filePath: storageKey,
      placeholders: data.placeholders,
      width: data.width,
      height: data.height,
    });

    return { id, name: data.name };
  });

const tokenInput = z.object({ token: z.string() });

export const listTemplates = createServerFn()
  .inputValidator(tokenInput)
  .handler(async ({ data }) => {
    await requireAdmin(data.token);

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
  });

const updateTemplateInput = z.object({
  token: z.string(),
  id: z.string(),
  name: z.string().optional(),
  placeholders: z.string().optional(),
});

export const updateTemplate = createServerFn({ method: "POST" })
  .inputValidator(updateTemplateInput)
  .handler(async ({ data }) => {
    await requireAdmin(data.token);

    const updates: Record<string, unknown> = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.placeholders !== undefined) updates.placeholders = data.placeholders;

    await db.update(templates).set(updates).where(eq(templates.id, data.id));
    return { success: true };
  });

const deleteTemplateInput = z.object({ token: z.string(), id: z.string() });

export const deleteTemplate = createServerFn({ method: "POST" })
  .inputValidator(deleteTemplateInput)
  .handler(async ({ data }) => {
    await requireAdmin(data.token);

    // Check if any workshop uses this template
    const { workshops } = await import("#/db/schema");
    const { count } = await import("drizzle-orm");
    const [refs] = await db
      .select({ total: count() })
      .from(workshops)
      .where(eq(workshops.templateId, data.id));

    if (refs.total > 0) {
      throw new Error(
        `Cannot delete: ${refs.total} workshop(s) use this template. Reassign them first.`,
      );
    }

    const template = await db.query.templates.findFirst({
      where: eq(templates.id, data.id),
    });

    if (template) {
      await deleteStorageFile(template.filePath);
      await db.delete(templates).where(eq(templates.id, data.id));
    }

    return { success: true };
  });

const testPreviewInput = z.object({
  token: z.string(),
  templateId: z.string().optional(),
  imageData: z.string().optional(),
  imageExt: z.string().optional(),
  placeholders: z.string(),
  width: z.number(),
  height: z.number(),
});

export const testPreviewTemplate = createServerFn({ method: "POST" })
  .inputValidator(testPreviewInput)
  .handler(async ({ data }) => {
    await requireAdmin(data.token);

    const { generateCertificateImage, generateCertId } = await import(
      "../services/certificate-gen"
    );

    let templateBuffer: Buffer;
    const workshopCode = "__preview__";

    if (data.templateId) {
      // Use existing template
      const template = await db.query.templates.findFirst({
        where: eq(templates.id, data.templateId),
      });
      if (!template) throw new Error("Template not found");
      templateBuffer = await readStorageFile(template.filePath);
    } else if (data.imageData) {
      // Use uploaded image (not yet saved)
      templateBuffer = Buffer.from(data.imageData, "base64");
    } else {
      throw new Error("Provide either templateId or imageData");
    }

    const placeholders = JSON.parse(data.placeholders);
    const certId = generateCertId();

    const { pngStorageKey, pdfStorageKey } = await generateCertificateImage({
      templateBuffer,
      templateWidth: data.width,
      templateHeight: data.height,
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
      workshopCode,
    });

    try {
      const imgBuffer = await readStorageFile(pngStorageKey);
      return { base64: imgBuffer.toString("base64") };
    } finally {
      await deleteStorageFile(pngStorageKey).catch(() => {});
      await deleteStorageFile(pdfStorageKey).catch(() => {});
    }
  });
