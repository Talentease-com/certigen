"use client";

import { FONTS } from "#/lib/fonts";
import { DYNAMIC_FIELD_LABELS, type CertificateElement } from "#/lib/certificate-design";

export function ElementProperties({
	element,
	maxFontSize,
	onChange,
	onDelete,
	onBringForward,
	onSendBackward,
}: {
	element: CertificateElement;
	/** Keeps the font-size input from producing text taller than the canvas. */
	maxFontSize: number;
	onChange: (patch: Partial<CertificateElement>) => void;
	onDelete: () => void;
	onBringForward: () => void;
	onSendBackward: () => void;
}) {
	const title =
		element.type === "text"
			? element.boundTo
				? DYNAMIC_FIELD_LABELS[element.boundTo]
				: "Text"
			: element.type === "image"
				? "Image"
				: "QR Code";

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h3 className="font-semibold text-sm text-gray-800">{title}</h3>
				<div className="flex gap-1">
					<button
						type="button"
						title="Send backward"
						onClick={onSendBackward}
						className="text-xs px-1.5 py-0.5 rounded border border-gray-200 hover:bg-gray-50"
					>
						↓
					</button>
					<button
						type="button"
						title="Bring forward"
						onClick={onBringForward}
						className="text-xs px-1.5 py-0.5 rounded border border-gray-200 hover:bg-gray-50"
					>
						↑
					</button>
				</div>
			</div>

			{element.type === "text" && (
				<>
					{element.boundTo ? (
						<p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
							This field is filled in automatically from each certificate&apos;s
							data.
						</p>
					) : (
						<div>
							<label className="block text-[11px] font-medium text-gray-500 mb-1">
								Text
							</label>
							<input
								type="text"
								value={element.content}
								onChange={(e) => onChange({ content: e.target.value })}
								className="input-field text-sm"
							/>
						</div>
					)}

					<div>
						<label className="block text-[11px] font-medium text-gray-500 mb-1">
							Font
						</label>
						<select
							value={element.fontFamily}
							onChange={(e) => onChange({ fontFamily: e.target.value })}
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
							Font Size (px, max {maxFontSize})
						</label>
						<input
							type="number"
							min={8}
							max={maxFontSize}
							value={element.fontSize}
							onChange={(e) => {
								const parsed = parseInt(e.target.value, 10);
								const clamped = Number.isNaN(parsed)
									? element.fontSize
									: Math.min(Math.max(8, parsed), maxFontSize);
								onChange({ fontSize: clamped });
							}}
							className="input-field text-sm"
						/>
					</div>

					<div className="flex items-center gap-3">
						<label className="text-[11px] font-medium text-gray-500">Color</label>
						<input
							type="color"
							value={element.color}
							onChange={(e) => onChange({ color: e.target.value })}
							className="w-8 h-8 rounded border border-gray-200 cursor-pointer"
						/>
						<input
							type="text"
							value={element.color}
							onChange={(e) => onChange({ color: e.target.value })}
							className="input-field text-xs w-24 font-mono"
						/>
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
									onClick={() => onChange({ align: a })}
									className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
										element.align === a
											? "bg-te-orange text-white"
											: "bg-white text-gray-500 hover:bg-gray-50"
									}`}
								>
									{a === "left" ? "←" : a === "center" ? "↔" : "→"}
								</button>
							))}
						</div>
					</div>
				</>
			)}

			<div>
				<label className="block text-[11px] font-medium text-gray-500 mb-1">
					Opacity ({Math.round(element.opacity * 100)}%)
				</label>
				<input
					type="range"
					min={0}
					max={1}
					step={0.05}
					value={element.opacity}
					onChange={(e) => onChange({ opacity: parseFloat(e.target.value) })}
					className="w-full"
				/>
			</div>

			<button
				type="button"
				onClick={onDelete}
				className="w-full text-xs font-medium text-red-500 hover:text-red-700 border border-red-200 rounded-lg py-2 transition-colors"
			>
				Delete Element
			</button>
		</div>
	);
}
