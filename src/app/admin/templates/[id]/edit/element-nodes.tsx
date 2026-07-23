"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import useImage from "use-image";
import type Konva from "konva";
import { Image as KonvaImage, Text as KonvaText } from "react-konva";
import type { CertificateElement } from "#/lib/certificate-design";

interface NodeProps<T extends CertificateElement> {
	element: T;
	canvasWidth: number;
	canvasHeight: number;
	registerRef: (node: Konva.Node | null) => void;
	onSelect: () => void;
	onChange: (patch: Partial<CertificateElement>) => void;
}

const MIN_SIZE = 20;

/**
 * Keeps an element fully on the canvas — dragging or resizing past an edge
 * clamps back to the boundary instead of letting the box hang off it. This
 * isn't just tidiness: an element positioned or sized outside the template
 * bounds renders as an overlay larger than the base image, which the server
 * (sharp) refuses to composite at all. Clamping here means that error can
 * never happen from normal editor use.
 */
function useCommonHandlers<T extends CertificateElement>({
	onSelect,
	onChange,
	canvasWidth,
	canvasHeight,
	lockSquare = false,
}: Pick<NodeProps<T>, "onSelect" | "onChange" | "canvasWidth" | "canvasHeight"> & {
	/** QR elements always render as a square (min side, top-left anchored) — see
	 * generateCertificateImage. Locking it here keeps the editor honest about
	 * what a non-square drag would actually produce. */
	lockSquare?: boolean;
}) {
	return {
		draggable: true,
		onClick: onSelect,
		onTap: onSelect,
		onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
			const node = e.target;
			const width = node.width();
			const height = node.height();
			const x = Math.min(Math.max(0, node.x()), Math.max(0, canvasWidth - width));
			const y = Math.min(Math.max(0, node.y()), Math.max(0, canvasHeight - height));
			node.x(x);
			node.y(y);
			onChange({ x, y });
		},
		onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
			const node = e.target;
			const scaleX = node.scaleX();
			const scaleY = node.scaleY();
			node.scaleX(1);
			node.scaleY(1);

			const x = Math.min(Math.max(0, node.x()), Math.max(0, canvasWidth - MIN_SIZE));
			const y = Math.min(Math.max(0, node.y()), Math.max(0, canvasHeight - MIN_SIZE));
			let width = Math.min(
				Math.max(MIN_SIZE, node.width() * scaleX),
				Math.max(MIN_SIZE, canvasWidth - x),
			);
			let height = Math.min(
				Math.max(MIN_SIZE, node.height() * scaleY),
				Math.max(MIN_SIZE, canvasHeight - y),
			);

			if (lockSquare) {
				const side = Math.min(width, height);
				width = side;
				height = side;
			}

			node.x(x);
			node.y(y);
			node.width(width);
			node.height(height);
			onChange({ x, y, width, height });
		},
	};
}

export function TextNode({
	element,
	canvasWidth,
	canvasHeight,
	registerRef,
	onSelect,
	onChange,
}: NodeProps<Extract<CertificateElement, { type: "text" }>>) {
	const handlers = useCommonHandlers({ onSelect, onChange, canvasWidth, canvasHeight });

	return (
		<KonvaText
			ref={registerRef}
			x={element.x}
			y={element.y}
			width={element.width}
			height={element.height}
			opacity={element.opacity}
			text={element.boundTo ? `{{${element.boundTo}}}` : element.content || "Text"}
			fontSize={element.fontSize}
			fontFamily={element.fontFamily}
			fill={element.color}
			align={element.align}
			fontStyle={element.boundTo ? "italic" : "normal"}
			{...handlers}
		/>
	);
}

export function ImageNode({
	element,
	assetUrl,
	canvasWidth,
	canvasHeight,
	registerRef,
	onSelect,
	onChange,
}: NodeProps<Extract<CertificateElement, { type: "image" }>> & { assetUrl?: string }) {
	const [img] = useImage(assetUrl ?? "");
	const handlers = useCommonHandlers({ onSelect, onChange, canvasWidth, canvasHeight });

	if (!img) return null;

	return (
		<KonvaImage
			ref={registerRef}
			image={img}
			x={element.x}
			y={element.y}
			width={element.width}
			height={element.height}
			opacity={element.opacity}
			{...handlers}
		/>
	);
}

let sampleQrPromise: Promise<string> | null = null;
function getSampleQrDataUrl(): Promise<string> {
	if (!sampleQrPromise) {
		sampleQrPromise = QRCode.toDataURL("https://certigen.example/verify/sample", {
			margin: 1,
			width: 280,
		});
	}
	return sampleQrPromise;
}

export function QrNode({
	element,
	canvasWidth,
	canvasHeight,
	registerRef,
	onSelect,
	onChange,
}: NodeProps<Extract<CertificateElement, { type: "qr" }>>) {
	const [dataUrl, setDataUrl] = useState<string | null>(null);
	useEffect(() => {
		getSampleQrDataUrl().then(setDataUrl);
	}, []);
	const [img] = useImage(dataUrl ?? "");
	const handlers = useCommonHandlers({
		onSelect,
		onChange,
		canvasWidth,
		canvasHeight,
		lockSquare: true,
	});

	if (!img) return null;

	return (
		<KonvaImage
			ref={registerRef}
			image={img}
			x={element.x}
			y={element.y}
			width={element.width}
			height={element.height}
			opacity={element.opacity}
			{...handlers}
		/>
	);
}

export function ElementNode(
	props: NodeProps<CertificateElement> & { assetUrl?: string },
) {
	if (props.element.type === "text") {
		return <TextNode {...props} element={props.element} />;
	}
	if (props.element.type === "image") {
		return <ImageNode {...props} element={props.element} />;
	}
	return <QrNode {...props} element={props.element} />;
}
