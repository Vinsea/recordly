import {
	DEFAULT_AUTO_CAPTION_SETTINGS,
	DEFAULT_CROP_REGION,
	DEFAULT_CURSOR_CLICK_BOUNCE,
	DEFAULT_CURSOR_CLICK_BOUNCE_DURATION,
	DEFAULT_CURSOR_CLICK_EFFECT,
	DEFAULT_CURSOR_CLICK_EFFECT_COLOR,
	DEFAULT_CURSOR_CLICK_EFFECT_DURATION_MS,
	DEFAULT_CURSOR_CLICK_EFFECT_OPACITY,
	DEFAULT_CURSOR_CLICK_EFFECT_SCALE,
	DEFAULT_CURSOR_MOTION_BLUR,
	DEFAULT_CURSOR_SIZE,
	DEFAULT_CURSOR_SMOOTHING,
	DEFAULT_CURSOR_STYLE,
	DEFAULT_CURSOR_SWAY,
	DEFAULT_PADDING,
	DEFAULT_WEBCAM_OVERLAY,
	DEFAULT_ZOOM_MOTION_BLUR,
	DEFAULT_ZOOM_MOTION_BLUR_TUNING,
	type AutoCaptionSettings,
	type CropRegion,
	type Padding,
	type WebcamOverlaySettings,
	type ZoomRegion,
} from "@/components/video-editor/types";
import type { AspectRatio } from "@/utils/aspectRatioUtils";

export interface WebPreviewDefaults {
	aspectRatio: AspectRatio;
	wallpaper?: string;
	zoomRegions: ZoomRegion[];
	padding: Padding;
	cropRegion: CropRegion;
	webcam: WebcamOverlaySettings;
	autoCaptionSettings: AutoCaptionSettings;
	cursorStyle: string;
	cursorSize: number;
	cursorSmoothing: number;
	cursorMotionBlur: number;
	cursorClickEffect: string;
	cursorClickEffectColor: string;
	cursorClickEffectScale: number;
	cursorClickEffectOpacity: number;
	cursorClickEffectDurationMs: number;
	cursorClickBounce: number;
	cursorClickBounceDuration: number;
	cursorSway: number;
	zoomMotionBlur: number;
	zoomMotionBlurTuning: typeof DEFAULT_ZOOM_MOTION_BLUR_TUNING;
}

export function createWebPreviewDefaults(): WebPreviewDefaults {
	return {
		aspectRatio: "16:9",
		wallpaper: undefined,
		zoomRegions: [],
		padding: DEFAULT_PADDING,
		cropRegion: DEFAULT_CROP_REGION,
		webcam: DEFAULT_WEBCAM_OVERLAY,
		autoCaptionSettings: DEFAULT_AUTO_CAPTION_SETTINGS,
		cursorStyle: DEFAULT_CURSOR_STYLE,
		cursorSize: DEFAULT_CURSOR_SIZE,
		cursorSmoothing: DEFAULT_CURSOR_SMOOTHING,
		cursorMotionBlur: DEFAULT_CURSOR_MOTION_BLUR,
		cursorClickEffect: DEFAULT_CURSOR_CLICK_EFFECT,
		cursorClickEffectColor: DEFAULT_CURSOR_CLICK_EFFECT_COLOR,
		cursorClickEffectScale: DEFAULT_CURSOR_CLICK_EFFECT_SCALE,
		cursorClickEffectOpacity: DEFAULT_CURSOR_CLICK_EFFECT_OPACITY,
		cursorClickEffectDurationMs: DEFAULT_CURSOR_CLICK_EFFECT_DURATION_MS,
		cursorClickBounce: DEFAULT_CURSOR_CLICK_BOUNCE,
		cursorClickBounceDuration: DEFAULT_CURSOR_CLICK_BOUNCE_DURATION,
		cursorSway: DEFAULT_CURSOR_SWAY,
		zoomMotionBlur: DEFAULT_ZOOM_MOTION_BLUR,
		zoomMotionBlurTuning: DEFAULT_ZOOM_MOTION_BLUR_TUNING,
	};
}
