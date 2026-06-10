import type { WebProjectMediaItem } from "@/lib/web-project/types";

export type ProjectFileBindings = Map<string, File>;

export type ResolvedProjectMediaItem =
	| (WebProjectMediaItem & { status: "ready"; url: string })
	| (WebProjectMediaItem & { status: "missing-binding"; bindingKey: string });
