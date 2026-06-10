import { useMemo, useRef, useState, type ReactNode } from "react";
import type {
	AutoCaptionAnimation,
	CursorClickEffectStyle,
	CursorStyle,
	WebcamCorner,
} from "@/components/video-editor/types";
import { useI18n } from "@/contexts/I18nContext";
import type { ProjectFileBindings } from "@/lib/web-media/types";
import { stringifyWebProject } from "@/lib/web-project/serialize";
import { ASPECT_RATIOS } from "@/utils/aspectRatioUtils";
import {
	attachPrimaryVideoFile,
	attachWebcamVideoFile,
	createEmptyWebProject,
	replaceProjectFromImport,
	updateWebProjectCaptions,
	updateWebProjectScene,
	updateWebProjectZoomMotion,
	updateWebProjectZoomTransitions,
	updateWebProjectEditorState,
	updateWebProjectTitle,
	updateWebProjectWebcam,
} from "@/pages/webEditorState";
import { WebViewerPage } from "@/pages/web-viewer/WebViewerPage";

// Will be used in task #44 sidebar restructure
export function SidebarSection({
	title,
	defaultOpen = false,
	children,
}: {
	title: string;
	defaultOpen?: boolean;
	children: ReactNode;
}) {
	return (
		<details
			open={defaultOpen}
			className="group rounded-xl border border-foreground/10 bg-black/20 px-3 py-3 text-sm"
		>
			<summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-foreground/80">
				<span>{title}</span>
				<span className="text-xs text-foreground/45 transition-transform group-open:rotate-180">⌄</span>
			</summary>
			<div className="mt-3 flex flex-col gap-3">{children}</div>
		</details>
	);
}

export function WebEditorPage({ initialProjectJson }: { initialProjectJson?: string }) {
	const { t } = useI18n();
	const [project, setProject] = useState(() =>
		initialProjectJson
			? replaceProjectFromImport(createEmptyWebProject(), initialProjectJson)
			: createEmptyWebProject(),
	);
	const [bindings, setBindings] = useState<ProjectFileBindings>(new Map());
	const importProjectInputRef = useRef<HTMLInputElement | null>(null);
	const primaryVideoInputRef = useRef<HTMLInputElement | null>(null);
	const webcamVideoInputRef = useRef<HTMLInputElement | null>(null);
	const projectText = useMemo(() => stringifyWebProject(project), [project]);
	const viewerProjectText = useMemo(() => stringifyWebProject(project), [project]);
	const sectionLabels = {
		projectTitle: t("editor.web.projectTitle", "项目标题"),
		editorReady: t("editor.web.editorReady", "网页编辑器已就绪，可直接导入项目或绑定素材。"),
		importProject: t("editor.web.importProject", "导入项目"),
		selectVideo: t("editor.web.selectVideo", "选择视频"),
		selectWebcam: t("editor.web.selectWebcam", "选择摄像头视频"),
		saveProject: t("editor.web.saveProject", "保存项目"),
		primaryVideo: t("editor.web.primaryVideo", "主视频"),
		webcamVideo: t("editor.web.webcamVideo", "摄像头视频"),
		notSelected: t("editor.web.notSelected", "未选择"),
		scene: t("editor.web.scene", "场景与缩放"),
		appearance: t("editor.web.appearance", "外观"),
		webcam: t("editor.web.webcam", "摄像头"),
		captions: t("editor.web.captions", "字幕"),
		cursor: t("editor.web.cursor", "光标"),
		crop: t("editor.web.crop", "裁剪"),
		preview: t("editor.web.preview", "预览"),
		aspectRatio: t("editor.web.aspectRatio", "画幅比例"),
		frame: t("editor.web.frame", "边框样式"),
		none: t("common.none", "无"),
		browserDark: t("editor.web.browserDark", "浏览器深色"),
		browserLight: t("editor.web.browserLight", "浏览器浅色"),
		connectZooms: t("editor.web.connectZooms", "连接相邻缩放"),
		zoomInDuration: t("editor.web.zoomInDuration", "放大时长"),
		zoomOutDuration: t("editor.web.zoomOutDuration", "缩小时长"),
		zoomMotionBlur: t("editor.web.zoomMotionBlur", "缩放动态模糊"),
		zoomInOverlap: t("editor.web.zoomInOverlap", "放大重叠时长"),
		connectedGap: t("editor.web.connectedGap", "连接间隔"),
		connectedDuration: t("editor.web.connectedDuration", "连接动画时长"),
		zoomInEasing: t("editor.web.zoomInEasing", "放大缓动"),
		zoomOutEasing: t("editor.web.zoomOutEasing", "缩小缓动"),
		connectedEasing: t("editor.web.connectedEasing", "连接缓动"),
		wallpaper: t("editor.web.wallpaper", "壁纸"),
		tahoeLight: t("editor.web.tahoeLight", "Tahoe 浅色"),
		tahoeDark: t("editor.web.tahoeDark", "Tahoe 深色"),
		backgroundBlur: t("editor.web.backgroundBlur", "背景模糊"),
		shadowIntensity: t("editor.web.shadowIntensity", "阴影强度"),
		borderRadius: t("editor.web.borderRadius", "圆角"),
		padding: t("editor.web.padding", "内边距"),
		showCursor: t("editor.web.showCursor", "显示光标"),
		enableWebcam: t("editor.web.enableWebcam", "启用摄像头"),
		mirror: t("editor.web.mirror", "镜像"),
		corner: t("editor.web.corner", "位置"),
		topLeft: t("editor.web.topLeft", "左上"),
		topRight: t("editor.web.topRight", "右上"),
		bottomLeft: t("editor.web.bottomLeft", "左下"),
		bottomRight: t("editor.web.bottomRight", "右下"),
		size: t("editor.web.size", "尺寸"),
		margin: t("editor.web.margin", "边距"),
		reactToZoom: t("editor.web.reactToZoom", "跟随缩放"),
		cornerRadius: t("editor.web.cornerRadius", "圆角半径"),
		webcamShadow: t("editor.web.webcamShadow", "摄像头阴影"),
		enableCaptions: t("editor.web.enableCaptions", "启用字幕"),
		sampleCues: t("editor.web.sampleCues", "示例字幕条数"),
		loadSampleCaptions: t("editor.web.loadSampleCaptions", "载入示例字幕"),
		animation: t("editor.web.animation", "动画"),
		fade: t("editor.web.fade", "淡入淡出"),
		rise: t("editor.web.rise", "上浮"),
		pop: t("editor.web.pop", "弹出"),
		fontSize: t("editor.web.fontSize", "字号"),
		maxRows: t("editor.web.maxRows", "最大行数"),
		backgroundOpacity: t("editor.web.backgroundOpacity", "背景透明度"),
		textColor: t("editor.web.textColor", "文字颜色"),
		inactiveTextColor: t("editor.web.inactiveTextColor", "未高亮文字颜色"),
		captionBoxRadius: t("editor.web.captionBoxRadius", "字幕圆角"),
		style: t("editor.web.style", "样式"),
		cursorSize: t("editor.web.cursorSize", "光标大小"),
		cursorSway: t("editor.web.cursorSway", "光标摆动"),
		clickEffect: t("editor.web.clickEffect", "点击效果"),
		spotlight: t("editor.web.spotlight", "聚光"),
		ripple: t("editor.web.ripple", "涟漪"),
		echo: t("editor.web.echo", "回声"),
		clickColor: t("editor.web.clickColor", "点击颜色"),
		clickScale: t("editor.web.clickScale", "点击缩放"),
		clickOpacity: t("editor.web.clickOpacity", "点击透明度"),
		clickDuration: t("editor.web.clickDuration", "点击时长"),
		cropX: t("editor.web.cropX", "X"),
		cropY: t("editor.web.cropY", "Y"),
		cropWidth: t("editor.web.cropWidth", "宽度"),
		cropHeight: t("editor.web.cropHeight", "高度"),
	};

	const saveProject = () => {
		const blob = new Blob([projectText], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download = `${project.title || "recordly-project"}.json`;
		anchor.click();
		URL.revokeObjectURL(url);
	};

	const importProject = async (file: File) => {
		const nextText = await file.text();
		setProject((current) => replaceProjectFromImport(current, nextText));
		setBindings(new Map());
	};

	const attachPrimaryVideo = (file: File) => {
		setProject((current) => {
			const next = attachPrimaryVideoFile(current, file, bindings);
			setBindings(next.bindings);
			return next.project;
		});
	};

	const attachWebcamVideo = (file: File) => {
		setProject((current) => {
			const next = attachWebcamVideoFile(current, file, bindings);
			setBindings(next.bindings);
			return next.project;
		});
	};

	const primaryVideo = project.mediaItems.find((item) => item.kind === "primary-video");
	const webcamVideo = project.mediaItems.find((item) => item.kind === "webcam-video");
	const editorState = (project.editorState ?? {}) as Record<string, unknown>;
	const projectTitle = project.title;
	const wallpaper =
		typeof editorState.wallpaper === "string"
			? editorState.wallpaper
			: "/wallpapers/tahoe-light.jpg";
	const backgroundBlur =
		typeof editorState.backgroundBlur === "number" ? editorState.backgroundBlur : 0;
	const showCursor = typeof editorState.showCursor === "boolean" ? editorState.showCursor : true;
	const shadowIntensity =
		typeof editorState.shadowIntensity === "number" ? editorState.shadowIntensity : 0.67;
	const borderRadius =
		typeof editorState.borderRadius === "number" ? editorState.borderRadius : 12.5;
	const aspectRatio = typeof editorState.aspectRatio === "string" ? editorState.aspectRatio : "16:9";
	const frame = typeof editorState.frame === "string" ? editorState.frame : null;
	const padding =
		typeof editorState.padding === "object" && editorState.padding !== null
			? (editorState.padding as { top?: number; right?: number; bottom?: number; left?: number })
			: { top: 20, right: 20, bottom: 20, left: 20 };
	const cropRegion =
		typeof editorState.cropRegion === "object" && editorState.cropRegion !== null
			? (editorState.cropRegion as { x?: number; y?: number; width?: number; height?: number })
			: { x: 0, y: 0, width: 1, height: 1 };
	const webcam =
		typeof editorState.webcam === "object" && editorState.webcam !== null
			? (editorState.webcam as {
					enabled?: boolean;
					mirror?: boolean;
					corner?: WebcamCorner;
					size?: number;
					margin?: number;
					reactToZoom?: boolean;
					cornerRadius?: number;
					shadow?: number;
			  })
			: {};
	const webcamEnabled = typeof webcam.enabled === "boolean" ? webcam.enabled : false;
	const webcamMirror = typeof webcam.mirror === "boolean" ? webcam.mirror : true;
	const webcamCorner = webcam.corner ?? "bottom-right";
	const webcamSize = typeof webcam.size === "number" ? webcam.size : 40;
	const webcamMargin = typeof webcam.margin === "number" ? webcam.margin : 24;
	const webcamReactToZoom = typeof webcam.reactToZoom === "boolean" ? webcam.reactToZoom : true;
	const webcamCornerRadius = typeof webcam.cornerRadius === "number" ? webcam.cornerRadius : 90;
	const webcamShadow = typeof webcam.shadow === "number" ? webcam.shadow : 0.67;
	const autoCaptionSettings =
		typeof editorState.autoCaptionSettings === "object" && editorState.autoCaptionSettings !== null
			? (editorState.autoCaptionSettings as {
					enabled?: boolean;
					fontSize?: number;
					animationStyle?: AutoCaptionAnimation;
					maxRows?: number;
					backgroundOpacity?: number;
					textColor?: string;
					inactiveTextColor?: string;
					boxRadius?: number;
			  })
			: {};
	const autoCaptions = Array.isArray(editorState.autoCaptions)
		? (editorState.autoCaptions as Array<{ id?: string; text?: string }>)
		: [];
	const connectZooms = typeof editorState.connectZooms === "boolean" ? editorState.connectZooms : true;
	const zoomInDurationMs =
		typeof editorState.zoomInDurationMs === "number" ? editorState.zoomInDurationMs : 1522.575;
	const zoomOutDurationMs =
		typeof editorState.zoomOutDurationMs === "number" ? editorState.zoomOutDurationMs : 1015.05;
	const zoomMotionBlur = typeof editorState.zoomMotionBlur === "number" ? editorState.zoomMotionBlur : 0.35;
	const zoomInOverlapMs = typeof editorState.zoomInOverlapMs === "number" ? editorState.zoomInOverlapMs : 500;
	const connectedZoomGapMs =
		typeof editorState.connectedZoomGapMs === "number" ? editorState.connectedZoomGapMs : 1500;
	const connectedZoomDurationMs =
		typeof editorState.connectedZoomDurationMs === "number"
			? editorState.connectedZoomDurationMs
			: 1000;
	const zoomInEasing = typeof editorState.zoomInEasing === "string" ? editorState.zoomInEasing : "recordly";
	const zoomOutEasing = typeof editorState.zoomOutEasing === "string" ? editorState.zoomOutEasing : "recordly";
	const connectedZoomEasing =
		typeof editorState.connectedZoomEasing === "string" ? editorState.connectedZoomEasing : "glide";
	const captionsEnabled = typeof autoCaptionSettings.enabled === "boolean" ? autoCaptionSettings.enabled : false;
	const captionFontSize = typeof autoCaptionSettings.fontSize === "number" ? autoCaptionSettings.fontSize : 30;
	const captionAnimation = autoCaptionSettings.animationStyle ?? "fade";
	const captionMaxRows = typeof autoCaptionSettings.maxRows === "number" ? autoCaptionSettings.maxRows : 1;
	const captionBackgroundOpacity =
		typeof autoCaptionSettings.backgroundOpacity === "number"
			? autoCaptionSettings.backgroundOpacity
			: 0.9;
	const captionTextColor = typeof autoCaptionSettings.textColor === "string" ? autoCaptionSettings.textColor : "#FFFFFF";
	const captionInactiveTextColor =
		typeof autoCaptionSettings.inactiveTextColor === "string"
			? autoCaptionSettings.inactiveTextColor
			: "#A3A3A3";
	const captionBoxRadius = typeof autoCaptionSettings.boxRadius === "number" ? autoCaptionSettings.boxRadius : 17.5;
	const cursorStyle = typeof editorState.cursorStyle === "string" ? editorState.cursorStyle : "tahoe";
	const cursorSize = typeof editorState.cursorSize === "number" ? editorState.cursorSize : 3;
	const cursorSway = typeof editorState.cursorSway === "number" ? editorState.cursorSway : 0.4;
	const cursorClickEffect =
		typeof editorState.cursorClickEffect === "string" ? editorState.cursorClickEffect : "none";
	const cursorClickEffectColor =
		typeof editorState.cursorClickEffectColor === "string"
			? editorState.cursorClickEffectColor
			: "#2563EB";
	const cursorClickEffectScale =
		typeof editorState.cursorClickEffectScale === "number" ? editorState.cursorClickEffectScale : 1;
	const cursorClickEffectOpacity =
		typeof editorState.cursorClickEffectOpacity === "number" ? editorState.cursorClickEffectOpacity : 1;
	const cursorClickEffectDurationMs =
		typeof editorState.cursorClickEffectDurationMs === "number"
			? editorState.cursorClickEffectDurationMs
			: 600;

	const updatePadding = (value: number) => {
		setProject((current) =>
			updateWebProjectEditorState(current, {
				padding: {
					top: value,
					right: value,
					bottom: value,
					left: value,
					linked: true,
				},
			}),
		);
	};

	const updateCropRegion = (key: "x" | "y" | "width" | "height", value: number) => {
		setProject((current) =>
			updateWebProjectEditorState(current, {
				cropRegion: {
					x: cropRegion.x ?? 0,
					y: cropRegion.y ?? 0,
					width: cropRegion.width ?? 1,
					height: cropRegion.height ?? 1,
					[key]: value,
				},
			}),
		);
	};

	const ensureSampleCaptions = () => {
		setProject((current) =>
			updateWebProjectCaptions(current, {
				autoCaptions:
					autoCaptions.length > 0
						? autoCaptions
						: [
								{
									id: "caption-1",
									startMs: 0,
									endMs: 2400,
									text: "Hello from Recordly Web",
								},
								{
									id: "caption-2",
									startMs: 2400,
									endMs: 4800,
									text: "Captions preview in browser",
								},
						  ],
			}),
		);
	};

	return (
		<div className="flex min-h-screen gap-6 bg-editor-bg p-6 text-foreground">
			<div className="sticky top-0 flex max-h-screen w-[360px] shrink-0 flex-col gap-4 overflow-y-auto rounded-2xl border border-foreground/10 bg-foreground/5 p-4">
				<div className="flex flex-col gap-2 rounded-xl border border-foreground/10 bg-black/20 p-3">
					<label className="text-sm text-foreground/65" htmlFor="web-project-title">
						{sectionLabels.projectTitle}
					</label>
					<input
						id="web-project-title"
						type="text"
						value={projectTitle}
						onChange={(event) => {
							setProject((current) => updateWebProjectTitle(current, event.target.value));
						}}
						className="rounded-xl border border-foreground/15 bg-black/20 px-3 py-2 text-sm outline-none"
					/>
					<p className="text-xs text-foreground/50">{sectionLabels.editorReady}</p>
				</div>
				<div className="grid grid-cols-2 gap-3">
					<input
						ref={importProjectInputRef}
						type="file"
						accept="application/json,.json,.recordly,.openscreen,.xml"
						className="hidden"
						onChange={(event) => {
							const file = event.target.files?.[0];
							if (!file) {
								return;
							}
							void importProject(file).finally(() => {
								event.currentTarget.value = "";
							});
						}}
					/>
					<input
						ref={primaryVideoInputRef}
						type="file"
						accept="video/*"
						className="hidden"
						onChange={(event) => {
							const file = event.target.files?.[0];
							if (!file) {
								return;
							}
							attachPrimaryVideo(file);
							event.currentTarget.value = "";
						}}
					/>
					<input
						ref={webcamVideoInputRef}
						type="file"
						accept="video/*"
						className="hidden"
						onChange={(event) => {
							const file = event.target.files?.[0];
							if (!file) {
								return;
							}
							attachWebcamVideo(file);
							event.currentTarget.value = "";
						}}
					/>
					<button
						type="button"
						onClick={() => importProjectInputRef.current?.click()}
						className="rounded-xl border border-foreground/15 px-4 py-2 text-sm"
					>
						{sectionLabels.importProject}
					</button>
					<button
						type="button"
						onClick={() => primaryVideoInputRef.current?.click()}
						className="rounded-xl border border-foreground/15 px-4 py-2 text-sm"
					>
						{sectionLabels.selectVideo}
					</button>
					<button
						type="button"
						onClick={() => webcamVideoInputRef.current?.click()}
						className="rounded-xl border border-foreground/15 px-4 py-2 text-sm"
					>
						{sectionLabels.selectWebcam}
					</button>
					<button
						type="button"
						onClick={saveProject}
						className="rounded-xl border border-foreground/15 px-4 py-2 text-sm"
					>
						{sectionLabels.saveProject}
					</button>
				</div>
				<div className="rounded-xl border border-foreground/10 bg-black/20 p-3 text-sm">
					<div className="text-foreground/65">Primary video</div>
					<div className="mt-1 font-medium">{primaryVideo?.displayName ?? "Not selected"}</div>
				</div>
				<div className="rounded-xl border border-foreground/10 bg-black/20 p-3 text-sm">
					<div className="text-foreground/65">Webcam video</div>
					<div className="mt-1 font-medium">{webcamVideo?.displayName ?? "Not selected"}</div>
				</div>
				<div className="flex flex-col gap-3 rounded-xl border border-foreground/10 bg-black/20 p-3 text-sm">
					<div className="text-foreground/65">Scene layout</div>
					<label className="flex flex-col gap-2">
						<span className="text-foreground/65">Aspect ratio</span>
						<select
							value={aspectRatio}
							onChange={(event) => {
								setProject((current) =>
									updateWebProjectScene(current, { aspectRatio: event.target.value }),
								);
							}}
							className="rounded-xl border border-foreground/15 bg-editor-bg px-3 py-2 outline-none"
						>
							{ASPECT_RATIOS.map((ratio) => (
								<option key={ratio} value={ratio}>
									{ratio}
								</option>
							))}
						</select>
					</label>
					<label className="flex flex-col gap-2">
						<span className="text-foreground/65">Frame</span>
						<select
							value={frame ?? "none"}
							onChange={(event) => {
								setProject((current) =>
									updateWebProjectScene(current, {
										frame: event.target.value === "none" ? null : event.target.value,
									}),
								);
							}}
							className="rounded-xl border border-foreground/15 bg-editor-bg px-3 py-2 outline-none"
						>
							<option value="none">None</option>
							<option value="recordly.frames/browser-dark">Browser dark</option>
							<option value="recordly.frames/browser-light">Browser light</option>
						</select>
					</label>
					<label className="flex items-center justify-between gap-3">
						<span className="text-foreground/65">Connect zooms</span>
						<input
							type="checkbox"
							checked={connectZooms}
							onChange={(event) => {
								setProject((current) =>
									updateWebProjectZoomMotion(current, {
										connectZooms: event.target.checked,
									}),
								);
							}}
						/>
					</label>
					<label className="flex flex-col gap-2">
						<span className="text-foreground/65">Zoom in duration</span>
						<input
							type="range"
							min="60"
							max="2500"
							step="10"
							value={zoomInDurationMs}
							onChange={(event) => {
								setProject((current) =>
									updateWebProjectZoomMotion(current, {
										zoomInDurationMs: Number(event.target.value),
									}),
								);
							}}
						/>
						<span className="text-xs text-foreground/50">{Math.round(zoomInDurationMs)} ms</span>
					</label>
					<label className="flex flex-col gap-2">
						<span className="text-foreground/65">Zoom out duration</span>
						<input
							type="range"
							min="60"
							max="2500"
							step="10"
							value={zoomOutDurationMs}
							onChange={(event) => {
								setProject((current) =>
									updateWebProjectZoomMotion(current, {
										zoomOutDurationMs: Number(event.target.value),
									}),
								);
							}}
						/>
						<span className="text-xs text-foreground/50">{Math.round(zoomOutDurationMs)} ms</span>
					</label>
					<label className="flex flex-col gap-2">
						<span className="text-foreground/65">Zoom motion blur</span>
						<input
							type="range"
							min="0"
							max="2"
							step="0.05"
							value={zoomMotionBlur}
							onChange={(event) => {
								setProject((current) =>
									updateWebProjectEditorState(current, {
										zoomMotionBlur: Number(event.target.value),
									}),
								);
							}}
						/>
						<span className="text-xs text-foreground/50">{zoomMotionBlur.toFixed(2)}</span>
					</label>
					<label className="flex flex-col gap-2">
						<span className="text-foreground/65">Zoom in overlap</span>
						<input
							type="range"
							min="0"
							max="1500"
							step="10"
							value={zoomInOverlapMs}
							onChange={(event) => {
								setProject((current) =>
									updateWebProjectZoomTransitions(current, {
										zoomInOverlapMs: Number(event.target.value),
									}),
								);
							}}
						/>
						<span className="text-xs text-foreground/50">{Math.round(zoomInOverlapMs)} ms</span>
					</label>
					<label className="flex flex-col gap-2">
						<span className="text-foreground/65">Connected gap</span>
						<input
							type="range"
							min="0"
							max="3000"
							step="10"
							value={connectedZoomGapMs}
							onChange={(event) => {
								setProject((current) =>
									updateWebProjectZoomTransitions(current, {
										connectedZoomGapMs: Number(event.target.value),
									}),
								);
							}}
						/>
						<span className="text-xs text-foreground/50">{Math.round(connectedZoomGapMs)} ms</span>
					</label>
					<label className="flex flex-col gap-2">
						<span className="text-foreground/65">Connected duration</span>
						<input
							type="range"
							min="60"
							max="2500"
							step="10"
							value={connectedZoomDurationMs}
							onChange={(event) => {
								setProject((current) =>
									updateWebProjectZoomTransitions(current, {
										connectedZoomDurationMs: Number(event.target.value),
									}),
								);
							}}
						/>
						<span className="text-xs text-foreground/50">{Math.round(connectedZoomDurationMs)} ms</span>
					</label>
					<label className="flex flex-col gap-2">
						<span className="text-foreground/65">Zoom in easing</span>
						<select
							value={zoomInEasing}
							onChange={(event) => {
								setProject((current) =>
									updateWebProjectZoomTransitions(current, {
										zoomInEasing: event.target.value,
									}),
								);
							}}
							className="rounded-xl border border-foreground/15 bg-editor-bg px-3 py-2 outline-none"
						>
							<option value="recordly">Recordly</option>
							<option value="glide">Glide</option>
							<option value="smooth">Smooth</option>
							<option value="snappy">Snappy</option>
							<option value="linear">Linear</option>
						</select>
					</label>
					<label className="flex flex-col gap-2">
						<span className="text-foreground/65">Zoom out easing</span>
						<select
							value={zoomOutEasing}
							onChange={(event) => {
								setProject((current) =>
									updateWebProjectZoomTransitions(current, {
										zoomOutEasing: event.target.value,
									}),
								);
							}}
							className="rounded-xl border border-foreground/15 bg-editor-bg px-3 py-2 outline-none"
						>
							<option value="recordly">Recordly</option>
							<option value="glide">Glide</option>
							<option value="smooth">Smooth</option>
							<option value="snappy">Snappy</option>
							<option value="linear">Linear</option>
						</select>
					</label>
					<label className="flex flex-col gap-2">
						<span className="text-foreground/65">Connected easing</span>
						<select
							value={connectedZoomEasing}
							onChange={(event) => {
								setProject((current) =>
									updateWebProjectZoomTransitions(current, {
										connectedZoomEasing: event.target.value,
									}),
								);
							}}
							className="rounded-xl border border-foreground/15 bg-editor-bg px-3 py-2 outline-none"
						>
							<option value="recordly">Recordly</option>
							<option value="glide">Glide</option>
							<option value="smooth">Smooth</option>
							<option value="snappy">Snappy</option>
							<option value="linear">Linear</option>
						</select>
					</label>
				</div>
				<div className="flex flex-col gap-3 rounded-xl border border-foreground/10 bg-black/20 p-3 text-sm">
					<label className="flex flex-col gap-2">
						<span className="text-foreground/65">Wallpaper</span>
						<select
							value={wallpaper}
							onChange={(event) => {
								setProject((current) =>
									updateWebProjectEditorState(current, { wallpaper: event.target.value }),
								);
							}}
							className="rounded-xl border border-foreground/15 bg-editor-bg px-3 py-2 outline-none"
						>
							<option value="/wallpapers/tahoe-light.jpg">Tahoe Light</option>
							<option value="/wallpapers/tahoe-dark.jpg">Tahoe Dark</option>
						</select>
					</label>
					<label className="flex flex-col gap-2">
						<span className="text-foreground/65">Background blur</span>
						<input
							type="range"
							min="0"
							max="8"
							step="1"
							value={backgroundBlur}
							onChange={(event) => {
								setProject((current) =>
									updateWebProjectEditorState(current, {
										backgroundBlur: Number(event.target.value),
									}),
								);
							}}
						/>
						<span className="text-xs text-foreground/50">{backgroundBlur}</span>
					</label>
					<label className="flex flex-col gap-2">
						<span className="text-foreground/65">Shadow intensity</span>
						<input
							type="range"
							min="0"
							max="1"
							step="0.05"
							value={shadowIntensity}
							onChange={(event) => {
								setProject((current) =>
									updateWebProjectEditorState(current, {
										shadowIntensity: Number(event.target.value),
									}),
								);
							}}
						/>
						<span className="text-xs text-foreground/50">{shadowIntensity.toFixed(2)}</span>
					</label>
					<label className="flex flex-col gap-2">
						<span className="text-foreground/65">Border radius</span>
						<input
							type="range"
							min="0"
							max="40"
							step="1"
							value={borderRadius}
							onChange={(event) => {
								setProject((current) =>
									updateWebProjectEditorState(current, {
										borderRadius: Number(event.target.value),
									}),
								);
							}}
						/>
						<span className="text-xs text-foreground/50">{borderRadius}</span>
					</label>
					<label className="flex flex-col gap-2">
						<span className="text-foreground/65">Padding</span>
						<input
							type="range"
							min="0"
							max="80"
							step="1"
							value={padding.top ?? 20}
							onChange={(event) => updatePadding(Number(event.target.value))}
						/>
						<span className="text-xs text-foreground/50">{padding.top ?? 20}</span>
					</label>
					<label className="flex items-center justify-between gap-3">
						<span className="text-foreground/65">Show cursor</span>
						<input
							type="checkbox"
							checked={showCursor}
							onChange={(event) => {
								setProject((current) =>
									updateWebProjectEditorState(current, { showCursor: event.target.checked }),
								);
							}}
						/>
					</label>
				</div>
				<div className="flex flex-col gap-3 rounded-xl border border-foreground/10 bg-black/20 p-3 text-sm">
					<div className="text-foreground/65">Webcam</div>
					<label className="flex items-center justify-between gap-3">
						<span className="text-foreground/65">Enable webcam</span>
						<input
							type="checkbox"
							checked={webcamEnabled}
							onChange={(event) => {
								setProject((current) =>
									updateWebProjectWebcam(current, { enabled: event.target.checked }),
								);
							}}
						/>
					</label>
					<label className="flex items-center justify-between gap-3">
						<span className="text-foreground/65">Mirror</span>
						<input
							type="checkbox"
							checked={webcamMirror}
							onChange={(event) => {
								setProject((current) =>
									updateWebProjectWebcam(current, { mirror: event.target.checked }),
								);
							}}
						/>
					</label>
					<label className="flex flex-col gap-2">
						<span className="text-foreground/65">Corner</span>
						<select
							value={webcamCorner}
							onChange={(event) => {
								setProject((current) =>
									updateWebProjectWebcam(current, {
										corner: event.target.value as WebcamCorner,
										positionPreset: event.target.value,
									}),
								);
							}}
							className="rounded-xl border border-foreground/15 bg-editor-bg px-3 py-2 outline-none"
						>
							<option value="top-left">Top left</option>
							<option value="top-right">Top right</option>
							<option value="bottom-left">Bottom left</option>
							<option value="bottom-right">Bottom right</option>
						</select>
					</label>
					<label className="flex flex-col gap-2">
						<span className="text-foreground/65">Size</span>
						<input
							type="range"
							min="15"
							max="60"
							step="1"
							value={webcamSize}
							onChange={(event) => {
								setProject((current) =>
									updateWebProjectWebcam(current, { size: Number(event.target.value) }),
								);
							}}
						/>
						<span className="text-xs text-foreground/50">{webcamSize}</span>
					</label>
					<label className="flex flex-col gap-2">
						<span className="text-foreground/65">Margin</span>
						<input
							type="range"
							min="0"
							max="64"
							step="1"
							value={webcamMargin}
							onChange={(event) => {
								setProject((current) =>
									updateWebProjectWebcam(current, { margin: Number(event.target.value) }),
								);
							}}
						/>
						<span className="text-xs text-foreground/50">{webcamMargin}</span>
					</label>
					<label className="flex items-center justify-between gap-3">
						<span className="text-foreground/65">React to zoom</span>
						<input
							type="checkbox"
							checked={webcamReactToZoom}
							onChange={(event) => {
								setProject((current) =>
									updateWebProjectWebcam(current, { reactToZoom: event.target.checked }),
								);
							}}
						/>
					</label>
					<label className="flex flex-col gap-2">
						<span className="text-foreground/65">Corner radius</span>
						<input
							type="range"
							min="0"
							max="160"
							step="1"
							value={webcamCornerRadius}
							onChange={(event) => {
								setProject((current) =>
									updateWebProjectWebcam(current, { cornerRadius: Number(event.target.value) }),
								);
							}}
						/>
						<span className="text-xs text-foreground/50">{Math.round(webcamCornerRadius)}</span>
					</label>
					<label className="flex flex-col gap-2">
						<span className="text-foreground/65">Webcam shadow</span>
						<input
							type="range"
							min="0"
							max="1"
							step="0.05"
							value={webcamShadow}
							onChange={(event) => {
								setProject((current) =>
									updateWebProjectWebcam(current, { shadow: Number(event.target.value) }),
								);
							}}
						/>
						<span className="text-xs text-foreground/50">{webcamShadow.toFixed(2)}</span>
					</label>
				</div>
				<div className="flex flex-col gap-3 rounded-xl border border-foreground/10 bg-black/20 p-3 text-sm">
					<div className="text-foreground/65">Captions</div>
					<label className="flex items-center justify-between gap-3">
						<span className="text-foreground/65">Enable captions</span>
						<input
							type="checkbox"
							checked={captionsEnabled}
							onChange={(event) => {
								setProject((current) =>
									updateWebProjectCaptions(current, {
										autoCaptionSettings: { enabled: event.target.checked },
									}),
								);
								if (event.target.checked) {
									ensureSampleCaptions();
								}
							}}
						/>
					</label>
					<div className="text-xs text-foreground/50">Sample cues: {autoCaptions.length}</div>
					<button
						type="button"
						onClick={ensureSampleCaptions}
						className="rounded-xl border border-foreground/15 px-4 py-2 text-sm"
					>
						Load sample captions
					</button>
					<label className="flex flex-col gap-2">
						<span className="text-foreground/65">Animation</span>
						<select
							value={captionAnimation}
							onChange={(event) => {
								setProject((current) =>
									updateWebProjectCaptions(current, {
										autoCaptionSettings: {
											animationStyle: event.target.value as AutoCaptionAnimation,
										},
									}),
								);
							}}
							className="rounded-xl border border-foreground/15 bg-editor-bg px-3 py-2 outline-none"
						>
							<option value="none">None</option>
							<option value="fade">Fade</option>
							<option value="rise">Rise</option>
							<option value="pop">Pop</option>
						</select>
					</label>
					<label className="flex flex-col gap-2">
						<span className="text-foreground/65">Font size</span>
						<input
							type="range"
							min="18"
							max="56"
							step="1"
							value={captionFontSize}
							onChange={(event) => {
								setProject((current) =>
									updateWebProjectCaptions(current, {
										autoCaptionSettings: { fontSize: Number(event.target.value) },
									}),
								);
							}}
						/>
						<span className="text-xs text-foreground/50">{captionFontSize}</span>
					</label>
					<label className="flex flex-col gap-2">
						<span className="text-foreground/65">Max rows</span>
						<input
							type="range"
							min="1"
							max="3"
							step="1"
							value={captionMaxRows}
							onChange={(event) => {
								setProject((current) =>
									updateWebProjectCaptions(current, {
										autoCaptionSettings: { maxRows: Number(event.target.value) },
									}),
								);
							}}
						/>
						<span className="text-xs text-foreground/50">{captionMaxRows}</span>
					</label>
					<label className="flex flex-col gap-2">
						<span className="text-foreground/65">Background opacity</span>
						<input
							type="range"
							min="0"
							max="1"
							step="0.05"
							value={captionBackgroundOpacity}
							onChange={(event) => {
								setProject((current) =>
									updateWebProjectCaptions(current, {
										autoCaptionSettings: {
											backgroundOpacity: Number(event.target.value),
										},
									}),
								);
							}}
						/>
						<span className="text-xs text-foreground/50">{captionBackgroundOpacity.toFixed(2)}</span>
					</label>
					<label className="flex flex-col gap-2">
						<span className="text-foreground/65">Text color</span>
						<input
							type="color"
							value={captionTextColor}
							onChange={(event) => {
								setProject((current) =>
									updateWebProjectCaptions(current, {
										autoCaptionSettings: { textColor: event.target.value.toUpperCase() },
									}),
								);
							}}
							className="h-10 w-full rounded-xl border border-foreground/15 bg-editor-bg px-2 py-1"
						/>
					</label>
					<label className="flex flex-col gap-2">
						<span className="text-foreground/65">Inactive text color</span>
						<input
							type="color"
							value={captionInactiveTextColor}
							onChange={(event) => {
								setProject((current) =>
									updateWebProjectCaptions(current, {
										autoCaptionSettings: {
											inactiveTextColor: event.target.value.toUpperCase(),
										},
									}),
								);
							}}
							className="h-10 w-full rounded-xl border border-foreground/15 bg-editor-bg px-2 py-1"
						/>
					</label>
					<label className="flex flex-col gap-2">
						<span className="text-foreground/65">Caption box radius</span>
						<input
							type="range"
							min="0"
							max="40"
							step="0.5"
							value={captionBoxRadius}
							onChange={(event) => {
								setProject((current) =>
									updateWebProjectCaptions(current, {
										autoCaptionSettings: { boxRadius: Number(event.target.value) },
									}),
								);
							}}
						/>
						<span className="text-xs text-foreground/50">{captionBoxRadius.toFixed(1)}</span>
					</label>
				</div>
				<div className="flex flex-col gap-3 rounded-xl border border-foreground/10 bg-black/20 p-3 text-sm">
					<div className="text-foreground/65">Cursor</div>
					<label className="flex flex-col gap-2">
						<span className="text-foreground/65">Style</span>
						<select
							value={cursorStyle}
							onChange={(event) => {
								setProject((current) =>
									updateWebProjectEditorState(current, {
										cursorStyle: event.target.value as CursorStyle,
									}),
								);
							}}
							className="rounded-xl border border-foreground/15 bg-editor-bg px-3 py-2 outline-none"
						>
							<option value="tahoe">Tahoe</option>
							<option value="macos">macOS</option>
							<option value="tahoe-inverted">Tahoe Inverted</option>
							<option value="dot">Dot</option>
							<option value="figma">Figma</option>
						</select>
					</label>
					<label className="flex flex-col gap-2">
						<span className="text-foreground/65">Cursor size</span>
						<input
							type="range"
							min="0.5"
							max="10"
							step="0.1"
							value={cursorSize}
							onChange={(event) => {
								setProject((current) =>
									updateWebProjectEditorState(current, {
										cursorSize: Number(event.target.value),
									}),
								);
							}}
						/>
						<span className="text-xs text-foreground/50">{cursorSize.toFixed(1)}</span>
					</label>
					<label className="flex flex-col gap-2">
						<span className="text-foreground/65">Cursor sway</span>
						<input
							type="range"
							min="0"
							max="2"
							step="0.05"
							value={cursorSway}
							onChange={(event) => {
								setProject((current) =>
									updateWebProjectEditorState(current, {
										cursorSway: Number(event.target.value),
									}),
								);
							}}
						/>
						<span className="text-xs text-foreground/50">{cursorSway.toFixed(2)}</span>
					</label>
					<label className="flex flex-col gap-2">
						<span className="text-foreground/65">Click effect</span>
						<select
							value={cursorClickEffect}
							onChange={(event) => {
								setProject((current) =>
									updateWebProjectEditorState(current, {
										cursorClickEffect: event.target.value as CursorClickEffectStyle,
									}),
								);
							}}
							className="rounded-xl border border-foreground/15 bg-editor-bg px-3 py-2 outline-none"
						>
							<option value="none">None</option>
							<option value="spotlight">Spotlight</option>
							<option value="ripple">Ripple</option>
							<option value="echo">Echo</option>
						</select>
					</label>
					<label className="flex flex-col gap-2">
						<span className="text-foreground/65">Click color</span>
						<input
							type="color"
							value={cursorClickEffectColor}
							onChange={(event) => {
								setProject((current) =>
									updateWebProjectEditorState(current, {
										cursorClickEffectColor: event.target.value.toUpperCase(),
									}),
								);
							}}
							className="h-10 w-full rounded-xl border border-foreground/15 bg-editor-bg px-2 py-1"
						/>
					</label>
					<label className="flex flex-col gap-2">
						<span className="text-foreground/65">Click scale</span>
						<input
							type="range"
							min="0.5"
							max="2"
							step="0.05"
							value={cursorClickEffectScale}
							onChange={(event) => {
								setProject((current) =>
									updateWebProjectEditorState(current, {
										cursorClickEffectScale: Number(event.target.value),
									}),
								);
							}}
						/>
						<span className="text-xs text-foreground/50">{cursorClickEffectScale.toFixed(2)}</span>
					</label>
					<label className="flex flex-col gap-2">
						<span className="text-foreground/65">Click opacity</span>
						<input
							type="range"
							min="0"
							max="1"
							step="0.05"
							value={cursorClickEffectOpacity}
							onChange={(event) => {
								setProject((current) =>
									updateWebProjectEditorState(current, {
										cursorClickEffectOpacity: Number(event.target.value),
									}),
								);
							}}
						/>
						<span className="text-xs text-foreground/50">{cursorClickEffectOpacity.toFixed(2)}</span>
					</label>
					<label className="flex flex-col gap-2">
						<span className="text-foreground/65">Click duration</span>
						<input
							type="range"
							min="120"
							max="1200"
							step="10"
							value={cursorClickEffectDurationMs}
							onChange={(event) => {
								setProject((current) =>
									updateWebProjectEditorState(current, {
										cursorClickEffectDurationMs: Number(event.target.value),
									}),
								);
							}}
						/>
						<span className="text-xs text-foreground/50">{Math.round(cursorClickEffectDurationMs)} ms</span>
					</label>
				</div>
				<div className="flex flex-col gap-3 rounded-xl border border-foreground/10 bg-black/20 p-3 text-sm">
					<div className="text-foreground/65">Crop</div>
					<label className="flex flex-col gap-2">
						<span>X ({(cropRegion.x ?? 0).toFixed(2)})</span>
						<input
							type="range"
							min="0"
							max="0.5"
							step="0.01"
							value={cropRegion.x ?? 0}
							onChange={(event) => updateCropRegion("x", Number(event.target.value))}
						/>
					</label>
					<label className="flex flex-col gap-2">
						<span>Y ({(cropRegion.y ?? 0).toFixed(2)})</span>
						<input
							type="range"
							min="0"
							max="0.5"
							step="0.01"
							value={cropRegion.y ?? 0}
							onChange={(event) => updateCropRegion("y", Number(event.target.value))}
						/>
					</label>
					<label className="flex flex-col gap-2">
						<span>Width ({(cropRegion.width ?? 1).toFixed(2)})</span>
						<input
							type="range"
							min="0.3"
							max="1"
							step="0.01"
							value={cropRegion.width ?? 1}
							onChange={(event) => updateCropRegion("width", Number(event.target.value))}
						/>
					</label>
					<label className="flex flex-col gap-2">
						<span>Height ({(cropRegion.height ?? 1).toFixed(2)})</span>
						<input
							type="range"
							min="0.3"
							max="1"
							step="0.01"
							value={cropRegion.height ?? 1}
							onChange={(event) => updateCropRegion("height", Number(event.target.value))}
						/>
					</label>
				</div>
			</div>
			<div className="min-w-0 flex-1">
				<WebViewerPage
					key={viewerProjectText}
					initialProjectJson={viewerProjectText}
					initialBindings={bindings}
				/>
			</div>
		</div>
	);
}
