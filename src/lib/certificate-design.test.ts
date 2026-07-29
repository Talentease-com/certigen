import { describe, expect, it } from "vitest";
import {
	defaultDesign,
	moveElementLayer,
	scaleCertificateDesign,
	type CertificateDesign,
	type CertificateElement,
} from "./certificate-design";

function textElement(
	id: string,
	zIndex = 0,
): Extract<CertificateElement, { type: "text" }> {
	return {
		id,
		type: "text",
		content: id,
		x: 100,
		y: 50,
		width: 400,
		height: 100,
		rotation: 0,
		zIndex,
		opacity: 1,
		fontFamily: "Inter",
		fontSize: 40,
		color: "#000000",
		align: "left",
	};
}

describe("scaleCertificateDesign", () => {
	it("scales text and QR elements down while preserving a square QR", () => {
		const design: CertificateDesign = {
			elements: [
				textElement("text"),
				{
					id: "qr",
					type: "qr",
					x: 800,
					y: 300,
					width: 100,
					height: 120,
					rotation: 0,
					zIndex: 1,
					opacity: 1,
				},
			],
		};

		const scaled = scaleCertificateDesign(
			design,
			{ width: 1000, height: 500 },
			{ width: 500, height: 250 },
		);

		expect(scaled.elements[0]).toMatchObject({
			x: 50,
			y: 25,
			width: 200,
			height: 50,
			fontSize: 20,
		});
		expect(scaled.elements[1]).toMatchObject({
			x: 400,
			y: 150,
			width: 50,
			height: 50,
		});
	});

	it("uses independent box scales but the smaller scale for text and QR", () => {
		const design: CertificateDesign = {
			elements: [
				textElement("text"),
				{
					id: "image",
					type: "image",
					storageKey: "templates/example/assets/logo.png",
					x: 600,
					y: 200,
					width: 200,
					height: 100,
					rotation: 0,
					zIndex: 1,
					opacity: 1,
				},
				{
					id: "qr",
					type: "qr",
					x: 800,
					y: 300,
					width: 100,
					height: 100,
					rotation: 0,
					zIndex: 2,
					opacity: 1,
				},
			],
		};

		const scaled = scaleCertificateDesign(
			design,
			{ width: 1000, height: 500 },
			{ width: 500, height: 500 },
		);

		expect(scaled.elements[0]).toMatchObject({
			x: 50,
			y: 50,
			width: 200,
			height: 100,
			fontSize: 20,
		});
		expect(scaled.elements[1]).toMatchObject({
			x: 300,
			y: 200,
			width: 100,
			height: 100,
		});
		expect(scaled.elements[2]).toMatchObject({
			x: 400,
			y: 300,
			width: 50,
			height: 50,
		});
	});

	it("clamps legacy boxes that already extend beyond the canvas", () => {
		const element = textElement("text");
		element.x = 900;
		element.y = 450;
		element.width = 200;
		element.height = 100;

		const [scaled] = scaleCertificateDesign(
			{ elements: [element] },
			{ width: 1000, height: 500 },
			{ width: 500, height: 250 },
		).elements;

		expect(scaled).toMatchObject({
			x: 400,
			y: 200,
			width: 100,
			height: 50,
		});
	});
});

describe("moveElementLayer", () => {
	const duplicateLayers = () => [
		textElement("a"),
		textElement("b"),
		textElement("c"),
	];

	it("moves forward and assigns unique sequential indices", () => {
		const moved = moveElementLayer(duplicateLayers(), "b", "forward");

		expect(moved.map(({ id }) => id)).toEqual(["a", "c", "b"]);
		expect(moved.map(({ zIndex }) => zIndex)).toEqual([0, 1, 2]);
	});

	it("moves backward and assigns unique sequential indices", () => {
		const moved = moveElementLayer(duplicateLayers(), "b", "backward");

		expect(moved.map(({ id }) => id)).toEqual(["b", "a", "c"]);
		expect(moved.map(({ zIndex }) => zIndex)).toEqual([0, 1, 2]);
	});

	it("normalizes duplicate indices at a movement boundary", () => {
		const moved = moveElementLayer(duplicateLayers(), "a", "backward");

		expect(moved.map(({ id }) => id)).toEqual(["a", "b", "c"]);
		expect(moved.map(({ zIndex }) => zIndex)).toEqual([0, 1, 2]);
	});

	it("gives a new template deterministic layer indices", () => {
		expect(defaultDesign(1200, 800).elements.map(({ zIndex }) => zIndex)).toEqual([
			0, 1, 2, 3,
		]);
	});
});
