import { afterEach, describe, expect, it, vi } from "vitest";
import { apiGet, apiSend } from "#/lib/api-client";
import { serializeCertificateDesign, type CertificateElement } from "#/lib/certificate-design";
import { useTemplateEditorStore } from "./template-editor-store";

vi.mock("#/lib/api-client", () => ({
	apiGet: vi.fn(),
	apiSend: vi.fn(),
}));

const template = {
	id: "template-1",
	name: "Original",
	width: 1000,
	height: 500,
	isActive: true,
};

const element: CertificateElement = {
	id: "text",
	type: "text",
	content: "Original",
	x: 100,
	y: 100,
	width: 400,
	height: 80,
	rotation: 0,
	zIndex: 0,
	opacity: 1,
	fontFamily: "Inter",
	fontSize: 40,
	color: "#000000",
	align: "left",
};

function seedEditor() {
	useTemplateEditorStore.setState({
		template,
		elements: [element],
		dirty: true,
		revision: 1,
		saving: false,
		metadataSaving: false,
		error: null,
	});
}

afterEach(() => {
	vi.resetAllMocks();
	useTemplateEditorStore.getState().reset();
});

describe("template editor saves", () => {
	it("keeps newer edits dirty when an older save finishes", async () => {
		let resolveSave!: () => void;
		vi.mocked(apiSend).mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					resolveSave = resolve;
				}) as never,
		);
		seedEditor();

		const saving = useTemplateEditorStore.getState().save("token");
		useTemplateEditorStore
			.getState()
			.updateElement("text", { content: "Changed while saving" });
		resolveSave();
		await saving;

		expect(useTemplateEditorStore.getState()).toMatchObject({
			saving: false,
			dirty: true,
			revision: 2,
		});
	});

	it("marks the submitted revision clean when no newer edits exist", async () => {
		vi.mocked(apiSend).mockResolvedValue({} as never);
		seedEditor();

		await useTemplateEditorStore.getState().save("token");

		expect(useTemplateEditorStore.getState()).toMatchObject({
			saving: false,
			dirty: false,
			revision: 1,
		});
	});

	it("saves metadata and the current design together before reloading", async () => {
		vi.mocked(apiSend).mockResolvedValue({} as never);
		vi.mocked(apiGet).mockResolvedValue({
			template: { ...template, name: "Renamed", design: serializeCertificateDesign({
				elements: [element],
			}) },
			backgroundBase64: "",
		} as never);
		seedEditor();

		const saved = await useTemplateEditorStore
			.getState()
			.saveMetadata({ name: "Renamed", file: null }, "token");

		expect(saved).toBe(true);
		expect(apiSend).toHaveBeenCalledWith(
			"/api/admin/templates/template-1",
			"PATCH",
			{
				name: "Renamed",
				design: serializeCertificateDesign({ elements: [element] }),
			},
			"token",
		);
		expect(useTemplateEditorStore.getState()).toMatchObject({
			template: { ...template, name: "Renamed" },
			dirty: false,
			metadataSaving: false,
		});
	});

	it("locks element mutations while metadata and design are saved together", async () => {
		let resolveSave!: () => void;
		vi.mocked(apiSend).mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					resolveSave = resolve;
				}) as never,
		);
		vi.mocked(apiGet).mockResolvedValue({
			template: {
				...template,
				name: "Renamed",
				design: serializeCertificateDesign({ elements: [element] }),
			},
			backgroundBase64: "",
		} as never);
		seedEditor();

		const saving = useTemplateEditorStore
			.getState()
			.saveMetadata({ name: "Renamed", file: null }, "token");
		useTemplateEditorStore
			.getState()
			.updateElement("text", { content: "Should be blocked" });

		expect(useTemplateEditorStore.getState()).toMatchObject({
			metadataSaving: true,
			revision: 1,
			elements: [{ content: "Original" }],
		});

		resolveSave();
		await saving;
	});
});
