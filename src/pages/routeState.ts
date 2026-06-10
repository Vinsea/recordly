import type { WebProjectData } from "@/lib/web-project/types";

export type WebAppRoute = "viewer" | "editor";

export function parseWebAppRoute(search: string): WebAppRoute | null {
	const route = new URLSearchParams(search).get("route");
	return route === "viewer" || route === "editor" ? route : null;
}

export function parseViewerBootstrapState(project: WebProjectData): {
	primaryVideoUrl: string | null;
	missingBindings: string[];
} {
	const primaryVideo = project.mediaItems.find((item) => item.kind === "primary-video");
	if (!primaryVideo) {
		return { primaryVideoUrl: null, missingBindings: [] };
	}

	if (primaryVideo.source.type === "remote") {
		return {
			primaryVideoUrl: primaryVideo.source.url,
			missingBindings: [],
		};
	}

	return {
		primaryVideoUrl: null,
		missingBindings: [primaryVideo.source.bindingKey],
	};
}
