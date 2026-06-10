import { normalizeProjectEditor, type ProjectEditorState } from "@/components/video-editor/projectPersistence";
import type { WebProjectData, WebProjectMediaItem } from "@/lib/web-project/types";

export interface WebPreviewModel {
	videoPath: string | null;
	showMissingBindings: string[];
	editor: ProjectEditorState;
}

function getMissingBindingKey(
	mediaItem: WebProjectMediaItem | undefined,
	resolvedUrl: string | null,
): string | null {
	if (!mediaItem || mediaItem.source.type !== "local-binding" || resolvedUrl) {
		return null;
	}

	return mediaItem.source.bindingKey;
}

export function createWebPreviewModel(
	project: WebProjectData,
	resolvedPrimaryVideoUrl: string | null,
	resolvedWebcamVideoUrl: string | null,
): WebPreviewModel {
	const editor = normalizeProjectEditor(project.editorState as Partial<ProjectEditorState>);
	const primaryVideo = project.mediaItems.find((item) => item.kind === "primary-video");
	const webcamVideo = project.mediaItems.find((item) => item.kind === "webcam-video");
	const showMissingBindings = [
		getMissingBindingKey(primaryVideo, resolvedPrimaryVideoUrl),
		getMissingBindingKey(webcamVideo, resolvedWebcamVideoUrl),
	].filter((bindingKey): bindingKey is string => bindingKey !== null);

	return {
		videoPath: resolvedPrimaryVideoUrl,
		showMissingBindings,
		editor: {
			...editor,
			webcam: {
				...editor.webcam,
				sourcePath: resolvedWebcamVideoUrl,
			},
		},
	};
}
