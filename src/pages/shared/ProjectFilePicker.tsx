import { useI18n } from "@/contexts/I18nContext";
import type { CursorTelemetryPoint } from "@/components/video-editor/types";
import type { WebProjectMediaItem } from "@/lib/web-project/types";

export function parseCursorJson(raw: unknown): CursorTelemetryPoint[] {
	if (!raw || typeof raw !== "object") return [];
	const obj = raw as Record<string, unknown>;
	const samples = Array.isArray(obj.samples) ? obj.samples : [];
	return samples.filter(
		(s): s is CursorTelemetryPoint =>
			s !== null &&
			typeof s === "object" &&
			typeof (s as Record<string, unknown>).timeMs === "number" &&
			typeof (s as Record<string, unknown>).cx === "number" &&
			typeof (s as Record<string, unknown>).cy === "number",
	);
}

export interface ProjectLoadedResult {
	projectText: string;
	bindings: Map<string, File>;
	cursorTelemetry: CursorTelemetryPoint[];
}

export function ProjectFilePicker({
	onProjectLoaded,
}: {
	onProjectLoaded: (result: ProjectLoadedResult) => void;
}) {
	const { t } = useI18n();

	return (
		<label className="flex flex-col gap-2 rounded-2xl border border-foreground/10 bg-foreground/5 p-6 cursor-pointer">
			<span className="text-sm font-medium">
				{t("launch.openProject", "Open project")}
			</span>
			<input
				type="file"
				accept=".recordly,.openscreen"
				className="text-xs"
				onChange={async (event) => {
					const file = event.target.files?.[0];
					if (!file) return;
					onProjectLoaded({
						projectText: await file.text(),
						bindings: new Map(),
						cursorTelemetry: [],
					});
				}}
			/>
		</label>
	);
}

export function MediaBindingPanel({
	items,
	onBind,
	onCursorBind,
}: {
	items: WebProjectMediaItem[];
	onBind: (bindingKey: string, file: File) => void;
	onCursorBind?: (telemetry: CursorTelemetryPoint[]) => void;
}) {
	const { t } = useI18n();

	return (
		<section className="flex flex-col gap-4 rounded-2xl border border-foreground/10 bg-foreground/5 p-4">
			<h2 className="text-sm font-medium">{t("editor.web.bindMissingMedia", "绑定缺失素材")}</h2>

			{items.map((item) => {
				const hint = item.source.type === "local-binding" ? item.source.originalPathHint : null;
				return (
					<label key={item.id} className="flex flex-col gap-1.5 text-sm">
						<span className="font-medium text-foreground/80">{item.displayName ?? item.id}</span>
						{hint ? (
							<span className="break-all font-mono text-xs text-foreground/40">{hint}</span>
						) : null}
						<input
							type="file"
							accept="video/*"
							onChange={(event) => {
								const file = event.target.files?.[0];
								if (!file || item.source.type !== "local-binding") return;
								onBind(item.source.bindingKey, file);
							}}
						/>
					</label>
				);
			})}

			{onCursorBind ? (
				<label className="flex flex-col gap-1.5 text-sm">
					<span className="font-medium text-foreground/80">
						{t("editor.web.bindCursor", "鼠标轨迹（可选）")}
					</span>
					<span className="text-xs text-foreground/40">
						{t("editor.web.bindCursorHint", "选择录制目录下的 .mp4.cursor.json 文件")}
					</span>
					<input
						type="file"
						accept=".json,application/json"
						onChange={async (event) => {
							const file = event.target.files?.[0];
							if (!file) return;
							try {
								const telemetry = parseCursorJson(JSON.parse(await file.text()) as unknown);
								onCursorBind(telemetry);
							} catch {
								// ignore parse errors
							}
						}}
					/>
				</label>
			) : null}
		</section>
	);
}
