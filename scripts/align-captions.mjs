#!/usr/bin/env node
/**
 * align-captions.mjs
 * 给定文本 + 音频，用 Recordly 内置的 whisper-cli.exe 转录并对齐，
 * 输出 autoCaptions JSON，可直接写回 .recordly 文件。
 *
 * 两种模式：
 *
 * 【单音频】
 *   node scripts/align-captions.mjs \
 *     --audio    "D:\path\to\audio.wav" \
 *     --text     "完整文本（或 .txt 文件路径）" \
 *     [--recordly "D:\path\to\project.recordly"]
 *
 * 【多音频（从 .recordly 的 audioRegions 读取）】
 *   node scripts/align-captions.mjs \
 *     --recordly "D:\path\to\project.recordly" \
 *     --text     "完整文本（覆盖所有音频片段）"
 *
 * 可选参数：
 *   --model    "C:\path\to\ggml-small.bin"   默认自动查找 Recordly 缓存
 *   --max-chars 26                            每段最多字符数（默认 26）
 *   --lang      zh                            语言（默认 zh）
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { extname, join } from "node:path";
import { tmpdir, homedir } from "node:os";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const get = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };

const audioArg     = get("--audio");
const textArg      = get("--text");
const recordlyPath = get("--recordly");
const maxChars     = Number(get("--max-chars") ?? 26);
const lang         = get("--lang") ?? "zh";

const WHISPER_CLI = join(
  import.meta.dirname, "..", "electron", "native", "bin", "win32-x64", "whisper-cli.exe"
);
const DEFAULT_MODEL = join(homedir(), "AppData", "Roaming", "Recordly", "whisper", "ggml-small.bin");
const modelPath = get("--model") ?? DEFAULT_MODEL;

if (!textArg) {
  console.error("Usage: node align-captions.mjs --text <text> (--audio <wav> | --recordly <file>)");
  process.exit(1);
}
if (!existsSync(WHISPER_CLI)) { console.error(`whisper-cli not found: ${WHISPER_CLI}`); process.exit(1); }
if (!existsSync(modelPath))   { console.error(`Model not found: ${modelPath}`); process.exit(1); }

const rawText = existsSync(textArg) ? readFileSync(textArg, "utf8") : textArg;
const prompt  = rawText.replace(/\s+/g, " ").trim();

// ── Build audio region list ───────────────────────────────────────────────────
// Each entry: { audioPath, timelineOffsetMs }
// timelineOffsetMs = where this audio's t=0 lands on the project timeline.

let audioRegions;

if (audioArg) {
  // Single audio mode: no endMs cap (use full audio length from whisper)
  audioRegions = [{ audioPath: audioArg, timelineOffsetMs: 0, endMs: null }];
} else if (recordlyPath) {
  if (!existsSync(recordlyPath)) { console.error(`Not found: ${recordlyPath}`); process.exit(1); }
  const proj = JSON.parse(readFileSync(recordlyPath, "utf8"));
  const regions = proj.editor?.audioRegions;
  if (!regions?.length) { console.error("No audioRegions found in .recordly"); process.exit(1); }
  // Sort by startMs so segments end up in order
  audioRegions = regions
    .slice()
    .sort((a, b) => a.startMs - b.startMs)
    .map(r => ({
      audioPath: r.audioPath,
      timelineOffsetMs: r.startMs,
      // endMs caps how far into the timeline this region's captions can reach
      endMs: r.endMs,
    }));
} else {
  console.error("Provide either --audio <wav> or --recordly <file>");
  process.exit(1);
}

console.log(`[align] ${audioRegions.length} audio region(s)`);
audioRegions.forEach((r, i) =>
  console.log(`  [${i}] offset=${r.timelineOffsetMs}ms  ${r.audioPath}`)
);

// ── Run whisper on each audio region ─────────────────────────────────────────
function runWhisper(audioPath) {
  const outDir  = join(tmpdir(), `wh_${randomUUID()}`);
  const outBase = join(outDir, "out");
  mkdirSync(outDir, { recursive: true });

  const r = spawnSync(WHISPER_CLI, [
    "-m", modelPath,
    "-f", audioPath,
    "-l", lang,
    "--prompt", prompt,
    "--carry-initial-prompt",
    "--output-json-full",
    "--output-file", outBase,
    "--no-prints",
    "--threads", "4",
  ], { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });

  if (r.status !== 0) {
    console.error(`[align] whisper-cli failed for ${audioPath}:\n`, r.stderr);
    process.exit(1);
  }

  const jsonFile = `${outBase}.json`;
  if (!existsSync(jsonFile)) {
    console.error(`[align] output JSON not found: ${jsonFile}`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(jsonFile, "utf8"));
}

// ── Collect all whisper segments with global timeline offset applied ──────────
// whisperSegs: { startMs, endMs, text } where times are on the project timeline
const allWhisperSegs = [];

for (const region of audioRegions) {
  console.log(`[align] transcribing: ${region.audioPath}`);
  const raw = runWhisper(region.audioPath);
  const segs = (raw.transcription ?? [])
    .map(seg => {
      const startMs = seg.offsets.from + region.timelineOffsetMs;
      // clamp endMs to the region's configured endMs (don't exceed region boundary)
      const rawEndMs = seg.offsets.to + region.timelineOffsetMs;
      const endMs = region.endMs != null ? Math.min(rawEndMs, region.endMs) : rawEndMs;
      return {
        startMs,
        endMs,
        text: seg.text.replace(/\[_[A-Z_0-9]+_\]/g, "").trim(),
      };
    })
    .filter(s => s.text.length > 0 && s.endMs > s.startMs);
  console.log(`  → ${segs.length} segments, ${segs[0]?.startMs}ms – ${segs[segs.length-1]?.endMs}ms`);
  allWhisperSegs.push(...segs);
}

// Sort by start time (in case regions were not already ordered)
allWhisperSegs.sort((a, b) => a.startMs - b.startMs);
console.log(`[align] total whisper segments: ${allWhisperSegs.length}`);

// ── Split correct text into natural phrases ───────────────────────────────────
function splitText(text, max) {
  const stripPunct = (s) => s.replace(/[\s。！？，、；：]+$/, "").trim();
  return text.split(/(?<=[。！？])/g).flatMap(chunk => {
    chunk = stripPunct(chunk);
    if (!chunk) return [];
    if (chunk.length <= max) return [chunk];
    return chunk.split(/(?<=[，、；：])/g)
      .map(s => stripPunct(s)).filter(Boolean)
      .reduce((acc, s) => {
        const last = acc[acc.length - 1];
        if (last && (last + s).length <= max) acc[acc.length - 1] = last + s;
        else acc.push(s);
        return acc;
      }, []);
  });
}

const correctPhrases = splitText(prompt, maxChars);
console.log(`[align] correct text → ${correctPhrases.length} phrases`);

// ── Build char-position → global-timeline-ms mapping ─────────────────────────
// timePoints[i] = { charPos, ms } — interpolate between them
const whisperCharTotal = allWhisperSegs.reduce((n, s) => n + s.text.length, 0);
const globalStartMs    = allWhisperSegs[0]?.startMs ?? 0;
const globalEndMs      = allWhisperSegs[allWhisperSegs.length - 1]?.endMs ?? 0;

const timePoints = [{ charPos: 0, ms: globalStartMs }];
let charOffset = 0;
for (const seg of allWhisperSegs) {
  charOffset += seg.text.length;
  timePoints.push({ charPos: charOffset, ms: seg.endMs });
}

function charPosToMs(pos) {
  for (let i = 0; i < timePoints.length - 1; i++) {
    const a = timePoints[i], b = timePoints[i + 1];
    if (pos >= a.charPos && pos <= b.charPos) {
      const t = b.charPos === a.charPos ? 0 : (pos - a.charPos) / (b.charPos - a.charPos);
      return Math.round(a.ms + t * (b.ms - a.ms));
    }
  }
  return globalEndMs;
}

// ── Map correct phrases onto global timeline ──────────────────────────────────
const correctTotal = correctPhrases.reduce((n, p) => n + p.length, 0);
const captions = [];
let correctCharPos = 0;

// Build a flat list of region boundaries for clamping caption endMs
const regionBounds = audioRegions
  .filter(r => r.endMs != null)
  .map(r => ({ startMs: r.timelineOffsetMs, endMs: r.endMs }));

function clampEndMs(startMs, endMs) {
  if (!regionBounds.length) return endMs;
  // Find the region this caption starts in and clamp endMs to that region's endMs
  for (const b of regionBounds) {
    if (startMs >= b.startMs && startMs < b.endMs) {
      return Math.min(endMs, b.endMs);
    }
  }
  return endMs;
}

for (let i = 0; i < correctPhrases.length; i++) {
  const phrase = correctPhrases[i];
  const startProportion = correctCharPos / correctTotal;
  const endProportion   = (correctCharPos + phrase.length) / correctTotal;
  const startMs = charPosToMs(Math.round(startProportion * whisperCharTotal));
  const endMs   = clampEndMs(startMs, charPosToMs(Math.round(endProportion * whisperCharTotal)));
  captions.push({ id: `caption-${i + 1}`, startMs, endMs, text: phrase });
  correctCharPos += phrase.length;
}

// ── Print ─────────────────────────────────────────────────────────────────────
console.log("\n── Aligned captions ────────────────────────────────────────");
for (const c of captions) {
  const s = (c.startMs / 1000).toFixed(2).padStart(7);
  const e = (c.endMs   / 1000).toFixed(2).padStart(7);
  console.log(`  [${s}s → ${e}s]  ${c.text}`);
}
console.log(`────────────────────────────────────────────────────────────`);
console.log(`Total: ${captions.length} captions\n`);

// ── Write back ────────────────────────────────────────────────────────────────
if (recordlyPath) {
  const proj = JSON.parse(readFileSync(recordlyPath, "utf8"));
  writeFileSync(recordlyPath + ".bak", JSON.stringify(proj), "utf8");
  proj.editor.autoCaptions = captions;
  proj.editor.autoCaptionSettings = {
    enabled: true,
    language: "auto",
    fontFamily: "Georgia, serif",
    fontSize: 30,
    bottomOffset: 3,
    maxWidth: 60,
    maxRows: 1,
    animationStyle: "fade",
    boxRadius: 17.5,
    textColor: "#FFFFFF",
    inactiveTextColor: "#A3A3A3",
    backgroundOpacity: 0.9,
    maxCharsPerLine: 0,
    textStrokeWidth: 0,
    textStrokeColor: "#000000"
  };
  writeFileSync(recordlyPath, JSON.stringify(proj, null, 2), "utf8");
  console.log(`[align] written ${captions.length} captions → ${recordlyPath}`);
} else {
  const outFile = audioArg.replace(extname(audioArg), "-captions.json");
  writeFileSync(outFile, JSON.stringify(captions, null, 2), "utf8");
  console.log(`[align] captions saved → ${outFile}`);
}
