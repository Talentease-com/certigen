"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useShooAuth } from "@shoojs/react";
import { Stage, Layer, Image as KonvaImage, Transformer } from "react-konva";
import useImage from "use-image";
import type Konva from "konva";
import { useTemplateEditorStore } from "#/store/template-editor-store";
import { FONT_LINK } from "#/lib/fonts";
import {
	DYNAMIC_FIELDS,
	DYNAMIC_FIELD_LABELS,
	type DynamicField,
} from "#/lib/certificate-design";
import { ElementNode } from "./element-nodes";
import { ElementProperties } from "./element-properties";
import { EditorGuide } from "./editor-guide";
import { TemplateMetaPanel } from "./template-meta-panel";

const MAX_DISPLAY_WIDTH = 860;

// Konva touches `document`/canvas at render time, so the Stage must not
// render during SSR. useSyncExternalStore gives a stable false on the
// server and true on the client without the hydration-mismatch/setState-
// in-effect issues a plain `mounted` state flip would have.
function useIsClient() {
	return useSyncExternalStore(
		() => () => {},
		() => true,
		() => false,
	);
}

/** Tracks the canvas wrapper's actual available width so the Stage scales
 * down on narrower viewports/sidebars instead of overflowing at a fixed
 * 860px. */
function useContainerWidth() {
	const ref = useRef<HTMLDivElement>(null);
	const [width, setWidth] = useState(MAX_DISPLAY_WIDTH);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const observer = new ResizeObserver((entries) => {
			const measured = entries[0]?.contentRect.width;
			if (measured) setWidth(measured);
		});
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	return [ref, width] as const;
}

export function TemplateEditorClient({ templateId }: { templateId: string }) {
	const { identity } = useShooAuth();
	const {
		template,
		backgroundUrl,
		elements,
		selectedId,
		assetUrls,
		loading,
		saving,
		metadataSaving,
		dirty,
		error,
		previewUrl,
		previewing,
		load,
		selectElement,
		addText,
		addDynamicField,
		addImageElement,
		updateElement,
		removeElement,
		bringForward,
		sendBackward,
		save,
		saveMetadata,
		testGenerate,
		reset,
	} = useTemplateEditorStore();

	const mounted = useIsClient();
	const imageInputRef = useRef<HTMLInputElement>(null);
	const transformerRef = useRef<Konva.Transformer>(null);
	const nodeRefs = useRef<Map<string, Konva.Node>>(new Map());
	const [containerRef, containerWidth] = useContainerWidth();

	const [bgImage] = useImage(backgroundUrl ?? "");

	const loadTemplate = () => {
		if (identity?.token) load(templateId, identity.token);
	};

	useEffect(() => {
		loadTemplate();
		return () => reset();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [templateId, identity?.token]);

	useEffect(() => {
		const tr = transformerRef.current;
		if (!tr) return;
		const node = selectedId ? nodeRefs.current.get(selectedId) : undefined;
		tr.nodes(node ? [node] : []);
		tr.getLayer()?.batchDraw();
	}, [selectedId, elements]);

	const handleAddImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) await addImageElement(file, identity?.token);
		if (imageInputRef.current) imageInputRef.current.value = "";
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center py-20">
				<div className="w-6 h-6 border-2 border-te-orange/30 border-t-te-orange rounded-full animate-spin" />
			</div>
		);
	}

	if (!template) {
		return (
			<div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
				<div className="text-3xl">⚠️</div>
				<p className="text-sm text-red-600 max-w-sm">
					{error ?? "Couldn't load this template."}
				</p>
				<div className="flex gap-3">
					<button type="button" className="btn-secondary text-sm" onClick={loadTemplate}>
						Retry
					</button>
					<Link href="/admin/templates" className="btn-primary text-sm">
						← Back to Templates
					</Link>
				</div>
			</div>
		);
	}

	const displayWidth = Math.min(containerWidth || MAX_DISPLAY_WIDTH, MAX_DISPLAY_WIDTH);
	const scale = displayWidth / template.width;
	const displayHeight = Math.round(template.height * scale);
	const selected = elements.find((el) => el.id === selectedId) ?? null;
	const sortedElements = [...elements].sort((a, b) => a.zIndex - b.zIndex);

	return (
		<div className="animate-fade-in-up">
			<link rel="stylesheet" href={FONT_LINK} />

			<div className="flex items-center justify-between mb-6">
				<div>
					<Link href="/admin/templates" className="text-xs text-gray-400 hover:underline">
						← Back to Templates
					</Link>
					<h1 className="text-2xl font-bold text-gray-900 mt-1">{template.name}</h1>
				</div>
				<div className="flex items-center gap-3">
					{dirty && <span className="text-xs text-amber-600">Unsaved changes</span>}
					<button
						type="button"
						className="btn-secondary text-sm"
						onClick={() => testGenerate(identity?.token)}
						disabled={previewing || saving || metadataSaving}
					>
						{previewing ? "Generating..." : "🔄 Test Generate"}
					</button>
					<button
						type="button"
						className="btn-primary text-sm"
						onClick={() => save(identity?.token)}
						disabled={saving || metadataSaving || !dirty}
					>
						{saving ? "Saving..." : "Save"}
					</button>
				</div>
			</div>

			{error && (
				<div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
					{error}
				</div>
			)}

			<TemplateMetaPanel
				template={template}
				saving={metadataSaving}
				onSave={(data) => saveMetadata(data, identity?.token)}
			/>

			<EditorGuide />

			<div
				className={`grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start transition-opacity ${
					metadataSaving ? "pointer-events-none opacity-60" : ""
				}`}
				aria-busy={metadataSaving}
			>
				<div>
					<div className="flex items-center gap-2 mb-3">
						<button
							type="button"
							className="btn-secondary text-xs"
							onClick={addText}
							disabled={metadataSaving}
						>
							+ Text
						</button>
						<select
							className="input-field text-xs py-1.5 w-auto"
							value=""
							disabled={metadataSaving}
							onChange={(e) => {
								if (e.target.value) addDynamicField(e.target.value as DynamicField);
							}}
						>
							<option value="">+ Dynamic Field...</option>
							{DYNAMIC_FIELDS.map((f) => (
								<option key={f} value={f}>
									{DYNAMIC_FIELD_LABELS[f]}
								</option>
							))}
						</select>
						<label
							className={`btn-secondary text-xs ${
								metadataSaving ? "cursor-not-allowed" : "cursor-pointer"
							}`}
						>
							+ Image
							<input
								ref={imageInputRef}
								type="file"
								accept="image/*"
								className="hidden"
								disabled={metadataSaving}
								onChange={handleAddImageFile}
							/>
						</label>
					</div>

					<div
						ref={containerRef}
						className="w-full bg-gray-100 rounded-xl border border-gray-200 overflow-hidden flex justify-center"
					>
						{mounted && (
							<Stage
								width={displayWidth}
								height={displayHeight}
								scaleX={scale}
								scaleY={scale}
								onMouseDown={(e) => {
									if (e.target === e.target.getStage()) selectElement(null);
								}}
							>
								<Layer>
									{bgImage && (
										<KonvaImage
											image={bgImage}
											width={template.width}
											height={template.height}
											listening={false}
										/>
									)}
									{sortedElements.map((el) => (
										<ElementNode
											key={el.id}
											element={el}
											canvasWidth={template.width}
											canvasHeight={template.height}
											assetUrl={el.type === "image" ? assetUrls[el.storageKey] : undefined}
											registerRef={(node) => {
												if (node) nodeRefs.current.set(el.id, node);
												else nodeRefs.current.delete(el.id);
											}}
											onSelect={() => selectElement(el.id)}
											onChange={(patch) => updateElement(el.id, patch)}
										/>
									))}
									<Transformer
										ref={transformerRef}
										rotateEnabled={false}
										flipEnabled={false}
										keepRatio={selected?.type === "qr"}
										enabledAnchors={
											selected?.type === "qr"
												? ["top-left", "top-right", "bottom-left", "bottom-right"]
												: undefined
										}
										boundBoxFunc={(oldBox, newBox) =>
											newBox.width < 20 || newBox.height < 20 ? oldBox : newBox
										}
									/>
								</Layer>
							</Stage>
						)}
					</div>
				</div>

				<div className="glass-card rounded-xl p-4">
					{!selected ? (
						<div className="text-center py-6">
							<div className="text-3xl mb-2">👆</div>
							<p className="text-sm font-medium text-gray-700 mb-1">
								Nothing selected
							</p>
							<p className="text-xs text-gray-400">
								Click any element on the canvas to edit its font, size, color,
								and layering — or add a new one using the toolbar above.
							</p>
						</div>
					) : (
						<ElementProperties
							element={selected}
							maxFontSize={Math.max(24, Math.floor(template.height / 2))}
							onChange={(patch) => updateElement(selected.id, patch)}
							onDelete={() => removeElement(selected.id)}
							onBringForward={() => bringForward(selected.id)}
							onSendBackward={() => sendBackward(selected.id)}
						/>
					)}
				</div>
			</div>

			{previewUrl && (
				<div className="mt-6 glass-card rounded-xl p-4">
					<h3 className="text-sm font-semibold text-gray-900 mb-3">
						Preview (sample data)
					</h3>
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img
						src={previewUrl}
						alt="Certificate preview"
						className="max-w-full rounded-lg border border-gray-100"
					/>
				</div>
			)}
		</div>
	);
}
