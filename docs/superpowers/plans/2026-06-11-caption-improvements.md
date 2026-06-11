# Caption Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three caption problems: long sentences not auto-splitting, audio trim not reflected in timestamps, and missing font selector UI.

**Architecture:**
- Task 1: Persist `autoCaptionsRaw` in the project file and fix the `fontFamily` persistence bug, so the split-on-load effect works correctly.
- Task 2: Add automatic char-based splitting after caption generation (no user config required), using a pixel-width estimator based on `fontSize` and `maxWidth`.
- Task 3: FFmpeg concat approach — pass `clipRegions` to the main process, extract only the kept segments, concatenate into one WAV, then remap Whisper timestamps back to timeline time.
- Task 4: Add font family selector UI in `SettingsPanel.tsx` for captions, reusing the font list and `AddCustomFontDialog` from `AnnotationSettingsPanel`.

**Tech Stack:** TypeScript, React, Electron IPC, FFmpeg CLI, Whisper CLI, Biome

---

## File Map

| File | Change |
|---|---|
| `src/components/video-editor/types.ts` | No change needed — `fontFamily` already in `AutoCaptionSettings` |
| `src/components/video-editor/projectPersistence.ts` | Persist `autoCaptionsRaw`; fix `fontFamily` to read from saved value |
| `src/components/video-editor/VideoEditor.tsx` | Pass `clipRegions` to `generateAutoCaptions`; add auto-split after generation; persist `autoCaptionsRaw` in snapshot/restore |
| `src/components/video-editor/captionEditing.ts` | Add `estimateAutoMaxChars()` helper |
| `electron/ipc/captions/generate.ts` | Accept `clipRegions`; implement FFmpeg concat+trim for main audio; remap timestamps |
| `electron/ipc/register/captions.ts` | Pass `clipRegions` through to `generateAutoCaptionsFromVideo` |
| `electron/preload.ts` | Update `generateAutoCaptions` type to include `clipRegions` |
| `src/components/video-editor/SettingsPanel.tsx` | Add font family selector for captions |
| `src/components/video-editor/captionEditing.test.ts` | Tests for `estimateAutoMaxChars` and updated `splitCuesByMaxChars` behavior |

---

## Task 1: Persist `autoCaptionsRaw` and fix `fontFamily` persistence

**Files:**
- Modify: `src/components/video-editor/projectPersistence.ts:130-145, 697-810`
- Modify: `src/components/video-editor/VideoEditor.tsx:515-540, 1680-1710, 1850-1870, 1905-1930, 2040-2090`

- [ ] **Step 1: Add `autoCaptionsRaw` to `ProjectEditorState`**

In `src/components/video-editor/projectPersistence.ts`, find the `ProjectEditorState` interface (around line 130) and add one field after `autoCaptions`:

```typescript
autoCaptions: CaptionCue[];
autoCaptionsRaw: CaptionCue[];   // add this line
autoCaptionSettings: AutoCaptionSettings;
```

- [ ] **Step 2: Normalize `autoCaptionsRaw` when loading project**

In the same file, after the block that builds `normalizedAutoCaptions` (~line 697), add:

```typescript
const normalizedAutoCaptionsRaw: CaptionCue[] = Array.isArray(
  (editor as Partial<ProjectEditorState>).autoCaptionsRaw,
)
  ? ((editor as Partial<ProjectEditorState>).autoCaptionsRaw as CaptionCue[])
      .filter((cue): cue is CaptionCue => Boolean(cue && typeof cue.id === "string"))
      .map((cue) => {
        const rawStart = isFiniteNumber(cue.startMs) ? Math.round(cue.startMs) : 0;
        const rawEnd = isFiniteNumber(cue.endMs) ? Math.round(cue.endMs) : rawStart;
        return {
          id: cue.id,
          startMs: rawStart,
          endMs: Math.max(rawStart, rawEnd),
          text: typeof cue.text === "string" ? cue.text : "",
          words: Array.isArray(cue.words) ? cue.words : undefined,
        } satisfies CaptionCue;
      })
  : [];
```

- [ ] **Step 3: Fix `fontFamily` to read from saved value**

In the same `normalizedAutoCaptionSettings` block (~line 767), change the hard-coded `fontFamily` line:

```typescript
// Before:
fontFamily: getDefaultCaptionFontFamily(),

// After:
fontFamily:
  typeof rawAutoCaptionSettings.fontFamily === "string" &&
  rawAutoCaptionSettings.fontFamily.trim()
    ? rawAutoCaptionSettings.fontFamily.trim()
    : getDefaultCaptionFontFamily(),
```

- [ ] **Step 4: Include `autoCaptionsRaw` in the returned state**

Find the return object near line 997 and add `autoCaptionsRaw`:

```typescript
autoCaptions: normalizedAutoCaptions,
autoCaptionsRaw: normalizedAutoCaptionsRaw,   // add this line
autoCaptionSettings: normalizedAutoCaptionSettings,
```

- [ ] **Step 5: Add `autoCaptionsRaw` state in `VideoEditor.tsx`**

`autoCaptionsRaw` is already managed as React state in `VideoEditor.tsx` (~line 533). Verify it exists:

```typescript
const [autoCaptionsRaw, setAutoCaptionsRaw] = useState<CaptionCue[]>([]);
```

If it already exists, no change needed here. Move on to Step 6.

- [ ] **Step 6: Include `autoCaptionsRaw` in the editor snapshot**

In `VideoEditor.tsx`, find the snapshot builder (the object with `autoCaptions:` around line 1688). Add `autoCaptionsRaw` to both the snapshot type and the object:

```typescript
// In the snapshot type:
autoCaptions: CaptionCue[];
autoCaptionsRaw: CaptionCue[];   // add

// In the snapshot object:
autoCaptions: autoCaptions,
autoCaptionsRaw: autoCaptionsRaw,   // add
```

- [ ] **Step 7: Restore `autoCaptionsRaw` from snapshot**

Find the snapshot restore block (~line 1907, `setAutoCaptions(cloned.autoCaptions)`) and add:

```typescript
setAutoCaptions(cloned.autoCaptions);
setAutoCaptionsRaw(cloned.autoCaptionsRaw ?? []);   // add
```

- [ ] **Step 8: Restore `autoCaptionsRaw` when loading project**

Find the project-load block (~line 2046, `setAutoCaptions(normalizedEditor.autoCaptions)`) and add:

```typescript
setAutoCaptions(normalizedEditor.autoCaptions);
setAutoCaptionsRaw(normalizedEditor.autoCaptionsRaw ?? []);   // add
```

- [ ] **Step 9: Commit**

```bash
git add src/components/video-editor/projectPersistence.ts src/components/video-editor/VideoEditor.tsx
git commit -m "fix(captions): persist autoCaptionsRaw and fontFamily in project file"
```

---

## Task 2: Auto-split long sentences after generation

**Files:**
- Modify: `src/components/video-editor/captionEditing.ts`
- Modify: `src/components/video-editor/VideoEditor.tsx`
- Create: `src/components/video-editor/captionEditing.test.ts` (if not exists)

**Context:** `splitCuesByMaxChars` already exists and works. The missing piece is: when `maxCharsPerLine === 0` (default), estimate a sensible char limit from `fontSize` and `maxWidth` so long sentences auto-wrap.

The estimator formula: a 1920px-wide canvas with `maxWidth`% gives `targetPx = 1920 * maxWidth/100`. Average character width at a given `fontSize` is approximately `fontSize * 0.55` (for Latin/mixed text). So `estimatedChars = Math.floor(targetPx / (fontSize * 0.55))`.

- [ ] **Step 1: Add `estimateAutoMaxChars` to `captionEditing.ts`**

At the bottom of `src/components/video-editor/captionEditing.ts`, add:

```typescript
/** Estimate max chars per line from canvas dimensions when user hasn't set an explicit limit. */
export function estimateAutoMaxChars(fontSize: number, maxWidthPercent: number): number {
  const referenceWidth = 1920;
  const targetPx = referenceWidth * (maxWidthPercent / 100);
  const avgCharWidthPx = fontSize * 0.55;
  return Math.max(10, Math.floor(targetPx / avgCharWidthPx));
}
```

- [ ] **Step 2: Write the failing test**

In `src/components/video-editor/captionEditing.test.ts` add:

```typescript
import { describe, expect, it } from "vitest";
import { estimateAutoMaxChars, splitCuesByMaxChars } from "./captionEditing";
import type { CaptionCue } from "./types";

describe("estimateAutoMaxChars", () => {
  it("returns a reasonable char limit for typical settings", () => {
    // fontSize=30, maxWidth=62 → targetPx=1190.4, avgCharWidth=16.5 → ~72 chars
    const result = estimateAutoMaxChars(30, 62);
    expect(result).toBeGreaterThan(50);
    expect(result).toBeLessThan(100);
  });

  it("returns at least 10 even for extreme values", () => {
    expect(estimateAutoMaxChars(200, 5)).toBeGreaterThanOrEqual(10);
  });
});

describe("splitCuesByMaxChars with auto-estimated limit", () => {
  it("splits a long cue when limit is derived automatically", () => {
    const longCue: CaptionCue = {
      id: "cue-1",
      startMs: 0,
      endMs: 5000,
      text: "This is a very long sentence that should be split into multiple parts when the limit is low",
      words: "This is a very long sentence that should be split into multiple parts when the limit is low"
        .split(" ")
        .map((word, i) => ({
          text: word,
          startMs: i * 500,
          endMs: (i + 1) * 500,
          leadingSpace: i > 0,
        })),
    };
    const limit = estimateAutoMaxChars(30, 62);
    const result = splitCuesByMaxChars([longCue], limit);
    expect(result.length).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 3: Run the failing test**

```bash
npx vitest run src/components/video-editor/captionEditing.test.ts
```

Expected: FAIL — `estimateAutoMaxChars` not exported yet.

- [ ] **Step 4: Run test after adding the export**

After Step 1 is done, run again:

```bash
npx vitest run src/components/video-editor/captionEditing.test.ts
```

Expected: PASS for both `estimateAutoMaxChars` tests.

- [ ] **Step 5: Use `estimateAutoMaxChars` in the split effect in `VideoEditor.tsx`**

Find the `useEffect` that calls `splitCuesByMaxChars` (~line 2797):

```typescript
// Before:
useEffect(() => {
  if (autoCaptionsRaw.length === 0) return;
  setAutoCaptions(splitCuesByMaxChars(autoCaptionsRaw, autoCaptionSettings.maxCharsPerLine));
}, [autoCaptionsRaw, autoCaptionSettings.maxCharsPerLine]);
```

```typescript
// After:
useEffect(() => {
  if (autoCaptionsRaw.length === 0) return;
  const limit =
    autoCaptionSettings.maxCharsPerLine > 0
      ? autoCaptionSettings.maxCharsPerLine
      : estimateAutoMaxChars(autoCaptionSettings.fontSize, autoCaptionSettings.maxWidth);
  setAutoCaptions(splitCuesByMaxChars(autoCaptionsRaw, limit));
}, [autoCaptionsRaw, autoCaptionSettings.maxCharsPerLine, autoCaptionSettings.fontSize, autoCaptionSettings.maxWidth]);
```

Also add `estimateAutoMaxChars` to the import from `./captionEditing` at the top of `VideoEditor.tsx`.

- [ ] **Step 6: Run tests**

```bash
npx vitest run src/components/video-editor/captionEditing.test.ts
```

Expected: PASS all.

- [ ] **Step 7: Commit**

```bash
git add src/components/video-editor/captionEditing.ts src/components/video-editor/captionEditing.test.ts src/components/video-editor/VideoEditor.tsx
git commit -m "feat(captions): auto-split long sentences using estimated char limit"
```

---

## Task 3: FFmpeg clip-aware audio extraction for accurate timestamps

**Files:**
- Modify: `electron/ipc/captions/generate.ts`
- Modify: `electron/ipc/register/captions.ts`
- Modify: `electron/preload.ts`
- Modify: `src/components/video-editor/VideoEditor.tsx`

**Context:** `ClipRegion` has `startMs`/`endMs` in **source file time** — i.e., the segments of the original video that are kept. Whisper currently transcribes the whole source file. The fix: for each kept clip segment, extract that slice of audio with FFmpeg (`-ss` / `-t`), concatenate all slices into one WAV, run Whisper once, then remap timestamps from "concatenated time" back to "source time" using the clip list.

The remapping algorithm:
- Build a sorted list of `{ sourceStartMs, sourceEndMs, concatOffsetMs }` for each clip.
- For each Whisper cue, find which concat segment it falls in, then:
  `sourceMs = clip.sourceStartMs + (whisperMs - clip.concatOffsetMs)`
- Clamp cue `startMs`/`endMs` to the clip's `[sourceStartMs, sourceEndMs]`.
- Drop any cue where the remapped range is zero-length or lies entirely outside all clips.

- [ ] **Step 1: Add `extractAndConcatClipAudio` helper in `generate.ts`**

Add this function before `generateAutoCaptionsFromVideo`:

```typescript
interface ClipSegment {
  startMs: number;
  endMs: number;
}

/** Extracts kept clip segments from source audio and concatenates them into a single WAV. */
async function extractAndConcatClipAudio(options: {
  sourcePath: string;
  ffmpegPath: string;
  clips: ClipSegment[];
  outputWavPath: string;
}): Promise<Array<{ sourceStartMs: number; sourceEndMs: number; concatOffsetMs: number }>> {
  const { sourcePath, ffmpegPath, clips, outputWavPath } = options;
  const sorted = [...clips].sort((a, b) => a.startMs - b.startMs);

  if (sorted.length === 0) {
    // No clips — extract full audio unchanged
    await execFileAsync(
      ffmpegPath,
      ["-y", "-i", sourcePath, "-map", "0:a:0", "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", outputWavPath],
      { timeout: 5 * 60 * 1000, maxBuffer: 20 * 1024 * 1024 },
    );
    return [];
  }

  // Extract each segment to a temp file
  const tempDir = path.dirname(outputWavPath);
  const segmentPaths: string[] = [];
  const mapping: Array<{ sourceStartMs: number; sourceEndMs: number; concatOffsetMs: number }> = [];
  let concatOffsetMs = 0;

  try {
    for (let i = 0; i < sorted.length; i++) {
      const clip = sorted[i];
      const durationMs = clip.endMs - clip.startMs;
      if (durationMs <= 0) continue;

      const segPath = path.join(tempDir, `seg-${i}-${Date.now()}.wav`);
      segmentPaths.push(segPath);

      await execFileAsync(
        ffmpegPath,
        [
          "-y",
          "-ss", String(clip.startMs / 1000),
          "-t", String(durationMs / 1000),
          "-i", sourcePath,
          "-map", "0:a:0",
          "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le",
          segPath,
        ],
        { timeout: 5 * 60 * 1000, maxBuffer: 20 * 1024 * 1024 },
      );

      mapping.push({ sourceStartMs: clip.startMs, sourceEndMs: clip.endMs, concatOffsetMs });
      concatOffsetMs += durationMs;
    }

    if (segmentPaths.length === 1) {
      // Only one segment — no need to concat, just rename
      await fs.rename(segmentPaths[0], outputWavPath);
      segmentPaths.length = 0; // already moved
    } else {
      // Build FFmpeg concat list file
      const listPath = path.join(tempDir, `concat-list-${Date.now()}.txt`);
      const listContent = segmentPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n");
      await fs.writeFile(listPath, listContent, "utf-8");

      try {
        await execFileAsync(
          ffmpegPath,
          ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outputWavPath],
          { timeout: 5 * 60 * 1000, maxBuffer: 20 * 1024 * 1024 },
        );
      } finally {
        await fs.rm(listPath, { force: true });
      }
    }
  } finally {
    await Promise.allSettled(segmentPaths.map((p) => fs.rm(p, { force: true })));
  }

  return mapping;
}
```

- [ ] **Step 2: Add `remapCuesToSourceTime` helper in `generate.ts`**

Add this function after `extractAndConcatClipAudio`:

```typescript
interface ConcatMapping {
  sourceStartMs: number;
  sourceEndMs: number;
  concatOffsetMs: number;
}

function remapCuesToSourceTime(
  cues: CaptionCuePayload[],
  mapping: ConcatMapping[],
): CaptionCuePayload[] {
  if (mapping.length === 0) return cues; // no clips passed — full audio, no remap needed

  const result: CaptionCuePayload[] = [];
  for (const cue of cues) {
    // Find which concat segment this cue's midpoint falls in
    const midMs = (cue.startMs + cue.endMs) / 2;
    const segment = mapping.find((seg) => {
      const segDurationMs = seg.sourceEndMs - seg.sourceStartMs;
      const segEndConcatMs = seg.concatOffsetMs + segDurationMs;
      return midMs >= seg.concatOffsetMs && midMs < segEndConcatMs;
    });
    if (!segment) continue; // cue is in a trimmed gap — skip

    const offset = segment.sourceStartMs - segment.concatOffsetMs;
    const newStart = Math.max(segment.sourceStartMs, Math.round(cue.startMs + offset));
    const newEnd = Math.min(segment.sourceEndMs, Math.round(cue.endMs + offset));
    if (newEnd <= newStart) continue;

    result.push({
      ...cue,
      startMs: newStart,
      endMs: newEnd,
      words: cue.words?.map((w) => ({
        ...w,
        startMs: Math.max(newStart, Math.round(w.startMs + offset)),
        endMs: Math.min(newEnd, Math.round(w.endMs + offset)),
      })),
    });
  }
  return result;
}
```

- [ ] **Step 3: Update `generateAutoCaptionsFromVideo` signature to accept `clipRegions`**

Find the options type for `generateAutoCaptionsFromVideo` (~line 159):

```typescript
// Before:
export async function generateAutoCaptionsFromVideo(options: {
  videoPath: string;
  whisperExecutablePath?: string;
  whisperModelPath: string;
  language?: string;
  extraAudioRegions?: Array<{ path: string; startMs: number; endMs: number }>;
})

// After:
export async function generateAutoCaptionsFromVideo(options: {
  videoPath: string;
  whisperExecutablePath?: string;
  whisperModelPath: string;
  language?: string;
  extraAudioRegions?: Array<{ path: string; startMs: number; endMs: number }>;
  clipRegions?: Array<{ startMs: number; endMs: number }>;
})
```

- [ ] **Step 4: Use `extractAndConcatClipAudio` in the fallback (main video) path**

In the same function, find the fallback path (~line 241) where `extractCaptionAudioSource` is called and the audio is extracted to `wavPath`. Replace the extraction call with:

```typescript
// Before (extractCaptionAudioSource writes to wavPath):
const audioSource = await extractCaptionAudioSource({
  videoPath: normalizedVideoPath,
  ffmpegPath,
  wavPath,
});

// After:
const audioSource = await extractCaptionAudioSource({
  videoPath: normalizedVideoPath,
  ffmpegPath,
  wavPath,
});

// If clip regions provided, re-extract with segment slicing
const concatMapping =
  options.clipRegions && options.clipRegions.length > 0
    ? await extractAndConcatClipAudio({
        sourcePath: audioSource.path,  // use the resolved audio source path
        ffmpegPath,
        clips: options.clipRegions,
        outputWavPath: wavPath,        // overwrite the full-audio wav
      })
    : [];
```

Then after Whisper runs and `cues` is built (~line 296):

```typescript
// Before:
const cues =
  timedCues.length > 0 ? timedCues : parseSrtCues(await fs.readFile(srtPath, "utf-8"));
if (cues.length === 0) {
  throw new Error("Whisper completed, but no caption cues were produced.");
}
return { cues, audioSourceLabel: audioSource.label };

// After:
const rawCues =
  timedCues.length > 0 ? timedCues : parseSrtCues(await fs.readFile(srtPath, "utf-8"));
if (rawCues.length === 0) {
  throw new Error("Whisper completed, but no caption cues were produced.");
}
const cues = remapCuesToSourceTime(rawCues, concatMapping);
return { cues, audioSourceLabel: audioSource.label };
```

**Note:** `extractCaptionAudioSource` currently does not return the resolved source path. Check its return type. If it only returns `{ label: string }`, update it to also return `path: string`:

```typescript
// In extractCaptionAudioSource (~line 101), change the return:
return candidate;  // candidate already has { path, label }
```

Verify that `candidate` has a `path` field — it comes from `resolveCaptionAudioCandidates` which pushes objects with `{ path, label }`.

- [ ] **Step 5: Update `electron/ipc/register/captions.ts` to pass `clipRegions`**

Find the `generate-auto-captions` handler and update the options type and the call:

```typescript
// In the handler options type, add:
clipRegions?: Array<{ startMs: number; endMs: number }>;

// In the generateAutoCaptionsFromVideo call, pass it through:
clipRegions: options.clipRegions,
```

- [ ] **Step 6: Update `electron/preload.ts` type for `generateAutoCaptions`**

Find the `generateAutoCaptions` entry in the contextBridge and add `clipRegions` to its parameter type:

```typescript
clipRegions?: Array<{ startMs: number; endMs: number }>;
```

- [ ] **Step 7: Pass `clipRegions` from `VideoEditor.tsx` when calling `generateAutoCaptions`**

Find the `generateAutoCaptions` call (~line 2759) and add `clipRegions`:

```typescript
const result = await window.electronAPI.generateAutoCaptions({
  videoPath: sourcePath,
  whisperExecutablePath: whisperExecutablePath ?? undefined,
  whisperModelPath,
  language: autoCaptionSettings.language,
  clipRegions: clipRegions.map((c) => ({ startMs: c.startMs, endMs: c.endMs })),
  extraAudioRegions: audioRegions
    .filter((r) => r.audioPath)
    .map((r) => ({ path: r.audioPath, startMs: r.startMs, endMs: r.endMs })),
});
```

`clipRegions` is already in scope in `VideoEditor.tsx` as the state variable from Task 1's exploration.

- [ ] **Step 8: Run lint**

```bash
npm run lint
```

Fix any errors reported by Biome before committing.

- [ ] **Step 9: Commit**

```bash
git add electron/ipc/captions/generate.ts electron/ipc/register/captions.ts electron/preload.ts src/components/video-editor/VideoEditor.tsx
git commit -m "feat(captions): extract only trimmed segments for Whisper, remap timestamps to source time"
```

---

## Task 4: Font family selector in caption settings

**Files:**
- Modify: `src/components/video-editor/SettingsPanel.tsx`

**Context:** `AnnotationSettingsPanel.tsx` already has a working font selector that shows `FONT_FAMILY_VALUES` (built-in) + `customFonts` (from `getCustomFonts()`) with an `AddCustomFontDialog`. The caption settings panel in `SettingsPanel.tsx` needs the same UI wired to `autoCaptionSettings.fontFamily`.

- [ ] **Step 1: Import font utilities in `SettingsPanel.tsx`**

Find the import block in `SettingsPanel.tsx`. Add imports:

```typescript
import { FONT_FAMILY_VALUES } from "./AnnotationSettingsPanel";
import { type CustomFont, getCustomFonts } from "@/lib/customFonts";
import { AddCustomFontDialog } from "./AddCustomFontDialog";
```

- [ ] **Step 2: Add `customFonts` state inside the captions section component**

`SettingsPanel.tsx` likely has a component or render block for the captions section. Find the component that renders `autoCaptionSettings` (the one around line 1250). Add state and an effect near the top of that component:

```typescript
const [captionCustomFonts, setCaptionCustomFonts] = useState<CustomFont[]>([]);
useEffect(() => {
  setCaptionCustomFonts(getCustomFonts());
}, []);
```

Also get the i18n `t` function for font labels (already available in `SettingsPanel.tsx`):
```typescript
const fontFamilies = useMemo(
  () => FONT_FAMILY_VALUES.map((f) => ({ value: f.value, label: t(f.labelKey) })),
  [t],
);
```

- [ ] **Step 3: Add the font selector UI**

In the captions section of `SettingsPanel.tsx`, find the block after the `language` selector (~line 2629) and add the font selector before or after the `fontSize` slider (~line 2766):

```tsx
{/* Font family */}
<div>
  <label className="text-xs font-medium text-foreground mb-2 block">
    {tSettings("captions.fontFamily", "Font")}
  </label>
  <Select
    value={autoCaptionSettings.fontFamily}
    onValueChange={(value) => updateAutoCaptionSettings({ fontFamily: value })}
  >
    <SelectTrigger className="w-full bg-foreground/5 border-foreground/10 text-foreground h-9 text-xs">
      <SelectValue />
    </SelectTrigger>
    <SelectContent className="bg-editor-surface-alt border-foreground/10 text-foreground max-h-[300px]">
      {fontFamilies.map((font) => (
        <SelectItem
          key={font.value}
          value={font.value}
          style={{ fontFamily: font.value }}
        >
          {font.label}
        </SelectItem>
      ))}
      {captionCustomFonts.length > 0 && (
        <>
          <div className="px-2 py-1 text-xs text-foreground/50">Custom Fonts</div>
          {captionCustomFonts.map((font) => (
            <SelectItem
              key={font.id}
              value={font.fontFamily}
              style={{ fontFamily: font.fontFamily }}
            >
              {font.name}
            </SelectItem>
          ))}
        </>
      )}
    </SelectContent>
  </Select>
  <div className="mt-2">
    <AddCustomFontDialog
      onFontAdded={(font) => {
        setCaptionCustomFonts(getCustomFonts());
        updateAutoCaptionSettings({ fontFamily: font.fontFamily });
      }}
    />
  </div>
</div>
```

- [ ] **Step 4: Add i18n key**

In `src/i18n/locales/en/settings.json`, find the `captions` section and add:

```json
"fontFamily": "Font"
```

Other language files can keep the English fallback — the `tSettings` call uses the second argument as fallback text.

- [ ] **Step 5: Run lint**

```bash
npm run lint
```

Fix any Biome errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/video-editor/SettingsPanel.tsx src/i18n/locales/en/settings.json
git commit -m "feat(captions): add font family selector in caption settings panel"
```

---

## Task 5: Run full test suite and verify

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: all tests pass, no regressions.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: zero errors.

- [ ] **Step 3: Commit if anything needed fixing**

```bash
git add -A
git commit -m "fix(captions): lint and test fixes after caption improvements"
```
