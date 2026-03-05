import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "#/db";
import { certificates, workshops, templates } from "#/db/schema";
import { eq, and, count } from "drizzle-orm";
import {
  generateCertificateImage,
  generateCertId,
  type PlaceholderConfig,
} from "../services/certificate-gen";
import { sendCertificateEmail } from "../services/email";
import { getCertificateOutputDir } from "../services/storage";

const generateCertInput = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  workshopCode: z.string().min(1),
});

export const generateCertificate = createServerFn({ method: "POST" })
  .inputValidator(generateCertInput)
  .handler(async ({ data }) => {
    const { name, email, workshopCode } = data;

    // 1. Find workshop by code
    const workshop = await db.query.workshops.findFirst({
      where: and(eq(workshops.code, workshopCode), eq(workshops.isActive, true)),
    });

    if (!workshop) {
      throw new Error("Invalid or inactive workshop code.");
    }

    // 2. Check rate limit: max 2 certs per email per workshop
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

    // 3. Load template
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

    // 4. Generate certificate
    const certId = generateCertId();
    const baseUrl = process.env.BASE_URL || "http://localhost:3000";
    const verifyUrl = `${baseUrl}/verify/${certId}`;
    const outputDir = getCertificateOutputDir(workshopCode);

    const values: Record<string, string> = {
      name,
      workshop_title: workshop.title,
      date: workshop.date,
    };

    const { pdfPath } = await generateCertificateImage({
      templatePath: template.filePath,
      templateWidth: template.width,
      templateHeight: template.height,
      placeholders: placeholderConfigs,
      values,
      certId,
      verifyUrl,
      outputDir,
    });
    // 5. Save to DB
    await db.insert(certificates).values({
      id: certId,
      workshopId: workshop.id,
      name,
      email: email.toLowerCase(),
      filePath: pdfPath,
    }).onConflictDoUpdate({
      target: [certificates.email, certificates.workshopId],
      set: {
        id: certId,
        name,
        filePath: pdfPath,
        issuedAt: new Date(),
      }
    });

    // 6. Send email (non-blocking)
    sendCertificateEmail({
      to: email,
      participantName: name,
      workshopTitle: workshop.title,
      workshopDate: workshop.date,
      pdfPath,
      verifyUrl,
    }).catch((err) => {
      console.error("Failed to send certificate email:", err);
    });

    // 7. Return result
    const remainingAttempts = 2 - (existing.total + 1);
    return {
      certId,
      downloadUrl: `/api/certificates/${certId}/download`,
      remainingAttempts,
    };
  });

const verifyCertInput = z.object({ id: z.string() });

export const verifyCertificate = createServerFn()
  .inputValidator(verifyCertInput)
  .handler(async ({ data }) => {
    const cert = await db.query.certificates.findFirst({
      where: eq(certificates.id, data.id),
    });

    if (!cert) {
      return null;
    }

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
  });

const workshopCodeInput = z.object({ code: z.string() });

export const getWorkshopByCode = createServerFn()
  .inputValidator(workshopCodeInput)
  .handler(async ({ data }) => {
    const code = data.code.trim().toUpperCase();
    console.log("[getWorkshopByCode] Looking up code:", JSON.stringify(code));

    const workshop = await db.query.workshops.findFirst({
      where: and(eq(workshops.code, code), eq(workshops.isActive, true)),
    });

    console.log("[getWorkshopByCode] Found:", workshop ? workshop.code : "null");

    if (!workshop) return null;

    return {
      id: workshop.id,
      code: workshop.code,
      title: workshop.title,
      date: workshop.date,
    };
  });

const remainingAttemptsInput = z.object({
  email: z.string().email(),
  workshopCode: z.string(),
});

export const getRemainingAttempts = createServerFn()
  .inputValidator(remainingAttemptsInput)
  .handler(async ({ data }) => {
    const workshop = await db.query.workshops.findFirst({
      where: eq(workshops.code, data.workshopCode),
    });

    if (!workshop) return 2;

    const [existing] = await db
      .select({ total: count() })
      .from(certificates)
      .where(
        and(
          eq(certificates.email, data.email.toLowerCase()),
          eq(certificates.workshopId, workshop.id),
        ),
      );

    return 2 - existing.total;
  });

const downloadCertInput = z.object({ id: z.string() });

export const downloadCertificate = createServerFn()
  .inputValidator(downloadCertInput)
  .handler(async ({ data }) => {
    const cert = await db.query.certificates.findFirst({
      where: eq(certificates.id, data.id),
    });

    if (!cert) throw new Error("Certificate not found");

    const fs = await import("node:fs");
    if (!fs.existsSync(cert.filePath)) {
      throw new Error("Certificate file not found on server");
    }

    const pdfBuffer = fs.readFileSync(cert.filePath);
    return {
      base64: pdfBuffer.toString("base64"),
      filename: `${cert.name.replace(/\s+/g, "_")}_Certificate.pdf`,
    };
  });
