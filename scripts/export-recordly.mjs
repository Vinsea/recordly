#!/usr/bin/env node
/**
 * export-recordly.mjs
 * [开发中] 该脚本目前处于实验阶段，暂不建议在生产环境使用。
 * 鼠标指针渲染、动态缩放过渡及部分字幕样式尚未完全实现。
 *
 * 将 .recordly 项目文件导出为 MP4。
 *
 * 用法：
 *   node scripts/export-recordly.mjs --recordly "D:\path\to\project.recordly" [--output "D:\path\to\output.mp4"]
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const get = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
};

const recordlyPath = get("--recordly");
const outputPathArg = get("--output");

if (!recordlyPath || !existsSync(recordlyPath)) {
  console.error("Usage: node export-recordly.mjs --recordly <file.recordly> [--output <out.mp4>]");
  process.exit(1);
}

// ── 依赖 ffmpeg-static ───────────────────────────────────────────────────────
let ffmpegPath;
try {
  ffmpegPath = (await import("ffmpeg-static")).default;
  if (!ffmpegPath) throw new Error("not found");
} catch {
  console.error("ffmpeg-static not found. Run: npm install ffmpeg-static");
  process.exit(1);
}

if (!existsSync(ffmpegPath)) {
  console.error(`ffmpeg binary not found at ${ffmpegPath}`);
  process.exit(1);
}

// ── 解析 .recordly ───────────────────────────────────────────────────────────
const proj = JSON.parse(readFileSync(recordlyPath, "utf8"));
const { videoPath, editor } = proj;

if (!videoPath || !existsSync(videoPath)) {
  console.error(`Video source not found: ${videoPath}`);
  process.exit(1);
}

const audioRegions = (editor.audioRegions || []).slice().sort((a, b) => a.startMs - b.startMs);
const captions = editor.autoCaptions || [];
const clipRegions = editor.clipRegions || [];
const zoomRegions = (editor.zoomRegions || []).slice().sort((a, b) => a.startMs - b.startMs);
const settings = editor.autoCaptionSettings || {};

const finalOutput = outputPathArg || recordlyPath.replace(/\.recordly$/, ".mp4");

console.log(`[export] Video: ${videoPath}`);
console.log(`[export] Audio tracks: ${audioRegions.length}`);
console.log(`[export] Captions: ${captions.length}`);
console.log(`[export] Zooms: ${zoomRegions.length}`);

// ── 1. 确定时间范围 ─────────────────────────────────────────────────────────
let startMs = 0;
let endMs = Infinity;

if (clipRegions.length > 0) {
  startMs = clipRegions[0].startMs || 0;
  endMs = clipRegions[0].endMs || Infinity;
}

// ── 2. 生成 ASS 字幕文件 (支持高级样式) ──────────────────────────────────────
const assPath = join(tmpdir(), `rec_${Date.now()}.ass`);
const fontName = (settings.fontFamily || "Arial").split(",")[0].replace(/"/g, "").trim();
const fontSize = settings.fontSize || 20;
const textColor = hexToAssColor(settings.textColor || "#FFFFFF");
const bgColor = hexToAssColor("#000000", Math.round((settings.backgroundOpacity || 0.8) * 255));
const outlineColor = hexToAssColor(settings.textStrokeColor || "#000000");
const outlineWidth = settings.textStrokeWidth || 2;
const marginBottom = settings.bottomOffset || 3;

const assContent = `
[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${fontSize},${textColor},&H000000FF,${outlineColor},${bgColor},1,0,0,0,100,100,0,0,1,${outlineWidth},0,2,10,10,${marginBottom},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${captions
  .filter(c => c.startMs >= startMs && c.startMs < endMs)
  .map(c => {
    const s = (c.startMs - startMs) / 1000;
    const e = (Math.min(c.endMs, endMs) - startMs) / 1000;
    return `Dialogue: 0,${fmtAssTime(s)},${fmtAssTime(e)},Default,,0,0,0,,${c.text}`;
  })
  .join("\n")}`;

writeFileSync(assPath, assContent, "utf8");

// ── 3. 构建 FFmpeg 滤镜 ──────────────────────────────────────────────────────
const inputs = [];
const filterParts = [];

inputs.push("-i", videoPath);

// 视频预处理：裁剪 + 缩放
let vChain = `[0:v]trim=start=${startMs / 1000}:end=${endMs / 1000},setpts=PTS-STARTPTS`;

// 应用 cropRegion (全局裁剪)
if (editor.cropRegion) {
  const { x, y, width, height } = editor.cropRegion;
  // 假设 cropRegion 是相对坐标 (0-1)
  vChain += `,crop=iw*${width}:ih*${height}:iw*${x}:ih*${y}`;
}

// 应用缩放 (Zoom)
// 由于 FFmpeg 滤镜是静态的，动态缩放需要复杂的 enable 表达式
// 这里简化处理：如果只有一个主缩放区域，应用它；否则暂时忽略动态过渡
// 完整的动态缩放需要 split + overlay 或复杂的 zoompan
// 为保持稳定性，暂不在此处实现复杂的逐帧动态 zoom，以免出错

// 添加字幕
const escapedAssPath = assPath.replace(/\\/g, "/").replace(/:/g, "\\:");
vChain += `,ass='${escapedAssPath}'`;
vChain += `[vout]`;
filterParts.push(vChain);

// 音频混合
const audioInputs = [];
for (const region of audioRegions) {
  if (!existsSync(region.audioPath)) {
    console.warn(`[export] Audio not found, skipping: ${region.audioPath}`);
    continue;
  }
  const idx = inputs.length / 2;
  inputs.push("-i", region.audioPath);
  const delay = Math.max(0, region.startMs - startMs);
  filterParts.push(`[${idx}:a]adelay=${delay}|${delay}[a${idx}]`);
  audioInputs.push(`[a${idx}]`);
}

if (audioInputs.length > 0) {
  filterParts.push(`${audioInputs.join("")}amix=inputs=${audioInputs.length}:duration=longest[aout]`);
}

const filterComplex = filterParts.join(";");

const ffmpegArgs = [
  ...inputs,
  "-filter_complex", filterComplex,
  "-map", "[vout]",
];

if (audioInputs.length > 0) {
  ffmpegArgs.push("-map", "[aout]");
}

ffmpegArgs.push(
  "-c:v", "libx264",
  "-preset", "fast",
  "-crf", "18",
  "-c:a", "aac",
  "-b:a", "192k",
  "-y",
  finalOutput
);

console.log(`[export] Starting FFmpeg...`);
const result = spawnSync(ffmpegPath, ffmpegArgs, { stdio: "inherit" });

// 清理临时文件
try { unlinkSync(assPath); } catch {}

if (result.status !== 0) {
  console.error(`[export] FFmpeg failed with code ${result.status}`);
  process.exit(1);
}

console.log(`\n[export] Done! Saved to ${finalOutput}`);

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtAssTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = (seconds % 60).toFixed(2);
  return `${h}:${m.toString().padStart(2, "0")}:${s.padStart(5, "0")}`;
}

function hexToAssColor(hex, alpha = 255) {
  if (!hex) return "&H00FFFFFF";
  hex = hex.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  // ASS color format: &HAABBGGRR (Alpha, Blue, Green, Red)
  return `&${alpha.toString(16).padStart(2, "0").toUpperCase()}${b.toString(16).padStart(2, "0").toUpperCase()}${g.toString(16).padStart(2, "0").toUpperCase()}${r.toString(16).padStart(2, "0").toUpperCase()}`;
}
