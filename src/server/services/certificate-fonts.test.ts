import { readFileSync } from "node:fs";
import path from "node:path";
import * as fontkit from "fontkit";
import { describe, expect, it } from "vitest";
import { FONT_FILES } from "./certificate-gen";

const fontsDir = path.join(process.cwd(), "public", "fonts");

describe("certificate fonts", () => {
	it.each(Object.entries(FONT_FILES))(
		"bundles a parseable font file for %s",
		(family, fileName) => {
			// A web page saved under a .ttf name fails here with "Unknown font format", and the
			// renderer would silently fall back to a different font.
			const font = fontkit.create(readFileSync(path.join(fontsDir, fileName)));
			expect(font.familyName).toBe(family);
			expect(font.layout("Recipient Name").glyphs.length).toBeGreaterThan(0);
		},
	);
});
