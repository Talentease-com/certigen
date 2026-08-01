"use client";

import { useState } from "react";

/**
 * Renaming a template and replacing its background image were both
 * supported by the PATCH endpoint but had no UI once the old edit-modal
 * form got replaced by the canvas editor. Collapsed by default so it
 * doesn't compete with the canvas for attention.
 */
export function TemplateMetaPanel({
	template,
	saving,
	onSave,
}: {
	template: { id: string; name: string };
	saving: boolean;
	onSave: (data: { name: string; file: File | null }) => Promise<boolean>;
}) {
	const [expanded, setExpanded] = useState(false);
	const [name, setName] = useState(template.name);
	const [file, setFile] = useState<File | null>(null);
	const [error, setError] = useState<string | null>(null);

	const handleSave = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		try {
			if (name.trim() === template.name && !file) {
				setExpanded(false);
				return;
			}

			if (await onSave({ name, file })) {
				setFile(null);
				setExpanded(false);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to update template");
		}
	};

	if (!expanded) {
		return (
			<div className="mb-4">
				<button
					type="button"
					onClick={() => setExpanded(true)}
					className="text-xs text-gray-400 hover:text-gray-600 underline"
				>
					Rename or replace background image
				</button>
			</div>
		);
	}

	return (
		<form onSubmit={handleSave} className="glass-card rounded-xl p-4 mb-4 space-y-3 animate-scale-in">
			<div className="flex items-center justify-between">
				<h3 className="text-sm font-semibold text-gray-900">Template Details</h3>
				<button
					type="button"
					onClick={() => setExpanded(false)}
					disabled={saving}
					className="text-xs text-gray-400 hover:text-gray-600"
				>
					Cancel
				</button>
			</div>

			{error && <p className="text-xs text-red-600">{error}</p>}

			<div>
				<label className="block text-[11px] font-medium text-gray-500 mb-1">
					Template Name
				</label>
				<input
					type="text"
					value={name}
					onChange={(e) => setName(e.target.value)}
					disabled={saving}
					className="input-field text-sm"
					required
				/>
			</div>

			<div>
				<label className="block text-[11px] font-medium text-gray-500 mb-1">
					Replace Background Image (optional)
				</label>
				<input
					type="file"
					accept="image/*"
					onChange={(e) => setFile(e.target.files?.[0] ?? null)}
					disabled={saving}
					className="input-field text-sm"
				/>
				<p className="text-[11px] text-gray-400 mt-1">
					The canvas will resize to match the new image and scale existing
					elements to preserve their placement.
				</p>
			</div>

			<button type="submit" className="btn-primary text-sm" disabled={saving}>
				{saving ? "Saving..." : "Save Changes"}
			</button>
		</form>
	);
}
