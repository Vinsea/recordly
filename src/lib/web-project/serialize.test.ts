import { describe, expect, it } from "vitest";
import { parseWebProject, stringifyWebProject } from "./serialize";

describe("web project serialization", () => {
	it("parses remote media projects", () => {
		const project = parseWebProject(
			JSON.stringify({
				version: 1,
				projectId: "project-1",
				title: "Demo",
				mediaItems: [
					{
						id: "main",
						kind: "primary-video",
						source: { type: "remote", url: "https://cdn.example.com/demo.mp4" },
						displayName: "demo.mp4",
					},
				],
				editorState: {},
				viewerState: {},
			}),
		);

		expect(project.mediaItems[0]?.source.type).toBe("remote");
		if (project.mediaItems[0]?.source.type !== "remote") {
			throw new Error("Expected remote source");
		}
		expect(project.mediaItems[0].source.url).toBe("https://cdn.example.com/demo.mp4");
	});

	it("parses desktop .recordly project payloads into viewer model", () => {
		const project = parseWebProject(
			JSON.stringify({
				version: 1,
				projectId: "desktop-project",
				videoPath: "C:/clips/demo.mp4",
				editor: {
					showCursor: true,
					webcam: {
						enabled: true,
						sourcePath: "C:/clips/webcam.mp4",
					},
				},
			}),
		);

		expect(project.title).toBe("desktop-project");
		expect(project.mediaItems).toHaveLength(2);
		expect(project.mediaItems[0]).toMatchObject({
			id: "primary-video",
			kind: "primary-video",
			displayName: "demo.mp4",
			source: {
				type: "local-binding",
				bindingKey: "primary-video",
				originalPathHint: "C:/clips/demo.mp4",
			},
		});
		expect(project.mediaItems[1]).toMatchObject({
			id: "webcam-video",
			kind: "webcam-video",
			displayName: "webcam.mp4",
			source: {
				type: "local-binding",
				bindingKey: "webcam-video",
				originalPathHint: "C:/clips/webcam.mp4",
			},
		});
		expect(project.editorState).toMatchObject({
			showCursor: true,
			webcam: {
				enabled: true,
				sourcePath: "C:/clips/webcam.mp4",
			},
		});
	});

	it("round-trips local binding projects without blob urls", () => {
		const json = stringifyWebProject({
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
					displayName: "demo.mp4",
				},
			],
			editorState: {},
			viewerState: {
				autoplay: true,
				loop: true,
				showControls: true,
				mode: "fit",
				startAtMs: 0,
			},
		});

		expect(json).toContain('"bindingKey":"main"');
		expect(json).not.toContain("blob:");
	});
});
