export class ApiError extends Error {
	constructor(
		message: string,
		public readonly status: number,
	) {
		super(message);
		this.name = "ApiError";
	}
}

async function parseResponse<T>(res: Response): Promise<T> {
	const data = await res.json().catch(() => null);
	if (!res.ok) {
		const message =
			(data && typeof data === "object" && "error" in data && String(data.error)) ||
			`Request failed with status ${res.status}`;
		throw new ApiError(message, res.status);
	}
	return data as T;
}

export async function apiGet<T>(path: string, token?: string): Promise<T> {
	const res = await fetch(path, {
		headers: token ? { authorization: `Bearer ${token}` } : undefined,
	});
	return parseResponse<T>(res);
}

export async function apiSend<T>(
	path: string,
	method: "POST" | "PATCH" | "DELETE",
	body?: unknown,
	token?: string,
): Promise<T> {
	const res = await fetch(path, {
		method,
		headers: {
			"content-type": "application/json",
			...(token ? { authorization: `Bearer ${token}` } : {}),
		},
		body: body !== undefined ? JSON.stringify(body) : undefined,
	});
	return parseResponse<T>(res);
}
