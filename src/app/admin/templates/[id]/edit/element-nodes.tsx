"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import useImage from "use-image";
import type Konva from "konva";
import { Image as KonvaImage, Text as KonvaText } from "react-konva";
import type { CertificateElement } from "#/lib/certificate-design";

interface NodeProps<T extends CertificateElement> {
	element: T;
	registerRef: (node: Konva.Node | null) => void;
	onSelect: () => void;
	onChange: (patch: Partial<CertificateElement>) => void;
}

function useCommonHandlers<T extends CertificateElement>({
	onSelect,
	onChange,
}: Pick<NodeProps<T>, "onSelect" | "onChange">) {
	return {
		draggable: true,
		onClick: onSelect,
		onTap: onSelect,
		onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
			onChange({ x: e.target.x(), y: e.target.y() });
		},
		onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
			const node = e.target;
			const scaleX = node.scaleX();
			const scaleY = node.scaleY();
			node.scaleX(1);
			node.scaleY(1);
			onChange({
				x: node.x(),
				y: node.y(),
				width: Math.max(20, node.width() * scaleX),
				height: Math.max(20, node.height() * scaleY),
			});
		},
	};
}

export function TextNode({
	element,
	registerRef,
	onSelect,
	onChange,
}: NodeProps<Extract<CertificateElement, { type: "text" }>>) {
	const handlers = useCommonHandlers({ onSelect, onChange });

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
	registerRef,
	onSelect,
	onChange,
}: NodeProps<Extract<CertificateElement, { type: "image" }>> & { assetUrl?: string }) {
	const [img] = useImage(assetUrl ?? "");
	const handlers = useCommonHandlers({ onSelect, onChange });

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
	registerRef,
	onSelect,
	onChange,
}: NodeProps<Extract<CertificateElement, { type: "qr" }>>) {
	const [dataUrl, setDataUrl] = useState<string | null>(null);
	useEffect(() => {
		getSampleQrDataUrl().then(setDataUrl);
	}, []);
	const [img] = useImage(dataUrl ?? "");
	const handlers = useCommonHandlers({ onSelect, onChange });

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
