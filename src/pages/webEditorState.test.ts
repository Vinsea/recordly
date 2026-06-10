import { describe, expect, it } from "vitest";
import {
	attachPrimaryVideoFile,
	attachWebcamVideoFile,
	createEmptyWebProject,
	replaceProjectFromImport,
	updateWebProjectCaptions,
	updateWebProjectScene,
	updateWebProjectZoomMotion,
	updateWebProjectZoomTransitions,
	updateWebProjectTitle,
	updateWebProjectEditorState,
	updateWebProjectWebcam,
} from "./webEditorState";

describe("createEmptyWebProject", () => {
	it("creates a default project for direct editor entry", () => {
		const project = createEmptyWebProject();
		expect(project.title).toBe("Untitled Web Project");
		expect(project.mediaItems).toEqual([]);
		expect(project.viewerState.mode).toBe("fit");
	});
});

describe("replaceProjectFromImport", () => {
	it("replaces current project state with imported project json", () => {
		const current = createEmptyWebProject();
		const next = replaceProjectFromImport(
			current,
			JSON.stringify({
				version: 1,
				projectId: "project-1",
				title: "Imported Project",
				mediaItems: [
					{
						id: "main",
						kind: "primary-video",
						source: { type: "remote", url: "https://cdn.example.com/demo.mp4" },
					},
				],
				editorState: { showCursor: true },
				viewerState: {
					mode: "fit",
					autoplay: true,
					loop: true,
					showControls: true,
					startAtMs: 0,
				},
			}),
		);

		expect(next.title).toBe("Imported Project");
		expect(next.mediaItems).toHaveLength(1);
		expect(next.editorState).toEqual({ showCursor: true });
	});
});

describe("attachPrimaryVideoFile", () => {
	it("stores a local binding media item for the selected file", () => {
		const project = createEmptyWebProject();
		const next = attachPrimaryVideoFile(project, new File(["demo"], "demo.mp4", { type: "video/mp4" }));

		expect(next.project.mediaItems).toHaveLength(1);
		expect(next.project.mediaItems[0]).toMatchObject({
			id: "primary-video",
			kind: "primary-video",
			displayName: "demo.mp4",
			source: {
				type: "local-binding",
				bindingKey: "primary-video",
				originalPathHint: "demo.mp4",
			},
		});
		expect(next.bindings.get("primary-video")?.name).toBe("demo.mp4");
	});
});

describe("attachWebcamVideoFile", () => {
	it("stores a local binding webcam media item for the selected file", () => {
		const project = createEmptyWebProject();
		const next = attachWebcamVideoFile(project, new File(["cam"], "cam.mp4", { type: "video/mp4" }));

		expect(next.project.mediaItems).toHaveLength(1);
		expect(next.project.mediaItems[0]).toMatchObject({
			id: "webcam-video",
			kind: "webcam-video",
			displayName: "cam.mp4",
			source: {
				type: "local-binding",
				bindingKey: "webcam-video",
				originalPathHint: "cam.mp4",
			},
		});
		expect(next.bindings.get("webcam-video")?.name).toBe("cam.mp4");
	});
});

describe("updateWebProjectTitle", () => {
	it("updates the project title", () => {
		const project = createEmptyWebProject();
		const next = updateWebProjectTitle(project, "Demo Project");

		expect(next.title).toBe("Demo Project");
	});
});

describe("updateWebProjectEditorState", () => {
	it("merges editable preview settings into editor state", () => {
		const project = createEmptyWebProject();
		const next = updateWebProjectEditorState(project, {
			showCursor: false,
			backgroundBlur: 4,
			wallpaper: "/wallpapers/tahoe-light.jpg",
			shadowIntensity: 0.5,
			borderRadius: 16,
			padding: {
				top: 24,
				right: 24,
				bottom: 24,
				left: 24,
			},
			cropRegion: {
				x: 0.1,
				y: 0.15,
				width: 0.8,
				height: 0.7,
			},
		});

		expect(next.editorState).toMatchObject({
			showCursor: false,
			backgroundBlur: 4,
			wallpaper: "/wallpapers/tahoe-light.jpg",
			shadowIntensity: 0.5,
			borderRadius: 16,
			padding: {
				top: 24,
				right: 24,
				bottom: 24,
				left: 24,
			},
			cropRegion: {
				x: 0.1,
				y: 0.15,
				width: 0.8,
				height: 0.7,
			},
		});
	});
});

describe("updateWebProjectWebcam", () => {
	it("merges browser-safe webcam settings into editor state", () => {
		const project = createEmptyWebProject();
		const next = updateWebProjectWebcam(project, {
			enabled: true,
			mirror: false,
			corner: "top-left",
			size: 32,
			cornerRadius: 72,
			shadow: 0.4,
			reactToZoom: false,
		});

		expect(next.editorState).toMatchObject({
			webcam: {
				enabled: true,
				mirror: false,
				corner: "top-left",
				size: 32,
				cornerRadius: 72,
				shadow: 0.4,
				reactToZoom: false,
			},
		});
	});
});

describe("updateWebProjectCaptions", () => {
	it("merges browser-safe auto caption settings and sample cues", () => {
		const project = createEmptyWebProject();
		const next = updateWebProjectCaptions(project, {
			autoCaptionSettings: {
				enabled: true,
				fontSize: 36,
				animationStyle: "pop",
				textColor: "#FFAA00",
				inactiveTextColor: "#334455",
				boxRadius: 22,
			},
			autoCaptions: [
				{
					id: "caption-1",
					startMs: 0,
					endMs: 4000,
					text: "Hello from web captions",
				},
			],
		});

		expect(next.editorState).toMatchObject({
			autoCaptionSettings: {
				enabled: true,
				fontSize: 36,
				animationStyle: "pop",
				textColor: "#FFAA00",
				inactiveTextColor: "#334455",
				boxRadius: 22,
			},
			autoCaptions: [
				{
					id: "caption-1",
					text: "Hello from web captions",
				},
			],
		});
	});
});

describe("updateWebProjectScene", () => {
	it("merges browser-safe aspect ratio and frame settings", () => {
		const project = createEmptyWebProject();
		const next = updateWebProjectScene(project, {
			aspectRatio: "9:16",
			frame: "recordly.frames/browser-dark",
		});

		expect(next.editorState).toMatchObject({
			aspectRatio: "9:16",
			frame: "recordly.frames/browser-dark",
		});
	});
});

describe("updateWebProjectZoomMotion", () => {
	it("merges browser-safe zoom motion settings", () => {
		const project = createEmptyWebProject();
		const next = updateWebProjectZoomMotion(project, {
			connectZooms: false,
			zoomInDurationMs: 900,
			zoomOutDurationMs: 700,
		});

		expect(next.editorState).toMatchObject({
			connectZooms: false,
			zoomInDurationMs: 900,
			zoomOutDurationMs: 700,
		});
	});
});

describe("updateWebProjectZoomTransitions", () => {
	it("merges browser-safe zoom transition settings", () => {
		const project = createEmptyWebProject();
		const next = updateWebProjectZoomTransitions(project, {
			zoomInOverlapMs: 320,
			connectedZoomGapMs: 1400,
			connectedZoomDurationMs: 850,
			zoomInEasing: "smooth",
			zoomOutEasing: "snappy",
			connectedZoomEasing: "glide",
		});

		expect(next.editorState).toMatchObject({
			zoomInOverlapMs: 320,
			connectedZoomGapMs: 1400,
			connectedZoomDurationMs: 850,
			zoomInEasing: "smooth",
			zoomOutEasing: "snappy",
			connectedZoomEasing: "glide",
		});
	});
});
