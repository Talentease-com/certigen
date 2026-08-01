"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiSend } from "#/lib/api-client";
import { parseCertificateDesign } from "#/lib/certificate-design";
import { useAdminStore, type Template } from "#/store/admin-store";
import { useAuthStore } from "#/store/auth-store";
import { Dialog, DialogContent, DialogTitle } from "#/components/ui/dialog";

export default function TemplatesPage() {
	const token = useAuthStore((state) => state.token);
	const {
		templates: templatesList,
		loading,
		loadTemplates,
		uploadTemplate,
		deleteTemplate,
		restoreTemplate,
	} = useAdminStore();

	const fileInputRef = useRef<HTMLInputElement>(null);
	const [showUpload, setShowUpload] = useState(false);
	const [templateName, setTemplateName] = useState("");
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [fileBase64, setFileBase64] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	const [previewFor, setPreviewFor] = useState<Template | null>(null);
	const [previewingId, setPreviewingId] = useState<string | null>(null);
	const [previewImage, setPreviewImage] = useState<string | null>(null);
	const [previewError, setPreviewError] = useState<string | null>(null);

	useEffect(() => {
		if (token) loadTemplates();
	}, [token, loadTemplates]);

	const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0] || null;
		setSelectedFile(file);
		if (file) {
			const buffer = await file.arrayBuffer();
			const base64 = btoa(
				new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ""),
			);
			setFileBase64(base64);
		} else {
			setFileBase64(null);
		}
	};

	const handleUpload = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!fileBase64 || !selectedFile) return;
		setSubmitting(true);
		try {
			const ext = selectedFile.name.substring(selectedFile.name.lastIndexOf("."));
			await uploadTemplate({
				name: templateName,
				imageData: fileBase64,
				imageExt: ext || ".png",
			});
			setTemplateName("");
			setSelectedFile(null);
			setFileBase64(null);
			if (fileInputRef.current) fileInputRef.current.value = "";
			setShowUpload(false);
		} catch (err) {
			alert(err instanceof Error ? err.message : "Failed to upload template");
		} finally {
			setSubmitting(false);
		}
	};

	const handleDelete = async (id: string) => {
		if (
			!confirm(
				"Delete this template? It will be hidden from new workshops, but existing workshops and certificates that use it will keep working.",
			)
		)
			return;
		try {
			await deleteTemplate(id);
		} catch (err) {
			alert(err instanceof Error ? err.message : "Failed to delete template");
		}
	};

	const handleRestore = async (id: string) => {
		try {
			await restoreTemplate(id);
		} catch (err) {
			alert(err instanceof Error ? err.message : "Failed to restore template");
		}
	};

	const handlePreview = async (t: Template) => {
		setPreviewFor(t);
		setPreviewImage(null);
		setPreviewError(null);
		setPreviewingId(t.id);
		try {
			const design = parseCertificateDesign(t.design);
			const res = await apiSend<{ base64: string }>(
				"/api/admin/templates/preview",
				"POST",
				{ templateId: t.id, elements: design.elements },
				token ?? undefined,
			);
			setPreviewImage(res.base64);
		} catch (err) {
			setPreviewError(err instanceof Error ? err.message : "Failed to generate preview");
		} finally {
			setPreviewingId(null);
		}
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center py-20">
				<div className="w-6 h-6 border-2 border-te-orange/30 border-t-te-orange rounded-full animate-spin" />
			</div>
		);
	}

	return (
		<div className="animate-fade-in-up">
			<div className="flex items-center justify-between mb-6">
				<h1 className="text-2xl font-bold text-gray-900">Templates</h1>
				<button
					type="button"
					className="btn-primary text-sm"
					onClick={() => setShowUpload(!showUpload)}
				>
					{showUpload ? "Cancel" : "+ Upload Template"}
				</button>
			</div>

			{showUpload && (
				<form
					onSubmit={handleUpload}
					className="glass-card rounded-2xl p-6 mb-6 animate-scale-in"
				>
					<h3 className="font-semibold text-gray-900 mb-4">Upload New Template</h3>
					<p className="text-xs text-gray-500 mb-4">
						Just the background image for now — any size or aspect ratio works, the
						canvas will match it exactly. Once it&apos;s uploaded, open the design
						editor to place text, add logos, and fine-tune everything.
					</p>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">
								Template Name
							</label>
							<input
								type="text"
								value={templateName}
								onChange={(e) => setTemplateName(e.target.value)}
								placeholder="e.g. Default Certificate"
								className="input-field"
								required
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">
								Template Image
							</label>
							<input
								ref={fileInputRef}
								type="file"
								accept="image/*"
								onChange={handleFileChange}
								className="input-field"
								required
							/>
						</div>
					</div>
					<div className="flex justify-end gap-3">
						<button
							type="button"
							className="btn-secondary text-sm"
							onClick={() => setShowUpload(false)}
						>
							Cancel
						</button>
						<button
							type="submit"
							className="btn-primary text-sm"
							disabled={submitting || !selectedFile || !templateName}
						>
							{submitting ? "Uploading..." : "Upload & Continue"}
						</button>
					</div>
				</form>
			)}

			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
				{templatesList.length === 0 ? (
					<div className="col-span-full glass-card rounded-2xl p-12 text-center text-gray-400">
						<div className="text-3xl mb-2">🖼️</div>
						No templates yet. Upload your first one above.
					</div>
				) : (
					templatesList.map((t) => (
						<div
							key={t.id}
							className={`glass-card rounded-xl p-5 ${!t.isActive ? "opacity-60" : ""}`}
						>
							<div className="flex items-start justify-between mb-3">
								<h3 className="font-semibold text-gray-900 text-sm">{t.name}</h3>
								{!t.isActive && (
									<span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-semibold uppercase tracking-wider">
										Disabled
									</span>
								)}
							</div>
							<div className="text-xs text-gray-500 space-y-1 mb-4">
								<p>
									{t.width}×{t.height}px
								</p>
								<p>{parseCertificateDesign(t.design).elements.length} element(s)</p>
								<p>{new Date(t.createdAt).toLocaleDateString()}</p>
							</div>
							<div className="flex items-center gap-3 pt-3 border-t border-gray-100">
								<button
									type="button"
									onClick={() => handlePreview(t)}
									disabled={previewingId === t.id}
									className="text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50"
								>
									{previewingId === t.id ? "Generating..." : "Preview"}
								</button>
								<Link
									href={`/admin/templates/${t.id}/edit`}
									className="text-xs font-medium text-blue-500 hover:text-blue-700 transition-colors"
								>
									Edit Design
								</Link>
								{t.isActive ? (
									<button
										type="button"
										onClick={() => handleDelete(t.id)}
										className="text-xs font-medium text-red-400 hover:text-red-600 transition-colors"
									>
										Delete
									</button>
								) : (
									<button
										type="button"
										onClick={() => handleRestore(t.id)}
										className="text-xs font-medium text-green-600 hover:text-green-700 transition-colors"
									>
										Restore
									</button>
								)}
							</div>
						</div>
					))
				)}
			</div>

			<Dialog
				open={!!previewFor}
				onOpenChange={(open) => {
					if (!open) {
						setPreviewFor(null);
						setPreviewImage(null);
						setPreviewError(null);
					}
				}}
			>
				<DialogContent className="sm:max-w-2xl">
					<DialogTitle>{previewFor?.name} — Preview</DialogTitle>
					<div className="bg-gray-100 rounded-xl border-2 border-dashed border-gray-200 min-h-[300px] flex items-center justify-center overflow-hidden">
						{previewImage ? (
							// eslint-disable-next-line @next/next/no-img-element
							<img
								src={`data:image/png;base64,${previewImage}`}
								alt="Certificate preview"
								className="w-full h-auto rounded-lg"
							/>
						) : previewError ? (
							<p className="text-sm text-red-600 p-6 text-center">{previewError}</p>
						) : (
							<div className="w-6 h-6 border-2 border-te-orange/30 border-t-te-orange rounded-full animate-spin" />
						)}
					</div>
					<div className="flex justify-end gap-3 mt-2">
						<button
							type="button"
							className="btn-secondary text-sm"
							onClick={() => setPreviewFor(null)}
						>
							Close
						</button>
						{previewFor && (
							<Link
								href={`/admin/templates/${previewFor.id}/edit`}
								className="btn-primary text-sm"
							>
								Edit Placement
							</Link>
						)}
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
