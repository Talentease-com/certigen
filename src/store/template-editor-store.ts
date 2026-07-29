import { create } from "zustand";
import { nanoid } from "nanoid";
import { apiGet, apiSend } from "#/lib/api-client";
import {
	moveElementLayer,
	parseCertificateDesign,
	serializeCertificateDesign,
	type CertificateElement,
	type DynamicField,
} from "#/lib/certificate-design";

interface TemplateMeta {
	id: string;
	name: string;
	width: number;
	height: number;
	isActive: boolean;
}

interface TemplateEditorState {
	template: TemplateMeta | null;
	backgroundUrl: string | null;
	elements: CertificateElement[];
	selectedId: string | null;
	/** storageKey -> blob URL, so Konva only ever needs to load an asset once. */
	assetUrls: Record<string, string>;
	loading: boolean;
	saving: boolean;
	metadataSaving: boolean;
	dirty: boolean;
	revision: number;
	error: string | null;
	previewUrl: string | null;
	previewing: boolean;

	load: (templateId: string, token?: string) => Promise<void>;
	selectElement: (id: string | null) => void;
	addText: () => void;
	addDynamicField: (field: DynamicField) => void;
	addImageElement: (file: File, token?: string) => Promise<void>;
	updateElement: (id: string, patch: Partial<CertificateElement>) => void;
	removeElement: (id: string) => void;
	bringForward: (id: string) => void;
	sendBackward: (id: string) => void;
	save: (token?: string) => Promise<void>;
	saveMetadata: (
		data: { name: string; file: File | null },
		token?: string,
	) => Promise<boolean>;
	testGenerate: (token?: string) => Promise<void>;
	reset: () => void;
}

const initial = {
	template: null as TemplateMeta | null,
	backgroundUrl: null as string | null,
	elements: [] as CertificateElement[],
	selectedId: null as string | null,
	assetUrls: {} as Record<string, string>,
	loading: false,
	saving: false,
	metadataSaving: false,
	dirty: false,
	revision: 0,
	error: null as string | null,
	previewUrl: null as string | null,
	previewing: false,
};

function base64ToBlobUrl(base64: string, mime = "image/png") {
	const byteChars = atob(base64);
	const byteArray = new Uint8Array(byteChars.length);
	for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
	return URL.createObjectURL(new Blob([byteArray], { type: mime }));
}

function nextZIndex(elements: CertificateElement[]) {
	return elements.reduce((max, el) => Math.max(max, el.zIndex), 0) + 1;
}

export const useTemplateEditorStore = create<TemplateEditorState>((set, get) => ({
	...initial,

	load: async (templateId, token) => {
		set({ ...initial, loading: true });
		try {
			const res = await apiGet<{
				template: TemplateMeta & { design: string };
				backgroundBase64: string;
			}>(`/api/admin/templates/${templateId}`, token);

			const design = parseCertificateDesign(res.template.design);
			const backgroundUrl = base64ToBlobUrl(res.backgroundBase64);

			// Prefetch any existing image elements' assets so the canvas can
			// render them immediately.
			const assetUrls: Record<string, string> = {};
			for (const el of design.elements) {
				if (el.type === "image" && !assetUrls[el.storageKey]) {
					try {
						const asset = await apiGet<{ base64: string }>(
							`/api/admin/templates/${templateId}/assets?key=${encodeURIComponent(el.storageKey)}`,
							token,
						);
						assetUrls[el.storageKey] = base64ToBlobUrl(asset.base64);
					} catch (err) {
						console.error("Failed to load asset", el.storageKey, err);
					}
				}
			}

			set({
				template: {
					id: res.template.id,
					name: res.template.name,
					width: res.template.width,
					height: res.template.height,
					isActive: res.template.isActive,
				},
				backgroundUrl,
				elements: design.elements,
				assetUrls,
				loading: false,
			});
		} catch (err) {
			set({ error: err instanceof Error ? err.message : String(err), loading: false });
		}
	},

	selectElement: (id) => set({ selectedId: id }),

	addText: () => {
		const { template, metadataSaving } = get();
		if (!template || metadataSaving) return;
		const id = nanoid(8);
		set((state) => {
			const el: CertificateElement = {
				id,
				type: "text",
				content: "New text",
				x: template.width / 2 - 200,
				y: template.height / 2,
				width: 400,
				height: 80,
				rotation: 0,
				zIndex: nextZIndex(state.elements),
				opacity: 1,
				fontFamily: "Inter",
				fontSize: 48,
				color: "#333333",
				align: "center",
			};
			return {
				elements: [...state.elements, el],
				selectedId: id,
				dirty: true,
				revision: state.revision + 1,
			};
		});
	},

	addDynamicField: (field) => {
		const { template, metadataSaving } = get();
		if (!template || metadataSaving) return;
		const id = nanoid(8);
		set((state) => {
			const el: CertificateElement = {
				id,
				type: "text",
				content: "",
				boundTo: field,
				x: template.width / 2 - 200,
				y: template.height / 2,
				width: 400,
				height: 80,
				rotation: 0,
				zIndex: nextZIndex(state.elements),
				opacity: 1,
				fontFamily: "Inter",
				fontSize: 48,
				color: "#333333",
				align: "center",
			};
			return {
				elements: [...state.elements, el],
				selectedId: id,
				dirty: true,
				revision: state.revision + 1,
			};
		});
	},

	addImageElement: async (file, token) => {
		const { template, metadataSaving } = get();
		if (!template || metadataSaving) return;
		try {
			const buffer = await file.arrayBuffer();
			const base64 = btoa(
				new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ""),
			);
			const ext = file.name.substring(file.name.lastIndexOf(".")) || ".png";

			const res = await apiSend<{ storageKey: string }>(
				`/api/admin/templates/${template.id}/assets`,
				"POST",
				{ imageData: base64, imageExt: ext },
				token,
			);

			const id = nanoid(8);
			const size = 240;
			set((state) => {
				if (state.metadataSaving || state.template?.id !== template.id) {
					return state;
				}
				const el: CertificateElement = {
					id,
					type: "image",
					storageKey: res.storageKey,
					x: template.width / 2 - size / 2,
					y: template.height / 2 - size / 2,
					width: size,
					height: size,
					rotation: 0,
					zIndex: nextZIndex(state.elements),
					opacity: 1,
				};
				return {
					elements: [...state.elements, el],
					selectedId: id,
					dirty: true,
					assetUrls: {
						...state.assetUrls,
						[res.storageKey]: URL.createObjectURL(file),
					},
					revision: state.revision + 1,
				};
			});
		} catch (err) {
			set({ error: err instanceof Error ? err.message : "Failed to add image" });
		}
	},

	updateElement: (id, patch) => {
		set((state) =>
			state.metadataSaving
				? state
				: {
						elements: state.elements.map((el) =>
							el.id === id ? ({ ...el, ...patch } as CertificateElement) : el,
						),
						dirty: true,
						revision: state.revision + 1,
					},
		);
	},

	removeElement: (id) => {
		set((state) =>
			state.metadataSaving
				? state
				: {
						elements: state.elements.filter((el) => el.id !== id),
						selectedId: state.selectedId === id ? null : state.selectedId,
						dirty: true,
						revision: state.revision + 1,
					},
		);
	},

	bringForward: (id) => {
		set((state) =>
			state.metadataSaving
				? state
				: {
						elements: moveElementLayer(state.elements, id, "forward"),
						dirty: true,
						revision: state.revision + 1,
					},
		);
	},

	sendBackward: (id) => {
		set((state) =>
			state.metadataSaving
				? state
				: {
						elements: moveElementLayer(state.elements, id, "backward"),
						dirty: true,
						revision: state.revision + 1,
					},
		);
	},

	save: async (token) => {
		const { template, elements, revision, saving, metadataSaving } = get();
		if (!template || saving || metadataSaving) return;
		set({ saving: true, error: null });
		try {
			await apiSend(
				`/api/admin/templates/${template.id}`,
				"PATCH",
				{ design: serializeCertificateDesign({ elements }) },
				token,
			);
			set((state) => ({
				saving: false,
				dirty: state.revision === revision ? false : state.dirty,
			}));
		} catch (err) {
			set({ error: err instanceof Error ? err.message : "Failed to save", saving: false });
		}
	},

	saveMetadata: async ({ name, file }, token) => {
		const { template, elements, saving, metadataSaving } = get();
		if (!template || saving || metadataSaving) return false;
		const trimmedName = name.trim();
		if (!trimmedName) {
			set({ error: "Template name is required." });
			return false;
		}

		set({ metadataSaving: true, error: null });
		try {
			const payload: Record<string, unknown> = {
				name: trimmedName,
				design: serializeCertificateDesign({ elements }),
			};
			if (file) {
				const buffer = await file.arrayBuffer();
				payload.imageData = btoa(
					new Uint8Array(buffer).reduce(
						(data, byte) => data + String.fromCharCode(byte),
						"",
					),
				);
				payload.imageExt =
					file.name.substring(file.name.lastIndexOf(".")) || ".png";
			}

			await apiSend(
				`/api/admin/templates/${template.id}`,
				"PATCH",
				payload,
				token,
			);
			await get().load(template.id, token);
			return true;
		} catch (err) {
			set({
				error:
					err instanceof Error ? err.message : "Failed to update template",
				metadataSaving: false,
			});
			return false;
		}
	},

	testGenerate: async (token) => {
		const { template, elements } = get();
		if (!template) return;
		set({ previewing: true, error: null });
		try {
			const res = await apiSend<{ base64: string }>(
				"/api/admin/templates/preview",
				"POST",
				{ templateId: template.id, elements },
				token,
			);
			set({ previewUrl: base64ToBlobUrl(res.base64), previewing: false });
		} catch (err) {
			set({
				error: err instanceof Error ? err.message : "Failed to generate preview",
				previewing: false,
			});
		}
	},

	reset: () => set(initial),
}));
