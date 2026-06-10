import { describe, expect, it } from "vitest";
import { parseWebAppRoute, parseViewerBootstrapState } from "./routeState";

describe("parseWebAppRoute", () => {
	it("returns viewer for viewer route", () => {
		expect(parseWebAppRoute("?route=viewer")).toBe("viewer");
	});

	it("returns editor for editor route", () => {
		expect(parseWebAppRoute("?route=editor")).toBe("editor");
	});

	it("returns null for unknown route", () => {
		expect(parseWebAppRoute("?route=desktop")).toBeNull();
	});
});

describe("parseViewerBootstrapState", () => {
	it("collects unresolved local bindings", () => {
		const state = parseViewerBootstrapState({
			version: 1,
			projectId: "project-1",
			title: "Demo",
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
		});

		expect(state.missingBindings).toEqual(["main"]);
		expect(state.primaryVideoUrl).toBeNull();
	});
});
