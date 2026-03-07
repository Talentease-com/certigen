"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
	uploadTemplate,
	updateTemplate,
	deleteTemplate,
	testPreviewTemplate,
} from "@/actions/template-actions";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type Template = {
	id: string;
	name: string;
	width: number;
	height: number;
	placeholders: string;
	createdAt: Date;
};

type PlaceholderField = {
	key: string;
	y: number;
	fontSize: number;
	fontFamily: string;
	color: string;
	align: "left" | "center" | "right";
};

const FONTS = [
	"Inter",
	"Roboto",
	"Open Sans",
	"Lato",
	"Montserrat",
	"Playfair Display",
	"Merriweather",
	"Georgia",
	"Times New Roman",
	"Arial",
	"Helvetica",
	"Great Vibes",
	"Dancing Script",
	"Parisienne",
	"Satisfy",
	"Caveat",
];

const FONT_LINK =
	"https://fonts.googleapis.com/css2?family=Inter&family=Roboto&family=Open+Sans&family=Lato&family=Montserrat&family=Playfair+Display&family=Merriweather&family=Great+Vibes&family=Dancing+Script&family=Parisienne&family=Satisfy&family=Caveat&display=swap";

const DEFAULT_PLACEHOLDERS: PlaceholderField[] = [
	{
		key: "name",
		y: 1100,
		fontSize: 72,
		fontFamily: "Inter",
		color: "#333333",
		align: "center",
	},
	{
		key: "workshop_title",
		y: 1250,
		fontSize: 48,
		fontFamily: "Inter",
		color: "#555555",
		align: "center",
	},
	{
		key: "date",
		y: 1350,
		fontSize: 36,
		fontFamily: "Inter",
		color: "#888888",
		align: "center",
	},
];

function fieldsToJson(fields: PlaceholderField[]): string {
	return JSON.stringify(
		fields.map((f) => ({
			key: f.key,
			x: 0,
			y: f.y,
			fontSize: f.fontSize,
			fontFamily: f.fontFamily,
			color: f.color,
			align: f.align,
		})),
	);
}

function jsonToFields(json: string): PlaceholderField[] {
	try {
		const arr = JSON.parse(json);
		return arr.map((p: Record<string, unknown>) => ({
			key: String(p.key || "name"),
			y: Number(p.y || 0),
			fontSize: Number(p.fontSize || 48),
			fontFamily: String(p.fontFamily || "Inter"),
			color: String(p.color || "#333333"),
			align: String(p.align || "center") as "left" | "center" | "right",
		}));
	} catch {
		return [...DEFAULT_PLACEHOLDERS];
	}
}

const FIELD_LABELS: Record<string, string> = {
	name: "Participant Name",
	workshop_title: "Workshop Title",
	date: "Date",
};

function PlaceholderEditor({
	fields,
	onChange,
}: {
	fields: PlaceholderField[];
	onChange: (fields: PlaceholderField[]) => void;
}) {
	const updateField = (
		index: number,
		key: keyof PlaceholderField,
		value: string | number,
	) => {
		const updated = [...fields];
		(updated[index] as Record<string, unknown>)[key] = value;
		onChange(updated);
	};

	return (
		<div className="space-y-4">
			{fields.map((field, i) => (
				<div
					key={field.key}
					className="bg-gray-50 rounded-xl p-4 border border-gray-100"
				>
					<div className="flex items-center justify-between mb-3">
						<h4 className="font-semibold text-sm text-gray-800">
							{FIELD_LABELS[field.key] || field.key}
						</h4>
						<span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-500 font-mono">
							{field.key}
						</span>
					</div>

					<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
						<div>
							<label className="block text-[11px] font-medium text-gray-500 mb-1">
								Y Position (px)
							</label>
							<input
								type="number"
								value={field.y}
								onChange={(e) =>
									updateField(i, "y", parseInt(e.target.value) || 0)
								}
								className="input-field text-sm"
								min={0}
								max={2480}
							/>
						</div>
						<div>
							<label className="block text-[11px] font-medium text-gray-500 mb-1">
								Font Size (px)
							</label>
							<input
								type="number"
								value={field.fontSize}
								onChange={(e) =>
									updateField(i, "fontSize", parseInt(e.target.value) || 24)
								}
								className="input-field text-sm"
							/>
						</div>
						<div>
							<label className="block text-[11px] font-medium text-gray-500 mb-1">
								Font
							</label>
							<select
								value={field.fontFamily}
								onChange={(e) => updateField(i, "fontFamily", e.target.value)}
								className="input-field text-sm"
							>
								{FONTS.map((f) => (
									<option key={f} value={f} style={{ fontFamily: f }}>
										{f}
									</option>
								))}
							</select>
						</div>
						<div>
							<label className="block text-[11px] font-medium text-gray-500 mb-1">
								Alignment
							</label>
							<div className="flex rounded-lg overflow-hidden border border-gray-200">
								{(["left", "center", "right"] as const).map((a) => (
									<button
										key={a}
										type="button"
										onClick={() => updateField(i, "align", a)}
										className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
											field.align === a
												? "bg-te-orange text-white"
												: "bg-white text-gray-500 hover:bg-gray-50"
										}`}
									>
										{a === "left" ? "\u2190" : a === "center" ? "\u2194" : "\u2192"}
									</button>
								))}
							</div>
						</div>
					</div>

					<div className="flex items-center gap-3 mt-3">
						<label className="text-[11px] font-medium text-gray-500">
							Color
						</label>
						<input
							type="color"
							value={field.color}
							onChange={(e) => updateField(i, "color", e.target.value)}
							className="w-8 h-8 rounded border border-gray-200 cursor-pointer"
						/>
						<input
							type="text"
							value={field.color}
							onChange={(e) => updateField(i, "color", e.target.value)}
							className="input-field text-xs w-24 font-mono"
						/>
						<div className="flex-1 text-right">
							<span
								style={{
									fontFamily: field.fontFamily,
									fontSize: Math.min(field.fontSize / 3, 24),
									color: field.color,
								}}
							>
								Sample Text
							</span>
						</div>
					</div>
				</div>
			))}
		</div>
	);
}

export function TemplatesClient({
	initialTemplates,
}: {
	initialTemplates: Template[];
}) {
	const router = useRouter();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [showUpload, setShowUpload] = useState(false);
	const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
	const [templateName, setTemplateName] = useState("");
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [fileBase64, setFileBase64] = useState<string | null>(null);
	const [fields, setFields] = useState<PlaceholderField[]>([
		...DEFAULT_PLACEHOLDERS,
	]);
	const [editName, setEditName] = useState("");
	const [editFields, setEditFields] = useState<PlaceholderField[]>([]);
	const [editFileBase64, setEditFileBase64] = useState<string | null>(null);
	const [editSelectedFile, setEditSelectedFile] = useState<File | null>(null);
	const editFileInputRef = useRef<HTMLInputElement>(null);
	const [submitting, setSubmitting] = useState(false);
	const [previewImg, setPreviewImg] = useState<string | null>(null);
	const [previewing, setPreviewing] = useState(false);

	const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0] || null;
		setSelectedFile(file);
		setPreviewImg(null);
		if (file) {
			const buffer = await file.arrayBuffer();
			const base64 = btoa(
				new Uint8Array(buffer).reduce(
					(data, byte) => data + String.fromCharCode(byte),
					"",
				),
			);
			setFileBase64(base64);
		} else {
			setFileBase64(null);
		}
	};

	const handleEditFileChange = async (
		e: React.ChangeEvent<HTMLInputElement>,
	) => {
		const file = e.target.files?.[0] || null;
		setEditSelectedFile(file);
		setPreviewImg(null);
		if (file) {
			const buffer = await file.arrayBuffer();
			const base64 = btoa(
				new Uint8Array(buffer).reduce(
					(data, byte) => data + String.fromCharCode(byte),
					"",
				),
			);
			setEditFileBase64(base64);
		} else {
			setEditFileBase64(null);
		}
	};

	const handleTestPreview = async () => {
		if (!fileBase64) {
			alert("Please select an image first");
			return;
		}
		setPreviewing(true);
		setPreviewImg(null);
		try {
			const ext = selectedFile?.name.substring(
				selectedFile.name.lastIndexOf("."),
			);
			const res = await testPreviewTemplate({
				imageData: fileBase64,
				imageExt: ext || ".png",
				placeholders: fieldsToJson(fields),
				width: 3508,
				height: 2480,
			});
			setPreviewImg(res.base64);
		} catch (err) {
			alert(err instanceof Error ? err.message : "Failed to generate preview");
		} finally {
			setPreviewing(false);
		}
	};

	const handleTestPreviewExisting = async () => {
		if (!editingTemplate) return;
		setPreviewing(true);
		setPreviewImg(null);
		try {
			const ext = editSelectedFile?.name.substring(
				editSelectedFile.name.lastIndexOf("."),
			);
			const res = await testPreviewTemplate({
				templateId: editingTemplate.id,
				imageData: editFileBase64 || undefined,
				imageExt: ext || undefined,
				placeholders: fieldsToJson(editFields),
				width: editingTemplate.width,
				height: editingTemplate.height,
			});
			setPreviewImg(res.base64);
		} catch (err) {
			alert(err instanceof Error ? err.message : "Failed to generate preview");
		} finally {
			setPreviewing(false);
		}
	};

	const handleUpload = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!fileBase64 || !selectedFile) return;
		setSubmitting(true);

		try {
			const ext = selectedFile.name.substring(
				selectedFile.name.lastIndexOf("."),
			);
			await uploadTemplate({
				name: templateName,
				imageData: fileBase64,
				imageExt: ext || ".png",
				placeholders: fieldsToJson(fields),
				width: 3508,
				height: 2480,
			});
			setTemplateName("");
			setSelectedFile(null);
			setFileBase64(null);
			setFields([...DEFAULT_PLACEHOLDERS]);
			setPreviewImg(null);
			if (fileInputRef.current) fileInputRef.current.value = "";
			setShowUpload(false);
			router.refresh();
		} catch (err) {
			alert(err instanceof Error ? err.message : "Failed to upload template");
		} finally {
			setSubmitting(false);
		}
	};

	const openEdit = (t: Template) => {
		setEditingTemplate(t);
		setEditName(t.name);
		setEditFields(jsonToFields(t.placeholders));
		setEditFileBase64(null);
		setEditSelectedFile(null);
		if (editFileInputRef.current) editFileInputRef.current.value = "";
		setPreviewImg(null);
	};

	const handleEdit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!editingTemplate) return;
		setSubmitting(true);
		try {
			const ext = editSelectedFile?.name.substring(
				editSelectedFile.name.lastIndexOf("."),
			);
			await updateTemplate({
				id: editingTemplate.id,
				name: editName,
				placeholders: fieldsToJson(editFields),
				imageData: editFileBase64 || undefined,
				imageExt: ext || undefined,
			});
			setEditingTemplate(null);
			setPreviewImg(null);
			router.refresh();
		} catch (err) {
			alert(err instanceof Error ? err.message : "Failed to update template");
		} finally {
			setSubmitting(false);
		}
	};

	const handleDelete = async (id: string) => {
		if (!confirm("Delete this template?")) return;
		try {
			await deleteTemplate(id);
			router.refresh();
		} catch (err) {
			alert(err instanceof Error ? err.message : "Failed to delete template");
		}
	};

	return (
		<div className="animate-fade-in-up">
			{/* Load Google Fonts for WYSIWYG select */}
			{/* eslint-disable-next-line @next/next/no-page-custom-font */}
			<link rel="stylesheet" href={FONT_LINK} />

			<div className="flex items-center justify-between mb-6">
				<h1 className="text-2xl font-bold text-gray-900">Templates</h1>
				<button
					type="button"
					className="btn-primary text-sm"
					onClick={() => {
						setShowUpload(!showUpload);
						setPreviewImg(null);
					}}
				>
					{showUpload ? "Cancel" : "+ Upload Template"}
				</button>
			</div>

			{/* Upload Form */}
			{showUpload && (
				<form
					onSubmit={handleUpload}
					className="glass-card rounded-2xl p-6 mb-6 animate-scale-in"
				>
					<h3 className="font-semibold text-gray-900 mb-4">
						Upload New Template
					</h3>

					<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
						<div className="space-y-4">
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
									Template Image (A4 Landscape: 3508x2480px)
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

							<div className="pt-2">
								<h4 className="font-semibold text-sm text-gray-900 mb-3">
									Text Placement
								</h4>
								<PlaceholderEditor fields={fields} onChange={setFields} />
							</div>
						</div>

						<div>
							<div className="flex items-center justify-between mb-2">
								<label className="text-sm font-medium text-gray-700">
									Preview
								</label>
								<button
									type="button"
									onClick={handleTestPreview}
									disabled={previewing || !fileBase64}
									className="text-sm font-medium px-4 py-1.5 rounded-lg border border-te-orange text-te-orange hover:bg-orange-50 transition-colors disabled:opacity-40"
								>
									{previewing ? "Generating..." : "\uD83D\uDD04 Test Generate"}
								</button>
							</div>
							<div className="bg-gray-100 rounded-xl border-2 border-dashed border-gray-200 min-h-[300px] flex items-center justify-center overflow-hidden">
								{previewImg ? (
									// eslint-disable-next-line @next/next/no-img-element
									<img
										src={`data:image/png;base64,${previewImg}`}
										alt="Preview"
										className="w-full h-auto rounded-lg"
									/>
								) : (
									<div className="text-center text-gray-400 p-8">
										<div className="text-4xl mb-2">&#x1F441;&#xFE0F;</div>
										<p className="text-sm">
											Upload an image and click <strong>Test Generate</strong>{" "}
											to see a preview with sample data
										</p>
									</div>
								)}
							</div>
						</div>
					</div>

					<div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
						<button
							type="button"
							className="btn-secondary text-sm"
							onClick={() => {
								setShowUpload(false);
								setPreviewImg(null);
							}}
						>
							Cancel
						</button>
						<button
							type="submit"
							className="btn-primary text-sm"
							disabled={submitting || !selectedFile || !templateName}
						>
							{submitting ? "Uploading..." : "Save Template"}
						</button>
					</div>
				</form>
			)}

			{/* Templates List */}
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
				{initialTemplates.length === 0 ? (
					<div className="col-span-full glass-card rounded-2xl p-12 text-center text-gray-400">
						<div className="text-3xl mb-2">&#x1F5BC;&#xFE0F;</div>
						No templates yet. Upload your first one above.
					</div>
				) : (
					initialTemplates.map((t) => (
						<div key={t.id} className="glass-card rounded-xl p-5">
							<div className="flex items-start justify-between mb-3">
								<h3 className="font-semibold text-gray-900 text-sm">
									{t.name}
								</h3>
							</div>
							<div className="text-xs text-gray-500 space-y-1 mb-4">
								<p>
									{t.width}&times;{t.height}px
								</p>
								<p>{JSON.parse(t.placeholders).length} placeholder(s)</p>
								<p>{new Date(t.createdAt).toLocaleDateString()}</p>
							</div>
							<div className="flex items-center gap-3 pt-3 border-t border-gray-100">
								<button
									type="button"
									onClick={() => openEdit(t)}
									className="text-xs font-medium text-blue-500 hover:text-blue-700 transition-colors"
								>
									Edit
								</button>
								<button
									type="button"
									onClick={() => handleDelete(t.id)}
									className="text-xs font-medium text-red-400 hover:text-red-600 transition-colors"
								>
									Delete
								</button>
							</div>
						</div>
					))
				)}
			</div>

			{/* Edit Modal */}
			<Dialog
				open={!!editingTemplate}
				onOpenChange={(open) => {
					if (!open) {
						setEditingTemplate(null);
						setPreviewImg(null);
						setEditFileBase64(null);
						setEditSelectedFile(null);
					}
				}}
			>
				<DialogContent
					className="sm:max-w-5xl flex flex-col max-h-[90vh] p-0 overflow-hidden gap-0"
					showCloseButton={false}
				>
					{editingTemplate && (
						<form
							onSubmit={handleEdit}
							className="flex flex-col h-full overflow-hidden"
						>
							<div className="bg-linear-to-r from-te-orange to-te-red px-6 py-4 shrink-0">
								<DialogTitle className="text-lg font-bold text-white">
									Edit Template
								</DialogTitle>
								<p className="text-white/80 text-xs mt-0.5">
									{editingTemplate.name} — {editingTemplate.width}&times;
									{editingTemplate.height}px
								</p>
							</div>

							<div className="px-6 py-5 overflow-y-auto flex-1">
								<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
									<div className="space-y-4">
										<div>
											<label className="block text-sm font-medium text-gray-700 mb-1">
												Template Name
											</label>
											<input
												type="text"
												value={editName}
												onChange={(e) => setEditName(e.target.value)}
												className="input-field"
												required
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-gray-700 mb-1">
												Update Template Image (Optional)
											</label>
											<input
												ref={editFileInputRef}
												type="file"
												accept="image/*"
												onChange={handleEditFileChange}
												className="input-field"
											/>
										</div>
										<div>
											<h4 className="font-semibold text-sm text-gray-900 mb-3">
												Text Placement
											</h4>
											<PlaceholderEditor
												fields={editFields}
												onChange={setEditFields}
											/>
										</div>
									</div>
									<div>
										<div className="flex items-center justify-between mb-2">
											<label className="text-sm font-medium text-gray-700">
												Preview
											</label>
											<button
												type="button"
												onClick={handleTestPreviewExisting}
												disabled={previewing}
												className="text-sm font-medium px-4 py-1.5 rounded-lg border border-te-orange text-te-orange hover:bg-orange-50 transition-colors disabled:opacity-40"
											>
												{previewing
													? "Generating..."
													: "\uD83D\uDD04 Test Generate"}
											</button>
										</div>
										<div className="bg-gray-100 rounded-xl border-2 border-dashed border-gray-200 min-h-[200px] flex items-center justify-center overflow-hidden">
											{previewImg ? (
												// eslint-disable-next-line @next/next/no-img-element
												<img
													src={`data:image/png;base64,${previewImg}`}
													alt="Preview"
													className="w-full h-auto rounded-lg"
												/>
											) : (
												<div className="text-center text-gray-400 p-6">
													<div className="text-3xl mb-2">
														&#x1F441;&#xFE0F;
													</div>
													<p className="text-xs">
														Click <strong>Test Generate</strong> to preview
													</p>
												</div>
											)}
										</div>
									</div>
								</div>
							</div>

							<div className="px-6 py-4 bg-gray-50 flex gap-3 border-t border-gray-100 shrink-0">
								<button
									type="button"
									className="btn-secondary flex-1"
									onClick={() => {
										setEditingTemplate(null);
										setPreviewImg(null);
									}}
								>
									Cancel
								</button>
								<button
									type="submit"
									className="btn-primary flex-1"
									disabled={submitting}
								>
									{submitting ? "Saving..." : "Save Changes"}
								</button>
							</div>
						</form>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}
