export type WebProjectMediaSource =
	| { type: "remote"; url: string }
	| { type: "local-binding"; bindingKey: string; originalPathHint?: string };

export interface WebProjectMediaItem {
	id: string;
	kind: "primary-video" | "webcam-video" | "background-video";
	source: WebProjectMediaSource;
	displayName?: string;
	originalLocalPath?: string;
}

export interface WebViewerState {
	mode: "fit" | "fill";
	autoplay: boolean;
	loop: boolean;
	showControls: boolean;
	startAtMs: number;
}

export interface WebProjectData {
	version: 1;
	projectId: string;
	title: string;
	mediaItems: WebProjectMediaItem[];
	editorState: Record<string, unknown>;
	viewerState: WebViewerState;
}
