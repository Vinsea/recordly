import { describe, expect, it } from "vitest";
import type { CaptionRegion } from "@/components/video-editor/types";
import { DEFAULT_CAPTION_REGION_STYLE } from "@/components/video-editor/types";
import { buildTimelineItems } from "./timelineModel";

const region: CaptionRegion = {
	id: "cap-1",
	startMs: 0,
	endMs: 2000,
	text: "Hello world",
	style: DEFAULT_CAPTION_REGION_STYLE,
};

describe("buildTimelineItems with captionRegions", () => {
	it("produces a timeline item with rowId row-caption-0", () => {
		const items = buildTimelineItems({
			zoomRegions: [],
			clipRegions: [],
			annotationRegions: [],
			audioRegions: [],
			captionRegions: [region],
		});
		const captionItem = items.find((i) => i.id === "cap-1");
		expect(captionItem).toBeDefined();
		expect(captionItem?.rowId).toBe("row-caption-0");
		expect(captionItem?.variant).toBe("caption");
	});
});
