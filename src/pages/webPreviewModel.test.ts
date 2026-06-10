import { describe, expect, it } from "vitest";
import { createWebPreviewModel } from "./webPreviewModel";

describe("createWebPreviewModel", () => {
	it("normalizes editor state from web project data", () => {
		const model = createWebPreviewModel(
			{
				version: 1,
				projectId: "project-1",
				title: "Demo",
				mediaItems: [
					{
						id: "main",
						kind: "primary-video",
						source: { type: "remote", url: "https://cdn.example.com/demo.mp4" },
					},
				],
				editorState: {
					showCursor: true,
					wallpaper: "/wallpapers/tahoe-light.jpg",
					zoomRegions: [
						{ id: "zoom-1", startMs: 0, endMs: 1000, depth: 2, focus: { cx: 0.5, cy: 0.4 } },
					],
				},
				viewerState: {
					mode: "fit",
					autoplay: true,
					loop: true,
					showControls: true,
					startAtMs: 0,
				},
			},
			"https://cdn.example.com/demo.mp4",
		);

		expect(model.videoPath).toBe("https://cdn.example.com/demo.mp4");
		expect(model.editor.showCursor).toBe(true);
		expect(model.editor.zoomRegions).toHaveLength(1);
	});

	it("reports missing local binding when no resolved video is available", () => {
		const model = createWebPreviewModel(
			{
				version: 1,
				projectId: "project-2",
				title: "Local",
				mediaItems: [
					{
						id: "main",
						kind: "primary-video",
						source: {
							type: "local-binding",
							bindingKey: "main",
							originalPathHint: "C:/clips/demo.mp4",
						},
					},
				],
				editorState: {},
				viewerState: {
					mode: "fit",
					autoplay: true,
					loop: true,
					showControls: true,
					startAtMs: 0,
				},
			},
			null,
			null,
		);

		expect(model.videoPath).toBeNull();
		expect(model.showMissingBindings).toEqual(["main"]);
	});

	it("uses resolved webcam video and reports missing webcam binding", () => {
		const model = createWebPreviewModel(
			{
				version: 1,
				projectId: "project-3",
				title: "Webcam",
				mediaItems: [
					{
						id: "cam",
						kind: "webcam-video",
						source: {
							type: "local-binding",
							bindingKey: "webcam-video",
							originalPathHint: "C:/clips/cam.mp4",
						},
					},
				],
				editorState: {
					webcam: {
						enabled: true,
						sourcePath: "stale-path.mp4",
					},
				},
				viewerState: {
					mode: "fit",
					autoplay: true,
					loop: true,
					showControls: true,
					startAtMs: 0,
				},
			},
			null,
			"blob:webcam-url",
		);

		expect(model.editor.webcam.sourcePath).toBe("blob:webcam-url");
		expect(model.showMissingBindings).toEqual([]);
	});
});
