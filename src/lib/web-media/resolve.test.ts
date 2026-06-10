import { describe, expect, it, vi } from "vitest";
import { resolveProjectMediaItem } from "./resolve";

describe("resolveProjectMediaItem", () => {
	it("returns remote URLs unchanged", async () => {
		const result = await resolveProjectMediaItem(
			{
				id: "main",
				kind: "primary-video",
				source: { type: "remote", url: "https://cdn.example.com/demo.mp4" },
			},
			new Map(),
		);

		expect(result.status).toBe("ready");
		if (result.status !== "ready") {
			throw new Error("Expected ready result");
		}
		expect(result.url).toBe("https://cdn.example.com/demo.mp4");
	});

	it("creates blob URLs for local bindings", async () => {
		const createObjectURL = vi.fn(() => "blob:demo-file");
		vi.stubGlobal("URL", { createObjectURL, revokeObjectURL: vi.fn() });

		const file = new File(["demo"], "demo.mp4", { type: "video/mp4" });
		const result = await resolveProjectMediaItem(
			{
				id: "main",
				kind: "primary-video",
				source: {
					type: "local-binding",
					bindingKey: "main",
					originalPathHint: "C:/clips/demo.mp4",
				},
			},
			new Map([["main", file]]),
		);

		expect(result.status).toBe("ready");
		if (result.status !== "ready") {
			throw new Error("Expected ready result");
		}
		expect(result.url).toBe("blob:demo-file");
	});

	it("marks missing bindings as unresolved", async () => {
		const result = await resolveProjectMediaItem(
			{
				id: "main",
				kind: "primary-video",
				source: {
					type: "local-binding",
					bindingKey: "main",
					originalPathHint: "C:/clips/demo.mp4",
				},
			},
			new Map(),
		);

		expect(result.status).toBe("missing-binding");
		if (result.status !== "missing-binding") {
			throw new Error("Expected missing-binding result");
		}
		expect(result.bindingKey).toBe("main");
	});
});
