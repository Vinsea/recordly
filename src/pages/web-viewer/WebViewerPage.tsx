import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import VideoPlayback, { type VideoPlaybackRef } from "@/components/video-editor/VideoPlayback";
import type { CursorTelemetryPoint } from "@/components/video-editor/types";
import { useI18n } from "@/contexts/I18nContext";
import { resolveProjectMediaItem } from "@/lib/web-media/resolve";
import { BUILT_IN_WALLPAPERS } from "@/lib/wallpapers";
import { parseWebProject } from "@/lib/web-project/serialize";
import { createWebPreviewModel } from "@/pages/webPreviewModel";
import { MediaBindingPanel, ProjectFilePicker } from "@/pages/shared/ProjectFilePicker";

// ─── helpers ────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── visual editor panels ────────────────────────────────────────────────────

function SliderRow({
	label,
	value,
	min,
	max,
	step = 0.01,
	onChange,
}: {
	label: string;
	value: number;
	min: number;
	max: number;
	step?: number;
	onChange: (v: number) => void;
}) {
	return (
		<div className="flex items-center gap-2">
			<span className="w-28 shrink-0 text-xs text-foreground/60">{label}</span>
			<input
				type="range"
				min={min}
				max={max}
				step={step}
				value={value}
				onChange={(e) => onChange(Number(e.target.value))}
				className="w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-foreground/20 [&::-webkit-slider-thumb]:mt-[-3px] [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
			/>
			<span className="w-10 shrink-0 text-right text-xs tabular-nums text-foreground/60">
				{value.toFixed(step < 1 ? 2 : 0)}
			</span>
		</div>
	);
}

function SelectRow<T extends string>({
	label,
	value,
	options,
	onChange,
}: {
	label: string;
	value: T;
	options: { value: T; label: string }[];
	onChange: (v: T) => void;
}) {
	return (
		<div className="flex items-center gap-2">
			<span className="w-28 shrink-0 text-xs text-foreground/60">{label}</span>
			<select
				value={value}
				onChange={(e) => onChange(e.target.value as T)}
				className="flex-1 rounded border border-foreground/15 bg-foreground/5 px-2 py-1 text-xs text-foreground"
			>
				{options.map((o) => (
					<option key={o.value} value={o.value}>
						{o.label}
					</option>
				))}
			</select>
		</div>
	);
}

function ToggleRow({
	label,
	value,
	onChange,
}: {
	label: string;
	value: boolean;
	onChange: (v: boolean) => void;
}) {
	return (
		<div className="flex items-center gap-2">
			<span className="w-28 shrink-0 text-xs text-foreground/60">{label}</span>
			<button
				type="button"
				onClick={() => onChange(!value)}
				className={`relative h-5 w-9 rounded-full transition-colors ${value ? "bg-blue-500" : "bg-foreground/20"}`}
			>
				<span
					className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${value ? "left-4" : "left-0.5"}`}
				/>
			</button>
		</div>
	);
}

function SectionHeader({ title }: { title: string }) {
	return <h3 className="mt-3 mb-1.5 text-xs font-semibold uppercase tracking-wider text-foreground/40">{title}</h3>;
}

// ─── wallpaper picker ────────────────────────────────────────────────────────

const WALLPAPER_PRESETS = BUILT_IN_WALLPAPERS.filter((w) => !w.publicPath.endsWith(".mp4")).map((w) => ({
	value: w.publicPath,
	label: w.label,
}));

const EASING_OPTIONS = [
	{ value: "vecord", label: "Vecord" },
	{ value: "glide", label: "Glide" },
	{ value: "smooth", label: "Smooth" },
	{ value: "snappy", label: "Snappy" },
	{ value: "linear", label: "Linear" },
] as const;

const CURSOR_STYLE_OPTIONS = [
	{ value: "macos", label: "macOS" },
	{ value: "tahoe", label: "Tahoe" },
	{ value: "tahoe-inverted", label: "Tahoe Inverted" },
	{ value: "dot", label: "Dot" },
	{ value: "figma", label: "Figma" },
] as const;

const ASPECT_RATIO_OPTIONS = [
	{ value: "native", label: "Native" },
	{ value: "16:9", label: "16:9" },
	{ value: "9:16", label: "9:16" },
	{ value: "1:1", label: "1:1" },
	{ value: "4:3", label: "4:3" },
] as const;

// ─── visual editor ───────────────────────────────────────────────────────────

type EditorData = Record<string, unknown>;

function VisualEditor({
	editorData,
	onChange,
}: {
	editorData: EditorData;
	onChange: (patch: Partial<EditorData>) => void;
}) {
	const n = (key: string, fallback = 0) => (typeof editorData[key] === "number" ? (editorData[key] as number) : fallback);
	const b = (key: string, fallback = false) => (typeof editorData[key] === "boolean" ? (editorData[key] as boolean) : fallback);
	const s = (key: string, fallback = "") => (typeof editorData[key] === "string" ? (editorData[key] as string) : fallback);

	const wallpaperValue = s("wallpaper");
	const isGradient = wallpaperValue.startsWith("linear-gradient") || wallpaperValue.startsWith("radial-gradient");
	const matchedPreset = WALLPAPER_PRESETS.find((p) => p.value === wallpaperValue);

	return (
		<div className="flex flex-col gap-1.5 px-3 py-2">
			<SectionHeader title="背景" />

			{/* wallpaper */}
			<div className="flex items-start gap-2">
				<span className="w-28 shrink-0 pt-1 text-xs text-foreground/60">背景图</span>
				<div className="flex flex-1 flex-col gap-1.5">
					<select
						value={matchedPreset ? wallpaperValue : isGradient ? "__gradient__" : "__custom__"}
						onChange={(e) => {
							if (e.target.value !== "__gradient__" && e.target.value !== "__custom__") {
								onChange({ wallpaper: e.target.value });
							}
						}}
						className="w-full rounded border border-foreground/15 bg-foreground/5 px-2 py-1 text-xs text-foreground"
					>
						{WALLPAPER_PRESETS.map((p) => (
							<option key={p.value} value={p.value}>
								{p.label}
							</option>
						))}
						{isGradient && <option value="__gradient__">渐变色（自定义）</option>}
						{!matchedPreset && !isGradient && <option value="__custom__">自定义</option>}
					</select>
					{isGradient && (
						<input
							type="text"
							value={wallpaperValue}
							onChange={(e) => onChange({ wallpaper: e.target.value })}
							placeholder="linear-gradient(...)"
							className="w-full rounded border border-foreground/15 bg-foreground/5 px-2 py-1 font-mono text-xs text-foreground"
						/>
					)}
				</div>
			</div>

			<SliderRow label="阴影强度" value={n("shadowIntensity", 0.5)} min={0} max={1} onChange={(v) => onChange({ shadowIntensity: v })} />
			<SliderRow label="背景模糊" value={n("backgroundBlur", 0)} min={0} max={20} step={0.5} onChange={(v) => onChange({ backgroundBlur: v })} />
			<SliderRow label="圆角" value={n("borderRadius", 8)} min={0} max={40} step={1} onChange={(v) => onChange({ borderRadius: v })} />
			<SelectRow
				label="宽高比"
				value={s("aspectRatio", "native") as string}
				options={ASPECT_RATIO_OPTIONS as unknown as { value: string; label: string }[]}
				onChange={(v) => onChange({ aspectRatio: v })}
			/>

			<SectionHeader title="鼠标光标" />
			<ToggleRow label="显示光标" value={b("showCursor", true)} onChange={(v) => onChange({ showCursor: v })} />
			<SelectRow
				label="光标样式"
				value={s("cursorStyle", "tahoe") as string}
				options={CURSOR_STYLE_OPTIONS as unknown as { value: string; label: string }[]}
				onChange={(v) => onChange({ cursorStyle: v })}
			/>
			<SliderRow label="光标大小" value={n("cursorSize", 2)} min={0.5} max={5} onChange={(v) => onChange({ cursorSize: v })} />
			<SliderRow label="光标平滑" value={n("cursorSmoothing", 0.67)} min={0} max={1} onChange={(v) => onChange({ cursorSmoothing: v })} />
			<SliderRow label="运动模糊" value={n("cursorMotionBlur", 0.4)} min={0} max={1} onChange={(v) => onChange({ cursorMotionBlur: v })} />
			<SliderRow label="点击弹跳" value={n("cursorClickBounce", 3.5)} min={0} max={10} onChange={(v) => onChange({ cursorClickBounce: v })} />

			<SectionHeader title="缩放动效" />
			<ToggleRow label="连接缩放" value={b("connectZooms", true)} onChange={(v) => onChange({ connectZooms: v })} />
			<SliderRow label="放大时长 ms" value={n("zoomInDurationMs", 200)} min={0} max={800} step={10} onChange={(v) => onChange({ zoomInDurationMs: v })} />
			<SliderRow label="缩小时长 ms" value={n("zoomOutDurationMs", 200)} min={0} max={800} step={10} onChange={(v) => onChange({ zoomOutDurationMs: v })} />
			<SliderRow label="运动模糊" value={n("zoomMotionBlur", 0.35)} min={0} max={1} onChange={(v) => onChange({ zoomMotionBlur: v })} />
			<SelectRow
				label="放大缓动"
				value={s("zoomInEasing", "recordly") as string}
				options={EASING_OPTIONS as unknown as { value: string; label: string }[]}
				onChange={(v) => onChange({ zoomInEasing: v })}
			/>
			<SelectRow
				label="缩小缓动"
				value={s("zoomOutEasing", "recordly") as string}
				options={EASING_OPTIONS as unknown as { value: string; label: string }[]}
				onChange={(v) => onChange({ zoomOutEasing: v })}
			/>

			<SectionHeader title="字幕" />
			{(() => {
				const cs = (editorData.autoCaptionSettings ?? {}) as Record<string, unknown>;
				const patch = (p: Record<string, unknown>) =>
					onChange({ autoCaptionSettings: { ...(editorData.autoCaptionSettings as object ?? {}), ...p } });
				const cn = (k: string, fb = 0) => (typeof cs[k] === "number" ? (cs[k] as number) : fb);
				const cb = (k: string, fb = false) => (typeof cs[k] === "boolean" ? (cs[k] as boolean) : fb);
				return (
					<>
						<ToggleRow label="启用字幕" value={cb("enabled")} onChange={(v) => patch({ enabled: v })} />
						<SliderRow label="字体大小" value={cn("fontSize", 30)} min={12} max={60} step={1} onChange={(v) => patch({ fontSize: v })} />
						<SliderRow label="底部偏移%" value={cn("bottomOffset", 3)} min={0} max={30} step={0.5} onChange={(v) => patch({ bottomOffset: v })} />
						<SliderRow label="背景透明度" value={cn("backgroundOpacity", 0.9)} min={0} max={1} onChange={(v) => patch({ backgroundOpacity: v })} />
					</>
				);
			})()}
		</div>
	);
}

// ─── json editor ─────────────────────────────────────────────────────────────

function JsonEditor({
	projectText,
	onChange,
}: {
	projectText: string;
	onChange: (text: string) => void;
}) {
	const [localText, setLocalText] = useState(projectText);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setLocalText(projectText);
	}, [projectText]);

	const handleChange = (text: string) => {
		setLocalText(text);
		try {
			JSON.parse(text);
			setError(null);
			onChange(text);
		} catch {
			setError("JSON 语法错误");
		}
	};

	return (
		<div className="flex flex-1 flex-col overflow-hidden">
			{error && (
				<div className="shrink-0 px-3 py-1.5 text-xs text-red-400">{error}</div>
			)}
			<textarea
				value={localText}
				onChange={(e) => handleChange(e.target.value)}
				spellCheck={false}
				className="flex-1 resize-none bg-transparent px-3 py-2 font-mono text-xs text-foreground/80 outline-none placeholder:text-foreground/30"
			/>
		</div>
	);
}

// ─── main page ───────────────────────────────────────────────────────────────

export function WebViewerPage({
	initialProjectJson,
	initialBindings,
	initialCursorTelemetry,
	showHeader = true,
}: {
	initialProjectJson?: string;
	initialBindings?: Map<string, File>;
	initialCursorTelemetry?: CursorTelemetryPoint[];
	showHeader?: boolean;
}) {
	const { t } = useI18n();
	const [projectText, setProjectText] = useState(initialProjectJson ?? "");
	const [bindings, setBindings] = useState<Map<string, File>>(initialBindings ?? new Map());
	const [cursorTelemetry, setCursorTelemetry] = useState<CursorTelemetryPoint[]>(initialCursorTelemetry ?? []);
	const [editorTab, setEditorTab] = useState<"visual" | "json">("visual");
	const project = useMemo(() => (projectText ? parseWebProject(projectText) : null), [projectText]);
	const [resolvedPrimaryVideoUrl, setResolvedPrimaryVideoUrl] = useState<string | null>(null);
	const [resolvedWebcamVideoUrl, setResolvedWebcamVideoUrl] = useState<string | null>(null);
	const [duration, setDuration] = useState(0);
	const [currentTime, setCurrentTime] = useState(0);
	const [isPlaying, setIsPlaying] = useState(false);
	const [isSeeking, setIsSeeking] = useState(false);
	const [seekValue, setSeekValue] = useState(0);
	const [previewError, setPreviewError] = useState<string | null>(null);
	const playbackRef = useRef<VideoPlaybackRef>(null);

	const handleTimeUpdate = useCallback(
		(t: number) => {
			if (!isSeeking) setCurrentTime(t);
		},
		[isSeeking],
	);
	const noop = useCallback(() => {}, []);

	const previewModel = useMemo(
		() =>
			project
				? createWebPreviewModel(project, resolvedPrimaryVideoUrl, resolvedWebcamVideoUrl)
				: null,
		[project, resolvedPrimaryVideoUrl, resolvedWebcamVideoUrl],
	);

	useEffect(() => {
		setProjectText(initialProjectJson ?? "");
	}, [initialProjectJson]);

	useEffect(() => {
		setBindings(initialBindings ?? new Map());
	}, [initialBindings]);

	useEffect(() => {
		if (initialCursorTelemetry && initialCursorTelemetry.length > 0) {
			setCursorTelemetry(initialCursorTelemetry);
		}
	}, [initialCursorTelemetry]);

	useEffect(() => {
		if (!isSeeking) setSeekValue(currentTime);
	}, [currentTime, isSeeking]);

	useEffect(() => {
		if (!project) {
			setResolvedPrimaryVideoUrl(null);
			setResolvedWebcamVideoUrl(null);
			return;
		}

		const primaryVideo = project.mediaItems.find((item) => item.kind === "primary-video");
		const webcamVideo = project.mediaItems.find((item) => item.kind === "webcam-video");

		if (!primaryVideo) {
			setResolvedPrimaryVideoUrl(null);
		} else {
			void resolveProjectMediaItem(primaryVideo, bindings).then((result) => {
				setResolvedPrimaryVideoUrl(result.status === "ready" ? result.url : null);
			});
		}

		if (!webcamVideo) {
			setResolvedWebcamVideoUrl(null);
		} else {
			void resolveProjectMediaItem(webcamVideo, bindings).then((result) => {
				setResolvedWebcamVideoUrl(result.status === "ready" ? result.url : null);
			});
		}
	}, [bindings, project]);

	// patch editor state and rebuild projectText
	const patchEditor = useCallback(
		(patch: Record<string, unknown>) => {
			if (!projectText) return;
			try {
				const parsed = JSON.parse(projectText) as Record<string, unknown>;
				const editor = (parsed.editor && typeof parsed.editor === "object" ? parsed.editor : {}) as Record<string, unknown>;
				const next = { ...parsed, editor: { ...editor, ...patch } };
				setProjectText(JSON.stringify(next, null, 2));
			} catch {
				// malformed JSON - ignore
			}
		},
		[projectText],
	);

	const isDev = new URLSearchParams(window.location.search).get("isDev") === "1";

	// ── no project yet: show file picker ────────────────────────────────────
	if (!project) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-editor-bg text-foreground">
				<ProjectFilePicker
					onProjectLoaded={({ projectText: text, bindings: autoBindings, cursorTelemetry: cursor }) => {
						setProjectText(text);
						if (autoBindings.size > 0) setBindings(autoBindings);
						if (cursor.length > 0) setCursorTelemetry(cursor);
					}}
				/>
			</div>
		);
	}

	const localBindingItems = project.mediaItems.filter(
		(item) => item.source.type === "local-binding" && !bindings.has(item.source.bindingKey),
	);

	const hasVideo = !!previewModel?.videoPath;

	const editorData = (project.editorState ?? {}) as EditorData;

	// ── main two-pane layout ─────────────────────────────────────────────────
	return (
		<div className="flex h-screen overflow-hidden bg-editor-bg text-foreground">

			{/* ── left: editor panel (dev mode only) ────────────────────────── */}
			{isDev && <div className="flex w-80 shrink-0 flex-col overflow-hidden border-r border-foreground/10">
				{showHeader && (
					<div className="shrink-0 border-b border-foreground/10 px-3 py-3">
						<h1 className="truncate text-sm font-semibold">{project.title}</h1>
					</div>
				)}

				{/* tab bar */}
				<div className="flex shrink-0 border-b border-foreground/10">
					<button
						type="button"
						onClick={() => setEditorTab("visual")}
						className={`flex-1 py-2 text-xs font-medium transition-colors ${editorTab === "visual" ? "border-b-2 border-blue-500 text-foreground" : "text-foreground/50 hover:text-foreground/80"}`}
					>
						可视化
					</button>
					<button
						type="button"
						onClick={() => setEditorTab("json")}
						className={`flex-1 py-2 text-xs font-medium transition-colors ${editorTab === "json" ? "border-b-2 border-blue-500 text-foreground" : "text-foreground/50 hover:text-foreground/80"}`}
					>
						JSON
					</button>
				</div>

				{/* binding panel (always visible if needed) */}
				{localBindingItems.length > 0 && (
					<div className="shrink-0 border-b border-foreground/10">
						<MediaBindingPanel
							items={localBindingItems}
							onBind={(bindingKey, file) => {
								setBindings((prev) => new Map(prev).set(bindingKey, file));
							}}
							onCursorBind={setCursorTelemetry}
						/>
					</div>
				)}

				{/* editor content */}
				<div className="min-h-0 flex-1 overflow-y-auto">
					{editorTab === "visual" ? (
						<VisualEditor editorData={editorData} onChange={patchEditor} />
					) : (
						<JsonEditor projectText={projectText} onChange={setProjectText} />
					)}
				</div>

				{/* download JSON */}
				<div className="shrink-0 border-t border-foreground/10 px-3 py-2">
					<button
						type="button"
						onClick={() => {
							const blob = new Blob([projectText], { type: "application/json" });
							const url = URL.createObjectURL(blob);
							const a = document.createElement("a");
							a.href = url;
							a.download = `${project.projectId || "project"}.recordly`;
							a.click();
							URL.revokeObjectURL(url);
						}}
						className="w-full rounded-lg border border-foreground/15 bg-foreground/8 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-foreground/15"
					>
						导出 .recordly
					</button>
				</div>
			</div>}

			{/* ── right: preview ──────────────────────────────────────────────── */}
			<div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-3 overflow-hidden p-4">
				<div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-black/40 shadow-2xl shadow-black/20"
					style={{ maxHeight: "calc(100vh - 2rem)" }}
				>
					{hasVideo ? (
						<div className="min-h-0 flex-1 overflow-hidden">
							<VideoPlayback
								ref={playbackRef}
								key={`${previewModel.videoPath}`}
								aspectRatio={previewModel.editor.aspectRatio}
								videoPath={previewModel.videoPath as string}
								onDurationChange={setDuration}
								onTimeUpdate={handleTimeUpdate}
								currentTime={currentTime}
								onPlayStateChange={setIsPlaying}
								onError={setPreviewError}
								wallpaper={previewModel.editor.wallpaper}
								zoomRegions={previewModel.editor.zoomRegions}
								selectedZoomId={null}
								onSelectZoom={noop}
								onZoomFocusChange={noop}
								isPlaying={isPlaying}
								showShadow={previewModel.editor.shadowIntensity > 0}
								shadowIntensity={previewModel.editor.shadowIntensity}
								backgroundBlur={previewModel.editor.backgroundBlur}
								connectZooms={previewModel.editor.connectZooms}
								zoomInDurationMs={previewModel.editor.zoomInDurationMs}
								zoomInOverlapMs={previewModel.editor.zoomInOverlapMs}
								zoomOutDurationMs={previewModel.editor.zoomOutDurationMs}
								connectedZoomGapMs={previewModel.editor.connectedZoomGapMs}
								connectedZoomDurationMs={previewModel.editor.connectedZoomDurationMs}
								zoomInEasing={previewModel.editor.zoomInEasing}
								zoomOutEasing={previewModel.editor.zoomOutEasing}
								connectedZoomEasing={previewModel.editor.connectedZoomEasing}
								borderRadius={previewModel.editor.borderRadius}
								padding={previewModel.editor.padding}
								frame={previewModel.editor.frame}
								cropRegion={previewModel.editor.cropRegion}
								webcam={previewModel.editor.webcam}
								webcamVideoPath={previewModel.editor.webcam.sourcePath}
								trimRegions={previewModel.editor.trimRegions}
								speedRegions={previewModel.editor.speedRegions}
								annotationRegions={previewModel.editor.annotationRegions}
								autoCaptions={previewModel.editor.autoCaptions}
								autoCaptionSettings={previewModel.editor.autoCaptionSettings}
								cursorTelemetry={cursorTelemetry}
								showCursor={previewModel.editor.showCursor}
								cursorStyle={previewModel.editor.cursorStyle}
								cursorSize={previewModel.editor.cursorSize}
								cursorSmoothing={previewModel.editor.cursorSmoothing}
								cursorSpringStiffnessMultiplier={previewModel.editor.cursorSpringStiffnessMultiplier}
								cursorSpringDampingMultiplier={previewModel.editor.cursorSpringDampingMultiplier}
								cursorSpringMassMultiplier={previewModel.editor.cursorSpringMassMultiplier}
								cameraSpringStiffnessMultiplier={previewModel.editor.cameraSpringStiffnessMultiplier}
								cameraSpringDampingMultiplier={previewModel.editor.cameraSpringDampingMultiplier}
								cameraSpringMassMultiplier={previewModel.editor.cameraSpringMassMultiplier}
								zoomSmoothness={previewModel.editor.zoomSmoothness}
								zoomClassicMode={previewModel.editor.zoomClassicMode}
								zoomMotionBlur={previewModel.editor.zoomMotionBlur}
								zoomMotionBlurTuning={previewModel.editor.zoomMotionBlurTuning}
								cursorMotionBlur={previewModel.editor.cursorMotionBlur}
								cursorClickEffect={previewModel.editor.cursorClickEffect}
								cursorClickEffectColor={previewModel.editor.cursorClickEffectColor}
								cursorClickEffectScale={previewModel.editor.cursorClickEffectScale}
								cursorClickEffectOpacity={previewModel.editor.cursorClickEffectOpacity}
								cursorClickEffectDurationMs={previewModel.editor.cursorClickEffectDurationMs}
								cursorClickBounce={previewModel.editor.cursorClickBounce}
								cursorClickBounceDuration={previewModel.editor.cursorClickBounceDuration}
								cursorSway={previewModel.editor.cursorSway}
								volume={1}
							/>
						</div>
					) : (
						<div className="flex aspect-video items-center justify-center text-sm text-foreground/65">
							{previewModel?.showMissingBindings.length
								? t("editor.web.bindMissingMediaHint", "请先绑定缺失素材后再预览。")
								: t("editor.web.noPreviewVideo", "当前没有可预览的视频。")}
						</div>
					)}

					{/* playback controls */}
					{hasVideo && (
						<div className="flex shrink-0 items-center gap-3 border-t border-foreground/10 bg-black/60 px-4 py-3">
							<button
								type="button"
								onClick={() => {
									const ref = playbackRef.current;
									if (!ref) return;
									const paused = ref.video?.paused ?? true;
									if (paused) void ref.play();
									else ref.pause();
								}}
								className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-foreground/15 bg-foreground/10 text-sm transition-colors hover:bg-foreground/20"
								aria-label={isPlaying ? "暂停" : "播放"}
							>
								{isPlaying ? "⏸" : "▶"}
							</button>

							<span className="w-20 shrink-0 text-right text-xs tabular-nums text-foreground/60">
								{formatTime(currentTime)} / {formatTime(duration)}
							</span>

							<input
								type="range"
								min={0}
								max={duration || 1}
								step={0.05}
								value={isSeeking ? seekValue : currentTime}
								onMouseDown={() => setIsSeeking(true)}
								onTouchStart={() => setIsSeeking(true)}
								onChange={(e) => setSeekValue(Number(e.target.value))}
								onMouseUp={(e) => {
									const v = Number((e.target as HTMLInputElement).value);
									setCurrentTime(v);
									setSeekValue(v);
									setIsSeeking(false);
								}}
								onTouchEnd={(e) => {
									const v = Number((e.target as HTMLInputElement).value);
									setCurrentTime(v);
									setSeekValue(v);
									setIsSeeking(false);
								}}
								className="w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-foreground/20 [&::-webkit-slider-thumb]:mt-[-3px] [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-foreground/20 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white"
							/>
						</div>
					)}
				</div>

				{previewError && <p className="text-sm text-destructive">{previewError}</p>}
			</div>
		</div>
	);
}
