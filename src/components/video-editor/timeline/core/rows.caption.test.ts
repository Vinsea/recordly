import { describe, expect, it } from "vitest";
import { getCaptionTrackIndex, getCaptionTrackRowId, isCaptionTrackRowId } from "./rows";

describe("caption row helpers", () => {
	it("getCaptionTrackRowId returns row-caption-0 for index 0", () => {
		expect(getCaptionTrackRowId(0)).toBe("row-caption-0");
	});

	it("isCaptionTrackRowId returns true for row-caption-0", () => {
		expect(isCaptionTrackRowId("row-caption-0")).toBe(true);
	});

	it("isCaptionTrackRowId returns false for row-annotation-0", () => {
		expect(isCaptionTrackRowId("row-annotation-0")).toBe(false);
	});

	it("getCaptionTrackIndex returns 0 for row-caption-0", () => {
		expect(getCaptionTrackIndex("row-caption-0")).toBe(0);
	});
});
