import { createDefaultWebViewerState } from "@/lib/web-project/defaults";
import { parseWebProject } from "@/lib/web-project/serialize";
import type { WebProjectData, WebProjectMediaItem } from "@/lib/web-project/types";
import type { ProjectFileBindings } from "@/lib/web-media/types";

function createProjectId() {
	return `web-project-${Date.now()}`;
}

function attachMediaFile(
	project: WebProjectData,
	file: File,
	kind: WebProjectMediaItem["kind"],
	id: string,
	bindings: ProjectFileBindings = new Map(),
): {
	project: WebProjectData;
	bindings: ProjectFileBindings;
} {
	const mediaItem: WebProjectMediaItem = {
		id,
		kind,
		displayName: file.name,
		originalLocalPath: file.name,
		source: {
			type: "local-binding",
			bindingKey: id,
			originalPathHint: file.name,
		},
	};

	return {
		project: {
			...project,
			mediaItems: [mediaItem, ...project.mediaItems.filter((item) => item.kind !== kind)],
		},
		bindings: new Map(bindings).set(id, file),
	};
}

export function createEmptyWebProject(): WebProjectData {
	return {
		version: 1,
		projectId: createProjectId(),
		title: "Untitled Web Project",
		mediaItems: [],
		editorState: {},
		viewerState: createDefaultWebViewerState(),
	};
}

export function replaceProjectFromImport(
	_currentProject: WebProjectData,
	projectText: string,
): WebProjectData {
	return parseWebProject(projectText);
}

export function updateWebProjectTitle(project: WebProjectData, title: string): WebProjectData {
	return {
		...project,
		title,
	};
}

export function updateWebProjectEditorState(
	project: WebProjectData,
	editorState: Record<string, unknown>,
): WebProjectData {
	return {
		...project,
		editorState: {
			...project.editorState,
			...editorState,
		},
	};
}

export function updateWebProjectWebcam(
	project: WebProjectData,
	webcam: Record<string, unknown>,
): WebProjectData {
	const currentWebcam =
		typeof project.editorState.webcam === "object" && project.editorState.webcam !== null
			? (project.editorState.webcam as Record<string, unknown>)
			: {};

	return updateWebProjectEditorState(project, {
		webcam: {
			enabled: false,
			sourcePath: null,
			timeOffsetMs: 0,
			mirror: true,
			cropRegion: { x: 0, y: 0, width: 1, height: 1 },
			corner: "bottom-right",
			positionPreset: "bottom-right",
			positionX: 1,
			positionY: 1,
			size: 40,
			reactToZoom: true,
			cornerRadius: 90,
			shadow: 0.67,
			margin: 24,
			...currentWebcam,
			...webcam,
		},
	});
}

export function updateWebProjectCaptions(
	project: WebProjectData,
	captions: {
		autoCaptionSettings?: Record<string, unknown>;
		autoCaptions?: Array<Record<string, unknown>>;
	},
): WebProjectData {
	const currentAutoCaptionSettings =
		typeof project.editorState.autoCaptionSettings === "object" &&
		project.editorState.autoCaptionSettings !== null
			? (project.editorState.autoCaptionSettings as Record<string, unknown>)
			: {};

	return updateWebProjectEditorState(project, {
		autoCaptionSettings: {
			enabled: false,
			language: "auto",
			fontFamily: "Arial",
			fontSize: 30,
			bottomOffset: 3,
			maxWidth: 62,
			maxRows: 1,
			animationStyle: "fade",
			boxRadius: 17.5,
			textColor: "#FFFFFF",
			inactiveTextColor: "#A3A3A3",
			backgroundOpacity: 0.9,
			...currentAutoCaptionSettings,
			...(captions.autoCaptionSettings ?? {}),
		},
		autoCaptions: captions.autoCaptions ?? [],
	});
}

export function updateWebProjectScene(
	project: WebProjectData,
	scene: {
		aspectRatio?: string;
		frame?: string | null;
	},
): WebProjectData {
	return updateWebProjectEditorState(project, {
		...(typeof scene.aspectRatio === "string" ? { aspectRatio: scene.aspectRatio } : {}),
		...(scene.frame === null || typeof scene.frame === "string" ? { frame: scene.frame } : {}),
	});
}

export function updateWebProjectZoomMotion(
	project: WebProjectData,
	motion: {
		connectZooms?: boolean;
		zoomInDurationMs?: number;
		zoomOutDurationMs?: number;
	},
): WebProjectData {
	return updateWebProjectEditorState(project, {
		...(typeof motion.connectZooms === "boolean" ? { connectZooms: motion.connectZooms } : {}),
		...(typeof motion.zoomInDurationMs === "number"
			? { zoomInDurationMs: motion.zoomInDurationMs }
			: {}),
		...(typeof motion.zoomOutDurationMs === "number"
			? { zoomOutDurationMs: motion.zoomOutDurationMs }
			: {}),
	});
}

export function updateWebProjectZoomTransitions(
	project: WebProjectData,
	transitions: {
		zoomInOverlapMs?: number;
		connectedZoomGapMs?: number;
		connectedZoomDurationMs?: number;
		zoomInEasing?: string;
		zoomOutEasing?: string;
		connectedZoomEasing?: string;
	},
): WebProjectData {
	return updateWebProjectEditorState(project, {
		...(typeof transitions.zoomInOverlapMs === "number"
			? { zoomInOverlapMs: transitions.zoomInOverlapMs }
			: {}),
		...(typeof transitions.connectedZoomGapMs === "number"
			? { connectedZoomGapMs: transitions.connectedZoomGapMs }
			: {}),
		...(typeof transitions.connectedZoomDurationMs === "number"
			? { connectedZoomDurationMs: transitions.connectedZoomDurationMs }
			: {}),
		...(typeof transitions.zoomInEasing === "string"
			? { zoomInEasing: transitions.zoomInEasing }
			: {}),
		...(typeof transitions.zoomOutEasing === "string"
			? { zoomOutEasing: transitions.zoomOutEasing }
			: {}),
		...(typeof transitions.connectedZoomEasing === "string"
			? { connectedZoomEasing: transitions.connectedZoomEasing }
			: {}),
	});
}

export function attachPrimaryVideoFile(
	project: WebProjectData,
	file: File,
	bindings: ProjectFileBindings = new Map(),
) {
	return attachMediaFile(project, file, "primary-video", "primary-video", bindings);
}

export function attachWebcamVideoFile(
	project: WebProjectData,
	file: File,
	bindings: ProjectFileBindings = new Map(),
) {
	return attachMediaFile(project, file, "webcam-video", "webcam-video", bindings);
}
