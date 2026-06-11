import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { I18nProvider } from "./contexts/I18nContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { WebViewerPage } from "./pages/web-viewer/WebViewerPage";
import { parseCursorJson } from "./pages/shared/ProjectFilePicker";
import type { CursorTelemetryPoint } from "./components/video-editor/types";
import "./index.css";

document.documentElement.dataset.platform = /mac/i.test(navigator.platform) ? "macos" : "other";

// Patch local paths in a .recordly JSON string: replace videoPath and
// webcam.sourcePath with the supplied remote URLs so the web viewer can
// resolve them without local file bindings.
function patchProjectJson(raw: string, videoUrl: string | null): string {
	try {
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		if (videoUrl) {
			parsed.videoPath = videoUrl;
		}
		// Strip local audio paths — they can't be fetched remotely
		const editor = parsed.editor as Record<string, unknown> | undefined;
		if (editor && Array.isArray(editor.audioRegions)) {
			editor.audioRegions = [];
		}
		return JSON.stringify(parsed);
	} catch {
		return raw;
	}
}

function AppWithUrlParams() {
	const params = new URLSearchParams(window.location.search);
	const projectUrl = params.get("project");
	const videoUrl = params.get("video");
	const cursorUrl = params.get("cursor");

	const [projectJson, setProjectJson] = useState<string | undefined>(undefined);
	const [cursor, setCursor] = useState<CursorTelemetryPoint[]>([]);
	const [loading, setLoading] = useState(!!projectUrl);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!projectUrl) return;

		const fetchAll = async () => {
			try {
				const [projectText, cursorData] = await Promise.all([
					fetch(projectUrl).then((r) => {
						if (!r.ok) throw new Error(`Failed to fetch project: ${r.status}`);
						return r.text();
					}),
					cursorUrl
						? fetch(cursorUrl)
								.then((r) => (r.ok ? r.json() : null))
								.catch(() => null)
						: Promise.resolve(null),
				]);

				const patched = patchProjectJson(projectText, videoUrl);
				setProjectJson(patched);
				if (cursorData) setCursor(parseCursorJson(cursorData));
			} catch (e) {
				setError(e instanceof Error ? e.message : String(e));
			} finally {
				setLoading(false);
			}
		};

		void fetchAll();
	}, [projectUrl, videoUrl, cursorUrl]);

	if (loading) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-editor-bg text-foreground text-sm">
				Loading project…
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-editor-bg text-foreground text-sm">
				Error: {error}
			</div>
		);
	}

	return <WebViewerPage initialProjectJson={projectJson} initialCursorTelemetry={cursor} />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<ThemeProvider>
			<I18nProvider>
				<AppWithUrlParams />
			</I18nProvider>
		</ThemeProvider>
	</React.StrictMode>,
);
