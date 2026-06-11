# Caption Track Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Convert to Track" button in the captions panel that turns `CaptionCue[]` into editable `CaptionRegion[]` clips on the timeline, each with independent style, selectable in the properties panel.

**Architecture:** New `CaptionRegion` type mirrors `AnnotationRegion` — added to `EditorHistorySnapshot` and `buildPersistedEditorState`. Timeline model adds a `"row-caption-0"` row via new helpers in `rows.ts`. Export pipeline receives `captionRegions` and routes them through `renderCaptions` the same way `autoCaptions` does now, but per-clip. The existing `autoCaptionSettings.enabled` flag is toggled off on conversion.

**Tech Stack:** TypeScript, React 18, dnd-timeline, Biome (linting/formatting), Vitest

---

## File Map

| File | Change |
|---|---|
| `src/components/video-editor/types.ts` | Add `CaptionRegion`, `CaptionRegionStyle`, `DEFAULT_CAPTION_REGION_STYLE` |
| `src/components/video-editor/editorHistory.ts` | Add `captionRegions` + `selectedCaptionRegionId` to `EditorHistorySnapshot` |
| `src/components/video-editor/timeline/core/constants.ts` | Add `CAPTION_ROW_ID`, `CAPTION_ROW_PREFIX` |
| `src/components/video-editor/timeline/core/rows.ts` | Add `getCaptionTrackRowId`, `isCaptionTrackRowId`, `getCaptionTrackIndex` |
| `src/components/video-editor/timeline/model/timelineModel.ts` | Add `captionRegions` param to `buildTimelineItems` |
| `src/components/video-editor/timeline/components/viewport/TimelineCanvas.tsx` | Add `captionRegions`, `selectedCaptionRegionId`, `onSelectCaptionRegion` props; render caption items |
| `src/components/video-editor/timeline/TimelineEditor.tsx` | Thread caption props through |
| `src/components/video-editor/CaptionRegionSettingsPanel.tsx` | New file: inspector for a single `CaptionRegion` |
| `src/components/video-editor/SettingsPanel.tsx` | Add "Convert to Track" button; render `CaptionRegionSettingsPanel` when a caption clip is selected |
| `src/components/video-editor/VideoEditor.tsx` | Add caption region state; wire timeline + settings panel props; add convert handler |
| `src/components/video-editor/VideoPlayback.tsx` | Render caption regions on playback canvas |
| `src/lib/exporter/frameRenderer.ts` | Pass `captionRegions` and render per-clip captions |
| `src/lib/exporter/modernFrameRenderer.ts` | Same |
| `src/lib/exporter/gifExporter.ts` | Same |
| `src/lib/exporter/modernVideoExporter.ts` | Thread `captionRegions` + update native-bypass check |
| `src/lib/exporter/videoExporter.ts` | Thread `captionRegions` |
| `src/i18n/locales/en/settings.json` | Add `captions.convertToTrack`, `captions.applyToAll` keys |
| `src/i18n/locales/zh-CN/settings.json` | Same (Chinese) |

---

## Task 1: Add `CaptionRegion` type

**Files:**
- Modify: `src/components/video-editor/types.ts`

- [ ] **Step 1: Add types after `DEFAULT_AUTO_CAPTION_SETTINGS`**

In `src/components/video-editor/types.ts`, after the `DEFAULT_AUTO_CAPTION_SETTINGS` const (line ~582), add:

```typescript
export interface CaptionRegionStyle {
	fontFamily: string;
	fontSize: number;
	textColor: string;
	inactiveTextColor: string;
	backgroundOpacity: number;
	boxRadius: number;
	bottomOffset: number;
	maxWidth: number;
	animationStyle: AutoCaptionAnimation;
	textStrokeWidth: number;
	textStrokeColor: string;
}

export const DEFAULT_CAPTION_REGION_STYLE: CaptionRegionStyle = {
	fontFamily: getDefaultCaptionFontFamily(),
	fontSize: 30,
	textColor: "#FFFFFF",
	inactiveTextColor: "#A3A3A3",
	backgroundOpacity: 0.9,
	boxRadius: 17.5,
	bottomOffset: 3,
	maxWidth: 62,
	animationStyle: "fade",
	textStrokeWidth: 0,
	textStrokeColor: "#000000",
};

export interface CaptionRegion {
	id: string;
	startMs: number;
	endMs: number;
	text: string;
	words?: CaptionCueWord[];
	style: CaptionRegionStyle;
}
```

- [ ] **Step 2: Run linter to catch any issues**

```bash
npm run lint
```

Expected: no errors related to the new types.

- [ ] **Step 3: Commit**

```bash
git add src/components/video-editor/types.ts
git commit -m "feat(captions): add CaptionRegion and CaptionRegionStyle types"
```

---

## Task 2: Add timeline row constants and helpers

**Files:**
- Modify: `src/components/video-editor/timeline/core/constants.ts`
- Modify: `src/components/video-editor/timeline/core/rows.ts`

- [ ] **Step 1: Write failing test for caption row helpers**

Create `src/components/video-editor/timeline/core/rows.caption.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
	getCaptionTrackRowId,
	getCaptionTrackIndex,
	isCaptionTrackRowId,
} from "./rows";

describe("caption row helpers", () => {
	it("getCaptionTrackRowId returns row-caption-0 for index 0", () => {
		expect(getCaptionTrackRowId(0)).toBe("row-caption-0");
	});

	it("isCaptionTrackRowId returns true for row-caption-0", () => {
		expect(isCaptionTrackRowId("row-caption-0")).toBe(true);
	});

	it("isCaptionTrackRowId returns false for row-annotation-0", () => {
		expect(isCaptionTrackRowId("row-annotation-0")).toBe(false);
	});

	it("getCaptionTrackIndex returns 0 for row-caption-0", () => {
		expect(getCaptionTrackIndex("row-caption-0")).toBe(0);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/components/video-editor/timeline/core/rows.caption.test.ts
```

Expected: FAIL with "getCaptionTrackRowId is not a function" (not exported yet).

- [ ] **Step 3: Add constants**

In `src/components/video-editor/timeline/core/constants.ts`, after `AUDIO_ROW_PREFIX`:

```typescript
export const CAPTION_ROW_ID = "row-caption";
export const CAPTION_ROW_PREFIX = `${CAPTION_ROW_ID}-`;
```

- [ ] **Step 4: Add row helpers**

In `src/components/video-editor/timeline/core/rows.ts`, update the imports at the top:

```typescript
import {
	ANNOTATION_ROW_ID,
	ANNOTATION_ROW_PREFIX,
	AUDIO_ROW_ID,
	AUDIO_ROW_PREFIX,
	CAPTION_ROW_ID,
	CAPTION_ROW_PREFIX,
} from "./constants";
```

Then append at the end of the file:

```typescript
export function getCaptionTrackRowId(trackIndex: number) {
	return `${CAPTION_ROW_PREFIX}${Math.max(0, Math.floor(trackIndex))}`;
}

export function isCaptionTrackRowId(rowId: string) {
	return rowId === CAPTION_ROW_ID || rowId.startsWith(CAPTION_ROW_PREFIX);
}

export function getCaptionTrackIndex(rowId: string) {
	if (rowId === CAPTION_ROW_ID) {
		return 0;
	}
	const parsed = Number.parseInt(rowId.slice(CAPTION_ROW_PREFIX.length), 10);
	return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run src/components/video-editor/timeline/core/rows.caption.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/video-editor/timeline/core/constants.ts \
        src/components/video-editor/timeline/core/rows.ts \
        src/components/video-editor/timeline/core/rows.caption.test.ts
git commit -m "feat(captions): add caption timeline row constants and helpers"
```

---

## Task 3: Update history snapshot and timeline model

**Files:**
- Modify: `src/components/video-editor/editorHistory.ts`
- Modify: `src/components/video-editor/timeline/model/timelineModel.ts`

- [ ] **Step 1: Write failing test for timeline model**

Create `src/components/video-editor/timeline/model/timelineModel.caption.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { buildTimelineItems } from "./timelineModel";
import type { CaptionRegion } from "@/components/video-editor/types";
import { DEFAULT_CAPTION_REGION_STYLE } from "@/components/video-editor/types";

const region: CaptionRegion = {
	id: "cap-1",
	startMs: 0,
	endMs: 2000,
	text: "Hello world",
	style: DEFAULT_CAPTION_REGION_STYLE,
};

describe("buildTimelineItems with captionRegions", () => {
	it("produces a timeline item with rowId row-caption-0", () => {
		const items = buildTimelineItems({
			zoomRegions: [],
			clipRegions: [],
			annotationRegions: [],
			audioRegions: [],
			captionRegions: [region],
		});
		const captionItem = items.find((i) => i.id === "cap-1");
		expect(captionItem).toBeDefined();
		expect(captionItem?.rowId).toBe("row-caption-0");
		expect(captionItem?.variant).toBe("caption");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/components/video-editor/timeline/model/timelineModel.caption.test.ts
```

Expected: FAIL — `captionRegions` not a parameter of `buildTimelineItems`.

- [ ] **Step 3: Update `EditorHistorySnapshot`**

In `src/components/video-editor/editorHistory.ts`, update the imports:

```typescript
import {
	type AnnotationRegion,
	type AudioRegion,
	type CaptionCue,
	type CaptionRegion,
	type ClipRegion,
	type SpeedRegion,
	type ZoomRegion,
} from "./types";
```

Add fields to `EditorHistorySnapshot`:

```typescript
export type EditorHistorySnapshot = {
	zoomRegions: ZoomRegion[];
	clipRegions: ClipRegion[];
	speedRegions: SpeedRegion[];
	annotationRegions: AnnotationRegion[];
	audioRegions: AudioRegion[];
	autoCaptions: CaptionCue[];
	captionRegions: CaptionRegion[];          // NEW
	selectedZoomId: string | null;
	selectedClipId: string | null;
	selectedAnnotationId: string | null;
	selectedAudioId: string | null;
	selectedCaptionRegionId: string | null;   // NEW
};
```

- [ ] **Step 4: Update `buildTimelineItems` in `timelineModel.ts`**

In `src/components/video-editor/timeline/model/timelineModel.ts`, update imports at top:

```typescript
import {
	getCaptionTrackRowId,
	getAnnotationTrackRowId,
	getAudioTrackRowId,
} from "../core/rows";
```

Update the function signature and add caption items:

```typescript
export function buildTimelineItems(params: {
	zoomRegions: ZoomRegion[];
	clipRegions: ClipRegion[];
	annotationRegions: AnnotationRegion[];
	audioRegions: AudioRegion[];
	captionRegions?: CaptionRegion[];
}): TimelineRenderItem[] {
	const { zoomRegions, clipRegions, annotationRegions, audioRegions, captionRegions = [] } = params;

	// ... existing zoom, clip, annotation, audio arrays unchanged ...

	const captions: TimelineRenderItem[] = captionRegions.map((region) => ({
		id: region.id,
		rowId: getCaptionTrackRowId(0),
		span: { start: region.startMs, end: region.endMs },
		label: region.text.length > 20 ? `${region.text.slice(0, 20)}…` : region.text,
		variant: "caption" as const,
	}));

	return [...zooms, ...clips, ...annotations, ...audios, ...captions];
}
```

Also add the import for `CaptionRegion` at the top of the file:

```typescript
import type { AnnotationRegion, AudioRegion, CaptionRegion, ClipRegion, ZoomRegion } from "@/components/video-editor/types";
```

- [ ] **Step 5: Add `"caption"` variant to `TimelineRenderItem`**

Find the `TimelineRenderItem` type in `src/components/video-editor/timeline/core/timelineTypes.ts` and add `"caption"` to the variant union:

```typescript
variant?: "zoom" | "trim" | "clip" | "annotation" | "speed" | "audio" | "caption";
```

Also add `"caption"` to `Item.tsx` variant type (line ~38):
```typescript
variant?: "zoom" | "trim" | "clip" | "annotation" | "speed" | "audio" | "caption";
```

- [ ] **Step 6: Run test to verify it passes**

```bash
npx vitest run src/components/video-editor/timeline/model/timelineModel.caption.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/video-editor/editorHistory.ts \
        src/components/video-editor/timeline/model/timelineModel.ts \
        src/components/video-editor/timeline/model/timelineModel.caption.test.ts \
        src/components/video-editor/timeline/core/timelineTypes.ts \
        src/components/video-editor/timeline/Item.tsx
git commit -m "feat(captions): add captionRegions to history snapshot and timeline model"
```

---

## Task 4: Wire caption regions into VideoEditor state

**Files:**
- Modify: `src/components/video-editor/VideoEditor.tsx`

- [ ] **Step 1: Add state variables**

In `VideoEditor.tsx`, after the `autoCaptions` state declarations (~line 529), add:

```typescript
const [captionRegions, setCaptionRegions] = useState<CaptionRegion[]>([]);
const [selectedCaptionRegionId, setSelectedCaptionRegionId] = useState<string | null>(null);
const nextCaptionIdRef = useRef(0);
```

Add imports at the top of the file (alongside existing caption-related imports):
```typescript
import type { CaptionRegion } from "./types";
import { DEFAULT_CAPTION_REGION_STYLE } from "./types";
```

- [ ] **Step 2: Add to `buildHistorySnapshot`**

In `buildHistorySnapshot` (~line 1879), add the new fields:

```typescript
const buildHistorySnapshot = useCallback((): EditorHistorySnapshot => {
	return {
		// ... existing fields ...
		captionRegions,
		selectedCaptionRegionId,
	};
}, [
	// ... existing deps ...
	captionRegions,
	selectedCaptionRegionId,
]);
```

- [ ] **Step 3: Add to `applyHistorySnapshot`**

In `applyHistorySnapshot` (~line 1905), add:

```typescript
setCaptionRegions(cloned.captionRegions ?? []);
setSelectedCaptionRegionId(cloned.selectedCaptionRegionId ?? null);
nextCaptionIdRef.current = deriveNextId("caption", (cloned.captionRegions ?? []).map((r) => r.id));
```

- [ ] **Step 4: Add to `buildPersistedEditorState` shape**

In the `Partial<{...}>` type in `buildPersistedEditorState` (~line 1636), add:

```typescript
captionRegions: CaptionRegion[];
```

- [ ] **Step 5: Initialize from loaded project**

In the project loading section (~line 2053 where `setAnnotationRegions` is called), add:

```typescript
setCaptionRegions(normalizedEditor.captionRegions ?? []);
setSelectedCaptionRegionId(null);
nextCaptionIdRef.current = deriveNextId("caption", (normalizedEditor.captionRegions ?? []).map((r) => r.id));
```

- [ ] **Step 6: Add "Convert to Track" handler**

After the `handleClearAutoCaptions` callback, add:

```typescript
const handleConvertCaptionsToTrack = useCallback(() => {
	if (autoCaptions.length === 0) return;
	const newRegions: CaptionRegion[] = autoCaptions.map((cue, i) => ({
		id: `caption-${nextCaptionIdRef.current + i}`,
		startMs: cue.startMs,
		endMs: cue.endMs,
		text: cue.text,
		words: cue.words,
		style: { ...DEFAULT_CAPTION_REGION_STYLE },
	}));
	nextCaptionIdRef.current += newRegions.length;
	setCaptionRegions(newRegions);
	setAutoCaptions([]);
	setAutoCaptionsRaw([]);
	setAutoCaptionSettings((prev) => ({ ...prev, enabled: false }));
}, [autoCaptions]);
```

- [ ] **Step 7: Add caption region mutation callbacks**

```typescript
const handleCaptionRegionSpanChange = useCallback(
	(id: string, span: { start: number; end: number }) => {
		setCaptionRegions((prev) =>
			prev.map((r) => (r.id === id ? { ...r, startMs: span.start, endMs: span.end } : r)),
		);
	},
	[],
);

const handleCaptionRegionStyleChange = useCallback(
	(id: string, style: Partial<CaptionRegionStyle>) => {
		setCaptionRegions((prev) =>
			prev.map((r) => (r.id === id ? { ...r, style: { ...r.style, ...style } } : r)),
		);
	},
	[],
);

const handleCaptionRegionTextChange = useCallback((id: string, text: string) => {
	setCaptionRegions((prev) =>
		prev.map((r) => (r.id === id ? { ...r, text } : r)),
	);
}, []);

const handleCaptionRegionDelete = useCallback((id: string) => {
	setCaptionRegions((prev) => prev.filter((r) => r.id !== id));
	setSelectedCaptionRegionId((prev) => (prev === id ? null : prev));
}, []);

const handleApplyCaptionStyleToAll = useCallback(
	(id: string) => {
		const source = captionRegions.find((r) => r.id === id);
		if (!source) return;
		setCaptionRegions((prev) => prev.map((r) => ({ ...r, style: { ...source.style } })));
	},
	[captionRegions],
);

const handleSelectCaptionRegion = useCallback((id: string | null) => {
	setSelectedCaptionRegionId(id);
}, []);
```

Add `CaptionRegionStyle` to imports:
```typescript
import type { CaptionRegion, CaptionRegionStyle } from "./types";
```

- [ ] **Step 8: Deselect caption region when deleted or deselected**

After the annotation deselect effect (~line 4220), add:

```typescript
useEffect(() => {
	if (
		selectedCaptionRegionId &&
		!captionRegions.some((r) => r.id === selectedCaptionRegionId)
	) {
		setSelectedCaptionRegionId(null);
	}
}, [selectedCaptionRegionId, captionRegions]);
```

- [ ] **Step 9: Commit**

```bash
git add src/components/video-editor/VideoEditor.tsx
git commit -m "feat(captions): add caption region state and handlers to VideoEditor"
```

---

## Task 5: Create `CaptionRegionSettingsPanel`

**Files:**
- Create: `src/components/video-editor/CaptionRegionSettingsPanel.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/video-editor/CaptionRegionSettingsPanel.tsx`:

```typescript
import { useScopedT } from "@/contexts/I18nContext";
import type { CaptionRegion, CaptionRegionStyle } from "./types";
import { DEFAULT_CAPTION_REGION_STYLE } from "./types";
import { SliderControl } from "./SliderControl";
import { Button } from "@/components/ui/button";
import { FONT_FAMILY_VALUES } from "./AnnotationSettingsPanel";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { AutoCaptionAnimation } from "./types";

interface CaptionRegionSettingsPanelProps {
	region: CaptionRegion;
	onStyleChange: (id: string, style: Partial<CaptionRegionStyle>) => void;
	onTextChange: (id: string, text: string) => void;
	onDelete: (id: string) => void;
	onApplyToAll: (id: string) => void;
}

export function CaptionRegionSettingsPanel({
	region,
	onStyleChange,
	onTextChange,
	onDelete,
	onApplyToAll,
}: CaptionRegionSettingsPanelProps) {
	const tSettings = useScopedT("settings");
	const s = region.style;
	const update = (partial: Partial<CaptionRegionStyle>) => onStyleChange(region.id, partial);

	return (
		<div className="flex flex-col gap-3 p-4">
			{/* Text */}
			<div className="flex flex-col gap-1">
				<div className="text-[10px] text-muted-foreground">
					{tSettings("captions.captionText", "Caption text")}
				</div>
				<textarea
					className="w-full rounded-lg border border-foreground/10 bg-foreground/5 p-2 text-sm text-foreground resize-none min-h-[60px]"
					value={region.text}
					onChange={(e) => onTextChange(region.id, e.target.value)}
				/>
			</div>

			{/* Font */}
			<div className="flex items-center justify-between">
				<div className="text-[10px] text-muted-foreground">
					{tSettings("captions.fontFamily", "Font")}
				</div>
				<Select
					value={s.fontFamily}
					onValueChange={(v) => update({ fontFamily: v })}
				>
					<SelectTrigger className="h-9 w-[160px] rounded-xl border-foreground/10 bg-foreground/5 text-sm text-foreground">
						<SelectValue />
					</SelectTrigger>
					<SelectContent className="border-foreground/10 bg-editor-surface-alt text-foreground">
						{FONT_FAMILY_VALUES.map((f) => (
							<SelectItem key={f.value} value={f.value}>
								{tSettings(f.labelKey as never, f.value)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{/* Animation */}
			<div className="flex items-center justify-between">
				<div className="text-[10px] text-muted-foreground">
					{tSettings("captions.animation", "Animation")}
				</div>
				<Select
					value={s.animationStyle}
					onValueChange={(v) => update({ animationStyle: v as AutoCaptionAnimation })}
				>
					<SelectTrigger className="h-9 w-[120px] rounded-xl border-foreground/10 bg-foreground/5 text-sm text-foreground">
						<SelectValue />
					</SelectTrigger>
					<SelectContent className="border-foreground/10 bg-editor-surface-alt text-foreground">
						{(["none", "fade", "rise", "pop"] as AutoCaptionAnimation[]).map((a) => (
							<SelectItem key={a} value={a}>{a}</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{/* Color */}
			<label className="flex items-center justify-between rounded-lg bg-foreground/[0.03] px-2.5 py-2">
				<span className="text-[10px] text-muted-foreground">
					{tSettings("captions.textColor", "Text color")}
				</span>
				<input
					type="color"
					value={s.textColor}
					onChange={(e) => update({ textColor: e.target.value })}
					className="h-7 w-10 rounded border border-foreground/10 bg-transparent"
				/>
			</label>

			{/* Sliders */}
			<SliderControl
				label={tSettings("captions.fontSize", "Font size")}
				value={s.fontSize}
				defaultValue={DEFAULT_CAPTION_REGION_STYLE.fontSize}
				min={16}
				max={72}
				step={1}
				onChange={(v) => update({ fontSize: v })}
				formatValue={(v) => `${Math.round(v)}px`}
				parseInput={(t) => parseFloat(t.replace(/px$/, ""))}
			/>
			<SliderControl
				label={tSettings("captions.bottomOffset", "Bottom offset")}
				value={s.bottomOffset}
				defaultValue={DEFAULT_CAPTION_REGION_STYLE.bottomOffset}
				min={0}
				max={30}
				step={1}
				onChange={(v) => update({ bottomOffset: v })}
				formatValue={(v) => `${Math.round(v)}%`}
				parseInput={(t) => parseFloat(t.replace(/%$/, ""))}
			/>
			<SliderControl
				label={tSettings("captions.maxWidth", "Max width")}
				value={s.maxWidth}
				defaultValue={DEFAULT_CAPTION_REGION_STYLE.maxWidth}
				min={40}
				max={95}
				step={1}
				onChange={(v) => update({ maxWidth: v })}
				formatValue={(v) => `${Math.round(v)}%`}
				parseInput={(t) => parseFloat(t.replace(/%$/, ""))}
			/>
			<SliderControl
				label={tSettings("captions.backgroundOpacity", "Background opacity")}
				value={s.backgroundOpacity}
				defaultValue={DEFAULT_CAPTION_REGION_STYLE.backgroundOpacity}
				min={0}
				max={1}
				step={0.01}
				onChange={(v) => update({ backgroundOpacity: v })}
				formatValue={(v) => `${Math.round(v * 100)}%`}
				parseInput={(t) => parseFloat(t.replace(/%$/, "")) / 100}
			/>
			<SliderControl
				label={tSettings("captions.boxRadius", "Box radius")}
				value={s.boxRadius}
				defaultValue={DEFAULT_CAPTION_REGION_STYLE.boxRadius}
				min={0}
				max={40}
				step={0.5}
				onChange={(v) => update({ boxRadius: v })}
				formatValue={(v) => `${v.toFixed(1)}px`}
				parseInput={(t) => parseFloat(t.replace(/px$/, ""))}
			/>

			{/* Apply to all */}
			<Button
				variant="outline"
				size="sm"
				className="w-full text-xs"
				onClick={() => onApplyToAll(region.id)}
			>
				{tSettings("captions.applyToAll", "Apply style to all captions")}
			</Button>

			{/* Delete */}
			<Button
				onClick={() => onDelete(region.id)}
				variant="destructive"
				size="sm"
				className="w-full gap-2 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/30 transition-all"
			>
				{tSettings("captions.deleteCaption", "Delete Caption")}
			</Button>
		</div>
	);
}
```

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/video-editor/CaptionRegionSettingsPanel.tsx
git commit -m "feat(captions): add CaptionRegionSettingsPanel inspector component"
```

---

## Task 6: Add "Convert to Track" button and caption inspector to `SettingsPanel`

**Files:**
- Modify: `src/components/video-editor/SettingsPanel.tsx`

- [ ] **Step 1: Add props to `SettingsPanelProps`**

In `SettingsPanel.tsx`, find the `onClearAutoCaptions` prop (~line 817) and add after it:

```typescript
captionRegions?: CaptionRegion[];
selectedCaptionRegionId?: string | null;
onConvertCaptionsToTrack?: () => void;
onCaptionRegionStyleChange?: (id: string, style: Partial<CaptionRegionStyle>) => void;
onCaptionRegionTextChange?: (id: string, text: string) => void;
onCaptionRegionDelete?: (id: string) => void;
onApplyCaptionStyleToAll?: (id: string) => void;
```

Add imports at the top (near the `CaptionCue` import):

```typescript
import type { CaptionRegion, CaptionRegionStyle } from "./types";
import { CaptionRegionSettingsPanel } from "./CaptionRegionSettingsPanel";
```

- [ ] **Step 2: Destructure the new props**

In the component body, after `onClearAutoCaptions` destructure (~line 1254), add:

```typescript
captionRegions = [],
selectedCaptionRegionId,
onConvertCaptionsToTrack,
onCaptionRegionStyleChange,
onCaptionRegionTextChange,
onCaptionRegionDelete,
onApplyCaptionStyleToAll,
```

- [ ] **Step 3: Add "Convert to Track" button in captions section**

Find the section where `autoCaptions.length > 0` is checked (~line 2865) and add a button just before the existing "Edit Captions" div:

```tsx
{autoCaptions.length > 0 && (
	<Button
		variant="outline"
		size="sm"
		className="w-full text-xs gap-1.5"
		onClick={onConvertCaptionsToTrack}
	>
		{tSettings("captions.convertToTrack", "Convert to Timeline Track")}
	</Button>
)}
```

- [ ] **Step 4: Render `CaptionRegionSettingsPanel` when a caption region is selected**

Find the block that renders `AnnotationSettingsPanel` when `selectedAnnotation` is set (~line 2292). Add a similar block before it:

```tsx
const selectedCaptionRegion = selectedCaptionRegionId
	? captionRegions.find((r) => r.id === selectedCaptionRegionId)
	: null;

if (
	selectedCaptionRegion &&
	onCaptionRegionStyleChange &&
	onCaptionRegionTextChange &&
	onCaptionRegionDelete &&
	onApplyCaptionStyleToAll
) {
	return (
		<CaptionRegionSettingsPanel
			region={selectedCaptionRegion}
			onStyleChange={onCaptionRegionStyleChange}
			onTextChange={onCaptionRegionTextChange}
			onDelete={onCaptionRegionDelete}
			onApplyToAll={onApplyCaptionStyleToAll}
		/>
	);
}
```

- [ ] **Step 5: Run lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/video-editor/SettingsPanel.tsx
git commit -m "feat(captions): add convert-to-track button and caption region inspector in SettingsPanel"
```

---

## Task 7: Wire caption regions through `TimelineEditor` and `TimelineCanvas`

**Files:**
- Modify: `src/components/video-editor/timeline/TimelineEditor.tsx`
- Modify: `src/components/video-editor/timeline/components/viewport/TimelineCanvas.tsx`
- Modify: `src/components/video-editor/timeline/hooks/useTimelineDndBindings.ts`

- [ ] **Step 1: Add props to `TimelineEditorProps`**

In `TimelineEditor.tsx`, find the `annotationRegions` prop block (~line 57) and add after it:

```typescript
captionRegions?: CaptionRegion[];
onCaptionRegionSpanChange?: (id: string, span: Span) => void;
onCaptionRegionDelete?: (id: string) => void;
selectedCaptionRegionId?: string | null;
onSelectCaptionRegion?: (id: string | null) => void;
```

Add import at the top: `import type { CaptionRegion } from "@/components/video-editor/types";`

- [ ] **Step 2: Thread through `useTimelineEditorCore`**

In `TimelineEditor.tsx`, find where `annotationRegions` is passed to `useTimelineEditorCore` (~line 353) and add:

```typescript
captionRegions,
onCaptionRegionSpanChange,
onCaptionRegionDelete,
selectedCaptionRegionId,
onSelectCaptionRegion,
```

- [ ] **Step 3: Pass `captionRegions` to `buildTimelineItems`**

The call site is in `src/components/video-editor/timeline/hooks/useTimelineDndBindings.ts` (~line 116). Update the interface `UseTimelineDndBindingsParams` to add `captionRegions?: CaptionRegion[]`, destructure it, and update the `buildTimelineItems` call:

```typescript
const timelineItems = useMemo<TimelineRenderItem[]>(
	() =>
		buildTimelineItems({
			zoomRegions,
			clipRegions,
			annotationRegions,
			audioRegions,
			captionRegions: captionRegions ?? [],
		}),
	[zoomRegions, clipRegions, annotationRegions, audioRegions, captionRegions],
);
```

Also update `resolveItemKind` to recognize caption regions:

```typescript
if (captionRegions?.some((r) => r.id === id)) return "caption";
```

Add import: `import type { CaptionRegion } from "@/components/video-editor/types";`

- [ ] **Step 4: Add caption selection and span change handling in `handleItemSpanChange`**

In the span change handler (where `isAnnotationTrackRowId` is checked), add a caption branch:

```typescript
if (isCaptionTrackRowId(item.rowId)) {
	onCaptionRegionSpanChange?.(item.id, span);
	return;
}
```

Import `isCaptionTrackRowId` if not already.

- [ ] **Step 5: Update `TimelineCanvas` selection handling**

In `TimelineCanvas.tsx`, add `selectedCaptionRegionId` and `onSelectCaptionRegion` to its props interface and render caption items with:

```tsx
{item.variant === "caption" && (
	<Item
		key={item.id}
		rowId={item.rowId}
		span={item.span}
		isSelected={item.id === selectedCaptionRegionId}
		onSelectId={onSelectCaptionRegion}
		variant="caption"
	>
		{item.label}
	</Item>
)}
```

Also clear caption selection on background click alongside the other null selects:
```typescript
onSelectCaptionRegion?.(null);
```

- [ ] **Step 6: Pass caption props to `TimelineCanvas` from `TimelineEditor` render**

In `TimelineEditor.tsx`'s JSX (~line 458), add to `<TimelineCanvas>`:

```tsx
selectedCaptionRegionId={selectedCaptionRegionId}
onSelectCaptionRegion={onSelectCaptionRegion}
```

- [ ] **Step 7: Run lint**

```bash
npm run lint
```

- [ ] **Step 8: Commit**

```bash
git add src/components/video-editor/timeline/TimelineEditor.tsx \
        src/components/video-editor/timeline/components/viewport/TimelineCanvas.tsx
git commit -m "feat(captions): wire captionRegions through TimelineEditor and TimelineCanvas"
```

---

## Task 8: Connect VideoEditor to TimelineEditor and SettingsPanel caption props

**Files:**
- Modify: `src/components/video-editor/VideoEditor.tsx`

- [ ] **Step 1: Pass new props to `<TimelineEditor>`**

Find the `<TimelineEditor>` JSX block (~line 5240+) and add:

```tsx
captionRegions={captionRegions}
onCaptionRegionSpanChange={handleCaptionRegionSpanChange}
onCaptionRegionDelete={handleCaptionRegionDelete}
selectedCaptionRegionId={selectedCaptionRegionId}
onSelectCaptionRegion={handleSelectCaptionRegion}
```

- [ ] **Step 2: Pass new props to `<SettingsPanel>`**

Find the `<SettingsPanel>` JSX block and add:

```tsx
captionRegions={captionRegions}
selectedCaptionRegionId={selectedCaptionRegionId}
onConvertCaptionsToTrack={handleConvertCaptionsToTrack}
onCaptionRegionStyleChange={handleCaptionRegionStyleChange}
onCaptionRegionTextChange={handleCaptionRegionTextChange}
onCaptionRegionDelete={handleCaptionRegionDelete}
onApplyCaptionStyleToAll={handleApplyCaptionStyleToAll}
```

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/video-editor/VideoEditor.tsx
git commit -m "feat(captions): connect captionRegions props in VideoEditor"
```

---

## Task 9: Render caption regions in `VideoPlayback`

**Files:**
- Modify: `src/components/video-editor/VideoPlayback.tsx`

- [ ] **Step 1: Add props**

In `VideoPlayback.tsx`, after `autoCaptionSettings` prop (~line 363):

```typescript
captionRegions?: CaptionRegion[];
selectedCaptionRegionId?: string | null;
```

Add import: `import type { CaptionRegion } from "./types";`

Destructure in the component body (~line 445):
```typescript
captionRegions = [],
selectedCaptionRegionId,
```

- [ ] **Step 2: Render caption regions as positioned overlays**

Find the block that renders `activeCaptionLayout` (~line 2952). After it, add:

```tsx
{captionRegions.map((region) => {
	if (currentTime * 1000 < region.startMs || currentTime * 1000 > region.endMs) return null;
	const s = region.style;
	const isSelected = region.id === selectedCaptionRegionId;
	return (
		<div
			key={region.id}
			className="pointer-events-none absolute inset-x-0 flex justify-center"
			style={{ bottom: `${s.bottomOffset}%` }}
		>
			<div
				style={{
					maxWidth: `${s.maxWidth}%`,
					backgroundColor: `rgba(0, 0, 0, ${s.backgroundOpacity})`,
					fontFamily: s.fontFamily,
					fontSize: `${s.fontSize}px`,
					color: s.textColor,
					borderRadius: `${s.boxRadius}px`,
					padding: "4px 12px",
					outline: isSelected ? "2px solid #2563EB" : "none",
				}}
			>
				{region.text}
			</div>
		</div>
	);
})}
```

- [ ] **Step 3: Pass props from `VideoEditor` to `VideoPlayback`**

In `VideoEditor.tsx`, find the `<VideoPlayback>` JSX blocks (~line 5250) and add:

```tsx
captionRegions={captionRegions}
selectedCaptionRegionId={selectedCaptionRegionId}
```

(There are two `VideoPlayback` renders — update both.)

- [ ] **Step 4: Run lint**

```bash
npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add src/components/video-editor/VideoPlayback.tsx \
        src/components/video-editor/VideoEditor.tsx
git commit -m "feat(captions): render caption regions in VideoPlayback preview"
```

---

## Task 10: Thread caption regions through export pipeline

**Files:**
- Modify: `src/lib/exporter/frameRenderer.ts`
- Modify: `src/lib/exporter/modernFrameRenderer.ts`
- Modify: `src/lib/exporter/gifExporter.ts`
- Modify: `src/lib/exporter/modernVideoExporter.ts`
- Modify: `src/lib/exporter/videoExporter.ts`

- [ ] **Step 1: Update `FrameRendererConfig` in `frameRenderer.ts`**

In `frameRenderer.ts`, add to the config interface (~line 114):

```typescript
captionRegions?: CaptionRegion[];
```

And add rendering after the existing `autoCaptions` block (~line 1565):

```typescript
if (this.config.captionRegions?.length) {
	for (const region of this.config.captionRegions) {
		if (temporalSnapshot.timeMs >= region.startMs && temporalSnapshot.timeMs <= region.endMs) {
			renderCaptions(
				this.compositeCtx,
				[{ id: region.id, startMs: region.startMs, endMs: region.endMs, text: region.text, words: region.words }],
				{
					...DEFAULT_AUTO_CAPTION_SETTINGS,
					...region.style,
					enabled: true,
					language: "auto",
					maxRows: 1,
					maxCharsPerLine: 0,
				},
				this.config.width,
				this.config.height,
				temporalSnapshot.timeMs,
			);
		}
	}
}
```

Add import at top: `import type { CaptionRegion } from "@/components/video-editor/types";`
And import `DEFAULT_AUTO_CAPTION_SETTINGS`.

- [ ] **Step 2: Apply same pattern to `modernFrameRenderer.ts`**

Add `captionRegions?: CaptionRegion[]` to the config interface (~line 132).

In `buildCaptionRenderState`, the existing method only handles `autoCaptions`. After existing caption render calls, add a loop matching the `frameRenderer.ts` pattern from Step 1 (same code, adapted to call the method used in `modernFrameRenderer`).

Specifically, find where `renderCaptions` or `buildCaptionRenderState` is called for `autoCaptions` and add a parallel block for `captionRegions`.

- [ ] **Step 3: Update `gifExporter.ts`**

Add `captionRegions?: CaptionRegion[]` to the config interface (~line 67) and thread it through to the `frameRenderer` config object (~line 170):

```typescript
captionRegions: config.captionRegions,
```

- [ ] **Step 4: Update `videoExporter.ts`**

Add `captionRegions?: CaptionRegion[]` to the config interface (~line 74) and thread it through:

```typescript
captionRegions: this.config.captionRegions,
```

- [ ] **Step 5: Update `modernVideoExporter.ts`**

Add `captionRegions?: CaptionRegion[]` to the config interface (~line 124) and thread it through (~line 615):

```typescript
captionRegions: this.config.captionRegions,
```

Also update the native-bypass check (~line 1556) to also fail bypass when caption regions exist:

```typescript
if ((this.config.autoCaptions ?? []).length > 0 || (this.config.captionRegions ?? []).length > 0) {
	reasons.push("unsupported-caption-overlay");
}
```

- [ ] **Step 6: Pass `captionRegions` from `VideoEditor` export call**

In `VideoEditor.tsx`, find where the exporter config object is built (~line 1682+). Add:

```typescript
captionRegions,
```

- [ ] **Step 7: Run lint**

```bash
npm run lint
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/exporter/frameRenderer.ts \
        src/lib/exporter/modernFrameRenderer.ts \
        src/lib/exporter/gifExporter.ts \
        src/lib/exporter/modernVideoExporter.ts \
        src/lib/exporter/videoExporter.ts \
        src/components/video-editor/VideoEditor.tsx
git commit -m "feat(captions): thread captionRegions through export pipeline"
```

---

## Task 11: Add i18n keys

**Files:**
- Modify: `src/i18n/locales/en/settings.json`
- Modify: `src/i18n/locales/zh-CN/settings.json`

- [ ] **Step 1: Add English keys**

In `src/i18n/locales/en/settings.json`, find the `captions` object and add:

```json
"convertToTrack": "Convert to Timeline Track",
"applyToAll": "Apply style to all captions",
"captionText": "Caption text",
"deleteCaption": "Delete Caption"
```

- [ ] **Step 2: Add Chinese keys**

In `src/i18n/locales/zh-CN/settings.json`, find the `captions` object and add:

```json
"convertToTrack": "转换为时间轴轨道",
"applyToAll": "应用样式到所有字幕",
"captionText": "字幕文本",
"deleteCaption": "删除字幕"
```

- [ ] **Step 3: Run i18n check**

```bash
npm run i18n:check
```

Expected: check passes (only EN and ZH-CN are required; other locales get fallback).

- [ ] **Step 4: Commit**

```bash
git add src/i18n/locales/en/settings.json src/i18n/locales/zh-CN/settings.json
git commit -m "feat(captions): add i18n keys for caption track UI"
```

---

## Task 12: Run full test suite and fix regressions

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: all existing tests pass; the 2 new tests added in Tasks 2 and 3 also pass.

- [ ] **Step 2: Fix any failures**

If `editorHistory` tests fail because `captionRegions` / `selectedCaptionRegionId` are missing from snapshot fixtures, update them:

```typescript
// In any snapshot fixture in tests, add:
captionRegions: [],
selectedCaptionRegionId: null,
```

- [ ] **Step 3: Re-run to confirm green**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 4: Commit any test fixes**

```bash
git add -p   # stage only test fixes
git commit -m "fix(captions): update test fixtures for captionRegions snapshot field"
```
