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

export function parseCertificateDesignStrict(json: string): CertificateDesign {
	return certificateDesignSchema.parse(JSON.parse(json));
}

export function parseCertificateDesign(json: string): CertificateDesign {
	try {
		return parseCertificateDesignStrict(json);
	} catch {
		return { elements: [] };
	}
}

export function serializeCertificateDesign(design: CertificateDesign): string {
	return JSON.stringify(design);
}

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

function roundLayoutValue(value: number) {
	return Math.round(value * 100) / 100;
}

/**
 * Preserves an existing design's relative layout when its background image
 * changes pixel dimensions. Text scales uniformly so its glyphs don't
 * distort; QR elements remain square; every resulting box stays selectable
 * inside the new canvas.
 */
export function scaleCertificateDesign(
	design: CertificateDesign,
	from: { width: number; height: number },
	to: { width: number; height: number },
): CertificateDesign {
	if (from.width <= 0 || from.height <= 0 || to.width <= 0 || to.height <= 0) {
		throw new Error("Canvas dimensions must be positive.");
	}

	const scaleX = to.width / from.width;
	const scaleY = to.height / from.height;
	const uniformScale = Math.min(scaleX, scaleY);

	return {
		elements: design.elements.map((element) => {
			let width = element.width * scaleX;
			let height = element.height * scaleY;

			if (element.type === "qr") {
				const side = Math.min(element.width, element.height) * uniformScale;
				width = side;
				height = side;
			}

			width = clamp(roundLayoutValue(width), 1, to.width);
			height = clamp(roundLayoutValue(height), 1, to.height);
			const x = clamp(roundLayoutValue(element.x * scaleX), 0, to.width - width);
			const y = clamp(roundLayoutValue(element.y * scaleY), 0, to.height - height);

			if (element.type === "text") {
				return {
					...element,
					x,
					y,
					width,
					height,
					fontSize: Math.max(1, roundLayoutValue(element.fontSize * uniformScale)),
				};
			}

			return { ...element, x, y, width, height };
		}),
	};
}

/**
 * Moves an element one paint-order slot and rewrites all z-indices to a
 * unique sequence. The original array order is the stable tie-breaker for
 * legacy designs whose elements share a z-index.
 */
export function moveElementLayer(
	elements: CertificateElement[],
	id: string,
	direction: "forward" | "backward",
): CertificateElement[] {
	const ordered = elements
		.map((element, originalIndex) => ({ element, originalIndex }))
		.sort(
			(a, b) =>
				a.element.zIndex - b.element.zIndex || a.originalIndex - b.originalIndex,
		)
		.map(({ element }) => element);
	const index = ordered.findIndex((element) => element.id === id);
	if (index === -1) return elements;

	const target =
		direction === "forward"
			? Math.min(index + 1, ordered.length - 1)
			: Math.max(index - 1, 0);

	if (target !== index) {
		const [element] = ordered.splice(index, 1);
		ordered.splice(target, 0, element);
	}

	return ordered.map((element, zIndex) => ({ ...element, zIndex }));
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
				zIndex: 1,
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
				zIndex: 2,
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
				zIndex: 3,
				opacity: 1,
			},
		],
	};
}
