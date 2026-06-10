import type { WebViewerState } from "./types";

export function createDefaultWebViewerState(): WebViewerState {
	return {
		mode: "fit",
		autoplay: true,
		loop: true,
		showControls: true,
		startAtMs: 0,
	};
}
