import { create } from "zustand";

interface AuthState {
	token: string | null;
	userId: string | null;
	setIdentity: (identity: { token: string | null; userId: string | null }) => void;
}

/**
 * Bridges the @shoojs/react identity (a React-context hook) into a plain
 * store so non-component code (Zustand actions, one-off fetches) can read
 * the current admin token without needing hook access.
 */
export const useAuthStore = create<AuthState>((set) => ({
	token: null,
	userId: null,
	setIdentity: ({ token, userId }) => set({ token, userId }),
}));
