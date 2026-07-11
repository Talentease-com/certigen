import { z } from "zod";

/**
 * A certificate template is a background image plus a list of layered
 * elements. Text elements can either hold literal content or bind to a
 * per-certificate data field (name / workshop title / date); everything
 * else (logos, decorative text, the verification QR) is positioned the
 * same way an admin drags it in the editor.
 *
 * This module is isomorphic: the editor (client) and the render engine
 * (server) both import it, so the canvas and the final PNG always agree
 * on what an element is.
 */

export const DYNAMIC_FIELDS = ["name", "workshop_title", "date"] as const;
export type DynamicField = (typeof DYNAMIC_FIELDS)[number];

export const DYNAMIC_FIELD_LABELS: Record<DynamicField, string> = {
	name: "Participant Name",
	workshop_title: "Workshop Title",
	date: "Date",
};

const baseElementSchema = z.object({
	id: z.string(),
	x: z.number(),
	y: z.number(),
	width: z.number().positive(),
	height: z.number().positive(),
	rotation: z.number().default(0),
	zIndex: z.number().default(0),
	opacity: z.number().min(0).max(1).default(1),
});

export const textElementSchema = baseElementSchema.extend({
	type: z.literal("text"),
	content: z.string().default(""),
	boundTo: z.enum(DYNAMIC_FIELDS).optional(),
	fontFamily: z.string().default("Inter"),
	fontSize: z.number().positive().default(48),
	color: z.string().default("#333333"),
	align: z.enum(["left", "center", "right"]).default("center"),
});

export const imageElementSchema = baseElementSchema.extend({
	type: z.literal("image"),
	storageKey: z.string(),
});

export const qrElementSchema = baseElementSchema.extend({
	type: z.literal("qr"),
});

export const certificateElementSchema = z.discriminatedUnion("type", [
	textElementSchema,
	imageElementSchema,
	qrElementSchema,
]);

export const certificateDesignSchema = z.object({
	elements: z.array(certificateElementSchema),
});

export type TextElement = z.infer<typeof textElementSchema>;
export type ImageElement = z.infer<typeof imageElementSchema>;
export type QrElement = z.infer<typeof qrElementSchema>;
export type CertificateElement = z.infer<typeof certificateElementSchema>;
export type CertificateDesign = z.infer<typeof certificateDesignSchema>;

export function parseCertificateDesign(json: string): CertificateDesign {
	try {
		return certificateDesignSchema.parse(JSON.parse(json));
	} catch {
		return { elements: [] };
	}
}

export function serializeCertificateDesign(design: CertificateDesign): string {
	return JSON.stringify(design);
}

/** Sensible starting layout for a freshly uploaded template. */
export function defaultDesign(width: number, height: number): CertificateDesign {
	return {
		elements: [
			{
				id: "name",
				type: "text",
				boundTo: "name",
				content: "",
				x: 0,
				y: Math.round(height * 0.44),
				width,
				height: 100,
				rotation: 0,
				zIndex: 0,
				opacity: 1,
				fontFamily: "Inter",
				fontSize: 72,
				color: "#333333",
				align: "center",
			},
			{
				id: "workshop_title",
				type: "text",
				boundTo: "workshop_title",
				content: "",
				x: 0,
				y: Math.round(height * 0.5),
				width,
				height: 70,
				rotation: 0,
				zIndex: 0,
				opacity: 1,
				fontFamily: "Inter",
				fontSize: 48,
				color: "#555555",
				align: "center",
			},
			{
				id: "date",
				type: "text",
				boundTo: "date",
				content: "",
				x: 0,
				y: Math.round(height * 0.545),
				width,
				height: 50,
				rotation: 0,
				zIndex: 0,
				opacity: 1,
				fontFamily: "Inter",
				fontSize: 36,
				color: "#888888",
				align: "center",
			},
			{
				id: "qr",
				type: "qr",
				x: width - 320,
				y: height - 320,
				width: 280,
				height: 280,
				rotation: 0,
				zIndex: 0,
				opacity: 1,
			},
		],
	};
}
