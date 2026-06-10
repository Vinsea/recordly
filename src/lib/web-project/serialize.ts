import { createDefaultWebViewerState } from "./defaults";
import type { WebProjectData, WebProjectMediaItem, WebProjectMediaSource } from "./types";

function getDisplayNameFromPath(path: string): string {
	const segments = path.split(/[\\/]/).filter(Boolean);
	return segments[segments.length - 1] ?? path;
}

function isRemoteMediaPath(path: string): boolean {
	return /^https?:\/\//i.test(path);
}

function createMediaSource(path: string, bindingKey: string): WebProjectMediaSource {
	if (isRemoteMediaPath(path)) {
		return { type: "remote", url: path };
	}

	return {
		type: "local-binding",
		bindingKey,
		originalPathHint: path,
	};
}

function createMediaItem(
	id: string,
	kind: WebProjectMediaItem["kind"],
	path: string,
): WebProjectMediaItem {
	return {
		id,
		kind,
		source: createMediaSource(path, id),
		displayName: getDisplayNameFromPath(path),
		originalLocalPath: isRemoteMediaPath(path) ? undefined : path,
	};
}

function parseDesktopProject(input: Record<string, unknown>): WebProjectData {
	const videoPath = typeof input.videoPath === "string" ? input.videoPath : "";
	const editor =
		typeof input.editor === "object" && input.editor !== null
			? (input.editor as Record<string, unknown>)
			: {};
	const rawWebcam =
		typeof editor.webcam === "object" && editor.webcam !== null
			? (editor.webcam as Record<string, unknown>)
			: null;
	const webcamPath = typeof rawWebcam?.sourcePath === "string" ? rawWebcam.sourcePath : null;
	const mediaItems: WebProjectMediaItem[] = [];

	if (videoPath) {
		mediaItems.push(createMediaItem("primary-video", "primary-video", videoPath));
	}
	if (webcamPath) {
		mediaItems.push(createMediaItem("webcam-video", "webcam-video", webcamPath));
	}

	return {
		version: 1,
		projectId: typeof input.projectId === "string" ? input.projectId : "",
		title:
			typeof input.projectId === "string" && input.projectId.trim().length > 0
				? input.projectId
				: "Untitled Recordly Project",
		mediaItems,
		editorState: editor,
		viewerState: createDefaultWebViewerState(),
	};
}

export function parseWebProject(input: string): WebProjectData {
	const parsed = JSON.parse(input) as Partial<WebProjectData> & Record<string, unknown>;

	if (Array.isArray(parsed.mediaItems)) {
		return {
			version: 1,
			projectId: typeof parsed.projectId === "string" ? parsed.projectId : "",
			title: typeof parsed.title === "string" ? parsed.title : "Untitled",
			mediaItems: parsed.mediaItems,
			editorState:
				typeof parsed.editorState === "object" && parsed.editorState !== null
					? parsed.editorState
					: {},
			viewerState: {
				...createDefaultWebViewerState(),
				...(parsed.viewerState ?? {}),
			},
		};
	}

	return parseDesktopProject(parsed);
}

export function stringifyWebProject(project: WebProjectData): string {
	return JSON.stringify(project);
}
