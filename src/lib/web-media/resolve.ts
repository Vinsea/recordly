import type { WebProjectMediaItem } from "@/lib/web-project/types";
import type { ProjectFileBindings, ResolvedProjectMediaItem } from "./types";

export async function resolveProjectMediaItem(
	mediaItem: WebProjectMediaItem,
	bindings: ProjectFileBindings,
): Promise<ResolvedProjectMediaItem> {
	if (mediaItem.source.type === "remote") {
		return { ...mediaItem, status: "ready", url: mediaItem.source.url };
	}

	const file = bindings.get(mediaItem.source.bindingKey);
	if (!file) {
		return {
			...mediaItem,
			status: "missing-binding",
			bindingKey: mediaItem.source.bindingKey,
		};
	}

	return {
		...mediaItem,
		status: "ready",
		url: URL.createObjectURL(file),
	};
}
