import { create } from "zustand";
import { apiGet, apiSend } from "#/lib/api-client";
import { useAuthStore } from "./auth-store";

export interface Workshop {
	id: string;
	code: string;
	title: string;
	date: string;
	templateId: string | null;
	isActive: boolean;
	createdAt: string;
}

export interface Template {
	id: string;
	name: string;
	width: number;
	height: number;
	placeholders: string;
	isActive: boolean;
	createdAt: string;
}

export interface CertificateRow {
	id: string;
	name: string;
	email: string;
	issuedAt: string;
	workshopTitle: string;
	workshopCode: string;
	workshopDate: string;
}

export interface Stats {
	totalWorkshops: number;
	totalCertificates: number;
	totalTemplates: number;
}

interface AdminState {
	workshops: Workshop[];
	templates: Template[];
	certificates: CertificateRow[];
	stats: Stats | null;
	loading: boolean;
	error: string | null;

	loadDashboard: () => Promise<void>;
	loadWorkshops: () => Promise<void>;
	loadTemplates: () => Promise<void>;

	createWorkshop: (data: {
		code: string;
		title: string;
		date: string;
		templateId: string;
	}) => Promise<void>;
	updateWorkshop: (
		id: string,
		data: Partial<{
			title: string;
			date: string;
			templateId: string;
			isActive: boolean;
		}>,
	) => Promise<void>;
	deleteWorkshop: (id: string) => Promise<void>;

	uploadTemplate: (data: {
		name: string;
		imageData: string;
		imageExt: string;
		placeholders: string;
		width: number;
		height: number;
	}) => Promise<void>;
	updateTemplate: (
		id: string,
		data: Partial<{
			name: string;
			placeholders: string;
			imageData: string;
			imageExt: string;
		}>,
	) => Promise<void>;
	/** Soft-deletes: marks the template inactive, never removes the row. */
	deleteTemplate: (id: string) => Promise<void>;
	/** Reactivates a previously "deleted" (disabled) template. */
	restoreTemplate: (id: string) => Promise<void>;
}

function authToken() {
	return useAuthStore.getState().token ?? undefined;
}

export const useAdminStore = create<AdminState>((set, get) => ({
	workshops: [],
	templates: [],
	certificates: [],
	stats: null,
	loading: false,
	error: null,

	loadDashboard: async () => {
		set({ loading: true, error: null });
		try {
			const token = authToken();
			const [stats, certs] = await Promise.all([
				apiGet<Stats>("/api/admin/stats", token),
				apiGet<{ certificates: CertificateRow[] }>("/api/admin/certificates", token),
			]);
			set({ stats, certificates: certs.certificates, loading: false });
		} catch (err) {
			set({ error: err instanceof Error ? err.message : String(err), loading: false });
		}
	},

	loadWorkshops: async () => {
		set({ loading: true, error: null });
		try {
			const token = authToken();
			const [w, t] = await Promise.all([
				apiGet<{ workshops: Workshop[] }>("/api/admin/workshops", token),
				apiGet<{ templates: Template[] }>("/api/admin/templates", token),
			]);
			set({ workshops: w.workshops, templates: t.templates, loading: false });
		} catch (err) {
			set({ error: err instanceof Error ? err.message : String(err), loading: false });
		}
	},

	loadTemplates: async () => {
		set({ loading: true, error: null });
		try {
			const token = authToken();
			const t = await apiGet<{ templates: Template[] }>("/api/admin/templates", token);
			set({ templates: t.templates, loading: false });
		} catch (err) {
			set({ error: err instanceof Error ? err.message : String(err), loading: false });
		}
	},

	createWorkshop: async (data) => {
		await apiSend("/api/admin/workshops", "POST", data, authToken());
		await get().loadWorkshops();
	},

	updateWorkshop: async (id, data) => {
		await apiSend(`/api/admin/workshops/${id}`, "PATCH", data, authToken());
		await get().loadWorkshops();
	},

	deleteWorkshop: async (id) => {
		await apiSend(`/api/admin/workshops/${id}`, "DELETE", undefined, authToken());
		await get().loadWorkshops();
	},

	uploadTemplate: async (data) => {
		await apiSend("/api/admin/templates", "POST", data, authToken());
		await get().loadTemplates();
	},

	updateTemplate: async (id, data) => {
		await apiSend(`/api/admin/templates/${id}`, "PATCH", data, authToken());
		await get().loadTemplates();
	},

	deleteTemplate: async (id) => {
		await apiSend(`/api/admin/templates/${id}`, "DELETE", undefined, authToken());
		await get().loadTemplates();
	},

	restoreTemplate: async (id) => {
		await apiSend(`/api/admin/templates/${id}`, "PATCH", { isActive: true }, authToken());
		await get().loadTemplates();
	},
}));
