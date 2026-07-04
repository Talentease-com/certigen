import { create } from "zustand";
import { apiGet, apiSend } from "#/lib/api-client";
import { downloadBase64File } from "#/lib/download";

interface GenerateResult {
	certId: string;
	downloadUrl: string;
	remainingAttempts: number;
}

interface CertificateState {
	name: string;
	email: string;
	loading: boolean;
	showConfirm: boolean;
	error: string;
	result: GenerateResult | null;
	previewImage: string | null;
	isDownloading: boolean;

	setName: (name: string) => void;
	setEmail: (email: string) => void;
	openConfirm: () => void;
	closeConfirm: () => void;
	generate: (workshopCode: string) => Promise<void>;
	download: () => Promise<void>;
	reset: () => void;
}

const initialState = {
	name: "",
	email: "",
	loading: false,
	showConfirm: false,
	error: "",
	result: null as GenerateResult | null,
	previewImage: null as string | null,
	isDownloading: false,
};

export const useCertificateStore = create<CertificateState>((set, get) => ({
	...initialState,

	setName: (name) => set({ name }),
	setEmail: (email) => set({ email }),
	openConfirm: () => set({ showConfirm: true, error: "" }),
	closeConfirm: () => set({ showConfirm: false }),

	generate: async (workshopCode) => {
		set({ showConfirm: false, loading: true, error: "" });
		const { name, email } = get();
		try {
			const res = await apiSend<GenerateResult>("/api/certificates", "POST", {
				name: name.trim(),
				email: email.trim(),
				workshopCode,
			});
			set({ result: res, loading: false });

			apiGet<{ base64: string; filename: string }>(
				`/api/certificates/${res.certId}/download`,
			)
				.then((downloadRes) => set({ previewImage: downloadRes.base64 }))
				.catch((err) => console.error("Could not fetch preview", err));
		} catch (err) {
			set({
				error: err instanceof Error ? err.message : "Something went wrong.",
				loading: false,
			});
		}
	},

	download: async () => {
		const { result, previewImage, isDownloading, name } = get();
		if (!result || isDownloading) return;
		set({ isDownloading: true });
		try {
			let base64 = previewImage;
			let filename = `${name.replace(/\s+/g, "_")}_Certificate.png`;
			if (!base64) {
				const res = await apiGet<{ base64: string; filename: string }>(
					`/api/certificates/${result.certId}/download`,
				);
				base64 = res.base64;
				filename = res.filename;
			}
			downloadBase64File(base64, filename);
		} catch {
			alert("Failed to download certificate");
		} finally {
			set({ isDownloading: false });
		}
	},

	reset: () => set(initialState),
}));
