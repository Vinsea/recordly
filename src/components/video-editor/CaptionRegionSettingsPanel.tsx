import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useScopedT } from "@/contexts/I18nContext";
import { FONT_FAMILY_VALUES } from "./AnnotationSettingsPanel";
import { SliderControl } from "./SliderControl";
import type { AutoCaptionAnimation, CaptionRegion, CaptionRegionStyle } from "./types";
import { DEFAULT_CAPTION_REGION_STYLE } from "./types";

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
			<div className="flex flex-col gap-1">
				<div className="text-[10px] text-muted-foreground">
					{tSettings("captions.captionText", "Caption text")}
				</div>
				<textarea
					className="w-full resize-none rounded-lg border border-foreground/10 bg-foreground/5 p-2 text-sm text-foreground min-h-[60px]"
					value={region.text}
					onChange={(e) => onTextChange(region.id, e.target.value)}
				/>
			</div>

			<div className="flex items-center justify-between">
				<div className="text-[10px] text-muted-foreground">
					{tSettings("captions.fontFamily", "Font")}
				</div>
				<Select value={s.fontFamily} onValueChange={(v) => update({ fontFamily: v })}>
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
							<SelectItem key={a} value={a}>
								{a}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

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

			<SliderControl
				label={tSettings("captions.fontSize", "Font size")}
				value={s.fontSize}
				defaultValue={DEFAULT_CAPTION_REGION_STYLE.fontSize}
				min={16}
				max={72}
				step={1}
				onChange={(v) => update({ fontSize: v })}
				formatValue={(v) => `${Math.round(v)}px`}
				parseInput={(t) => Number.parseFloat(t.replace(/px$/, ""))}
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
				parseInput={(t) => Number.parseFloat(t.replace(/%$/, ""))}
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
				parseInput={(t) => Number.parseFloat(t.replace(/%$/, ""))}
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
				parseInput={(t) => Number.parseFloat(t.replace(/%$/, "")) / 100}
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
				parseInput={(t) => Number.parseFloat(t.replace(/px$/, ""))}
			/>

			<Button
				variant="outline"
				size="sm"
				className="w-full text-xs"
				onClick={() => onApplyToAll(region.id)}
			>
				{tSettings("captions.applyToAll", "Apply style to all captions")}
			</Button>

			<Button
				onClick={() => onDelete(region.id)}
				variant="destructive"
				size="sm"
				className="w-full gap-2 border border-red-500/20 bg-red-500/10 text-red-400 transition-all hover:border-red-500/30 hover:bg-red-500/20"
			>
				{tSettings("captions.deleteCaption", "Delete Caption")}
			</Button>
		</div>
	);
}
